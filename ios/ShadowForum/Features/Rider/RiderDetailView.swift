import SwiftUI
import Charts

struct RiderDetailView: View {
    @Environment(AppModel.self) private var app
    let riderId: String
    let name: String

    @State private var days: [WhoopDay] = []
    @State private var standing: Standing?
    @State private var rank = 0
    @State private var riders = 0
    @State private var goal: Goal?
    @State private var loaded = false
    @State private var error: String?

    private var avg: Double? { standing.flatMap { $0.contestDays > 0 ? $0.contestAvg : nil } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(name).font(.largeTitle.bold())
                        if standing?.isStale == true { OverdueBadge() }
                    }
                    Text("Rank \(rank > 0 ? "#\(rank)" : "—") · race avg \(avg.map(Fmt.one) ?? "—")")
                        .foregroundStyle(Color.sfMuted)
                }
                if !loaded {
                    LoadingOrError(error: error) { await load() }
                } else {
                    Card {
                        HStack {
                            StatTile(value: avg.map(Fmt.one) ?? "—", label: "race avg", color: avg.map(Color.score) ?? .sfText)
                            StatTile(value: "\(standing?.contestDays ?? 0)", label: "scored")
                            StatTile(value: "\(standing?.contestMissed ?? 0)", label: "missed",
                                     color: (standing?.contestMissed ?? 0) > 0 ? .sfRed : .sfText)
                            StatTile(value: rank > 0 ? "#\(rank)" : "—", label: "of \(riders)")
                        }
                        let scores = days.compactMap { d in d.score.map { (d.day, $0) } }
                        if scores.count > 1 {
                            ScoreHistoryChart(points: scores).frame(height: 140)
                            Text("All uploaded history").font(.caption).foregroundStyle(Color.sfMuted)
                        }
                    }
                    contestTable
                    if let goal { GoalSummaryCard(goal: goal) }
                }
            }
            .padding(16)
            .padding(.bottom, 60)
        }
        .refreshable { await load() }
        .task { if !loaded { await load() } }
        .navigationTitle(name)
        .navigationBarTitleDisplayMode(.inline)
        .shadowScreen()
    }

    private var contestTable: some View {
        Card(title: "Daily scores — contest") {
            Text("\(Race.formula) · Race avg = average of scored days since \(Day.short(Race.startDay)). The newest day, if still in progress, averages the numbers it has until the next upload.")
                .font(.footnote)
                .foregroundStyle(Color.sfMuted)
            let rows = Stats.contestRows(days)
            if rows.isEmpty {
                Text("No contest days uploaded yet.").foregroundStyle(Color.sfMuted)
            } else {
                Grid(alignment: .trailing, horizontalSpacing: 10, verticalSpacing: 10) {
                    GridRow {
                        Text("Day").gridColumnAlignment(.leading)
                        Text("Rec"); Text("Sleep"); Text("Strain"); Text("Score")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.sfMuted)
                    .accessibilityHidden(true)
                    ForEach(rows) { row in
                        ContestDayRow(row: row)
                    }
                    Divider().overlay(Color.sfLine).gridCellUnsizedAxes(.horizontal)
                    GridRow {
                        Text("Race avg · \(standing?.contestDays ?? 0) days")
                            .gridCellColumns(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(avg.map(Fmt.one) ?? "—").fontWeight(.bold)
                    }
                    .font(.subheadline)
                }
            }
        }
    }

    private func load() async {
        error = nil
        do {
            async let s = app.backend.standings()
            async let d = app.backend.days(userId: riderId)
            async let g = app.backend.goal(userId: riderId)
            let ranked = Race.ranked(try await s)
            days = try await d
            goal = try await g
            riders = ranked.count
            if let i = ranked.firstIndex(where: { $0.userId == riderId }) {
                rank = i + 1; standing = ranked[i]
            }
            loaded = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ContestDayRow: View {
    let row: Stats.ContestRow
    var body: some View {
        let d = row.data
        GridRow {
            VStack(alignment: .leading, spacing: 2) {
                Text(Day.weekday(row.day))
                if row.status != .scored {
                    Text(row.status.rawValue)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(row.status == .missed ? Color.sfRed : Color.sfAmber)
                }
            }
            .gridColumnAlignment(.leading)
            Text(d?.recovery.map { "\(Fmt.one($0))%" } ?? "—")
            Text(d?.sleep.map { "\(Fmt.one($0))%" } ?? "—")
            Text(d?.strain.map { Fmt.one($0) } ?? "—")
            Text(d?.score.map(Fmt.one) ?? "—")
                .fontWeight(.bold)
                .foregroundStyle(d?.score.map(Color.score) ?? Color.sfMuted)
        }
        .font(.subheadline.monospacedDigit())
        .opacity(row.status == .missed ? 0.7 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private var label: String {
        guard let d = row.data, let score = d.score else { return "\(Day.weekday(row.day)), missed" }
        var s = "\(Day.weekday(row.day)), score \(Fmt.one(score))"
        if let r = d.recovery { s += ", recovery \(Fmt.one(r)) percent" }
        if let sl = d.sleep { s += ", sleep \(Fmt.one(sl)) percent" }
        if let st = d.strain { s += ", strain \(Fmt.one(st))" }
        if row.status == .inProgress { s += ", in progress" }
        return s
    }
}

struct ScoreHistoryChart: View {
    let points: [(String, Double)]
    var body: some View {
        Chart(Array(points.enumerated()), id: \.offset) { i, p in
            LineMark(x: .value("Day", i), y: .value("Score", p.1))
                .foregroundStyle(Color.sfSteel)
                .interpolationMethod(.monotone)
        }
        .chartXAxis(.hidden)
        .chartYScale(domain: 0...100)
        .chartYAxis {
            AxisMarks(values: [0, 50, 100]) { _ in
                AxisGridLine().foregroundStyle(Color.sfLine)
                AxisValueLabel().foregroundStyle(Color.sfMuted)
            }
        }
        .accessibilityLabel("Score history")
        .accessibilityValue("\(points.count) days, latest \(Fmt.one(points.last?.1 ?? 0))")
    }
}

struct GoalSummaryCard: View {
    let goal: Goal
    var body: some View {
        Card(title: "Q4 business goal") {
            HStack(alignment: .top) {
                Text(goal.title).font(.headline)
                Spacer()
                GoalChip(status: goal.currentStatus)
            }
            MeterBar(pct: Double(goal.currentProgress), color: .goal(goal.currentStatus))
            Text(goal.targetValue.map { "\(Fmt.one(goal.currentValue))/\(Fmt.one($0))\(goal.unit.map { " \($0)" } ?? "") · \(goal.currentProgress)%" }
                 ?? "\(goal.currentProgress)% complete")
                .font(.caption).foregroundStyle(Color.sfMuted)
        }
    }
}
