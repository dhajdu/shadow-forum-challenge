import SwiftUI
import Charts

struct MyZoneView: View {
    enum Mode: String, CaseIterable { case contest = "Contest", all = "All time" }

    @Environment(AppModel.self) private var app
    @State private var mode: Mode = .contest
    @State private var profile: Profile?
    @State private var ranked: [Standing] = []
    @State private var days: [WhoopDay] = []
    @State private var goal: Goal?
    @State private var personal: [PersonalGoal] = []
    @State private var analysis: JournalAnalysis?
    @State private var loaded = false
    @State private var error: String?
    @State private var editingGoal = false

    private var rank: Int { (ranked.firstIndex { $0.userId == app.userId } ?? -1) + 1 }
    private var mine: Standing? { rank > 0 ? ranked[rank - 1] : nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if !loaded {
                    LoadingOrError(error: error) { await load() }
                } else {
                    LatestDayCard(latest: Stats.latestDay(days))
                    if mode == .contest { progressCard } else { monthlyCard }
                    TrendsCard(days: days, mode: mode == .contest ? .recent : .all)
                    JournalInsightsCard(analysis: analysis)
                    if let goal {
                        GoalCard(goal: goal) { editingGoal = true }
                    }
                    ExtraCreditCard(goals: personal) { await reloadPersonal() }
                }
            }
            .padding(16)
            .padding(.bottom, 60)
        }
        .refreshable { await load() }
        .task { if !loaded { await load() } }
        .sheet(isPresented: $editingGoal) {
            if let goal { GoalEditorSheet(goal: goal) { await load() } }
        }
        .navigationTitle("My Zone")
        .navigationBarTitleDisplayMode(.inline)
        .shadowScreen()
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(profile?.fullName ?? "Rider").font(.largeTitle.bold())
            Group {
                if mode == .all {
                    let scored = days.compactMap(\.score)
                    if let avg = Stats.mean(scored), let first = days.first(where: { $0.score != nil })?.day {
                        Text("All time · avg \(Fmt.one(avg)) over \(scored.count) scored days since \(Day.short(first)) \(first.prefix(4))")
                    } else {
                        Text("No WHOOP history yet — upload your export.")
                    }
                } else if let mine {
                    Text("\(Fmt.ordinal(rank)) of \(ranked.count) · race avg \(Fmt.one(mine.contestAvg)) · \(mine.contestDays) scored days · \(mine.contestMissed) missed")
                } else {
                    Text("Not on the board yet — upload your WHOOP export.")
                }
            }
            .font(.subheadline)
            .foregroundStyle(Color.sfMuted)

            Picker("View", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
            }
            .pickerStyle(.segmented)
        }
    }

    private var progressCard: some View {
        let strip = Stats.contestStrip(days)
        let best = strip.filter { $0.score != nil }.max { $0.score! < $1.score! }
        let above = rank > 1 ? ranked[rank - 2] : nil
        return Card(title: "Daily progress") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 36), spacing: 6)], spacing: 6) {
                ForEach(strip) { StripCell(cell: $0) }
            }
            HStack {
                StatTile(value: best.map { "\(Fmt.one($0.score!))" } ?? "—", label: best.map { "best · \(Day.short($0.day))" } ?? "best day")
                StatTile(value: "\(Stats.currentStreak(strip))", label: "day streak")
                StatTile(value: above.flatMap { a in mine.map { Fmt.one(a.contestAvg - $0.contestAvg) } } ?? "—",
                         label: above.map { "gap to \($0.fullName.split(separator: " ").first ?? "")" } ?? "gap to next")
            }
        }
    }

    private var monthlyCard: some View {
        let months = Array(Stats.monthly(days).suffix(12))
        let scored = days.compactMap(\.score)
        return Card(title: "Monthly averages") {
            if months.isEmpty {
                Text("No scored days yet — upload your WHOOP export.").foregroundStyle(Color.sfMuted)
            } else {
                Chart(months) { m in
                    BarMark(x: .value("Month", m.label), y: .value("Average", m.avg))
                        .foregroundStyle(Color.score(m.avg))
                        .annotation(position: .top) {
                            Text("\(Int(m.avg.rounded()))").font(.caption2).foregroundStyle(Color.sfMuted)
                        }
                }
                .chartYScale(domain: 0...100)
                .chartYAxis(.hidden)
                .chartXAxis {
                    AxisMarks { _ in AxisValueLabel().foregroundStyle(Color.sfMuted) }
                }
                .frame(height: 150)
            }
            HStack {
                StatTile(value: Stats.mean(scored).map(Fmt.one) ?? "—", label: "all-time avg")
                StatTile(value: scored.max().map(Fmt.one) ?? "—", label: "best day ever")
                StatTile(value: "\(scored.count)", label: "scored days")
            }
        }
    }

    private func load() async {
        error = nil
        let uid = app.userId
        do {
            async let p = app.backend.profile(id: uid)
            async let s = app.backend.standings()
            async let d = app.backend.days(userId: uid)
            async let g = app.backend.goal(userId: uid)
            async let pg = app.backend.personalGoals(userId: uid)
            async let a = app.backend.latestAnalysis(userId: uid)
            profile = try await p
            ranked = Race.ranked(try await s)
            days = try await d
            goal = try await g
            personal = try await pg
            analysis = try? await a
            loaded = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func reloadPersonal() async {
        personal = (try? await app.backend.personalGoals(userId: app.userId)) ?? personal
    }
}

struct StripCell: View {
    let cell: Stats.Cell
    var body: some View {
        let color = cell.score.map(Color.score)
        Text(cell.score.map { "\(Int($0.rounded()))" } ?? (cell.state == .missed ? "×" : ""))
            .font(.caption.weight(.bold).monospacedDigit())
            .frame(maxWidth: .infinity, minHeight: 34)
            .foregroundStyle(cell.state == .missed ? Color.sfRed : Color.sfText)
            .background((color ?? .clear).opacity(0.28), in: RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(color ?? (cell.state == .missed ? Color.sfRed.opacity(0.6) : Color.sfLine),
                            style: StrokeStyle(lineWidth: 1, dash: cell.state == .pending ? [3] : []))
            )
            .accessibilityLabel("\(Day.short(cell.day)), \(cell.score.map { "score \(Fmt.one($0))" } ?? (cell.state == .missed ? "missed" : "not uploaded yet"))")
    }
}

struct LatestDayCard: View {
    let latest: Stats.Latest?
    @ScaledMetric(relativeTo: .largeTitle) private var bigSize = 56
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Card(title: latest.map { "Latest day · \(Day.short($0.day))" } ?? "Latest day") {
            if let latest {
                let score = Text(Fmt.one(latest.score))
                    .font(.system(size: bigSize, weight: .heavy).monospacedDigit())
                    .foregroundStyle(Color.score(latest.score))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                let delta = latest.delta.map { d in
                    Text("\(Fmt.signed(d)) vs your 30-day average")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(d >= 0 ? Color.sfSteel : Color.sfRed)
                }
                Group {
                    if typeSize.isAccessibilitySize {
                        VStack(alignment: .leading, spacing: 4) { score; delta }
                    } else {
                        HStack(alignment: .firstTextBaseline, spacing: 10) { score; delta }
                    }
                }
                .accessibilityElement(children: .combine)
                ForEach(latest.parts, id: \.label) { p in
                    Group {
                        if typeSize.isAccessibilitySize {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack { Text(p.label); Spacer(); Text(p.text).fontWeight(.semibold) }
                                    .font(.subheadline.monospacedDigit())
                                MeterBar(pct: p.pct, color: .score(p.pct))
                            }
                        } else {
                            HStack(spacing: 10) {
                                Text(p.label).font(.subheadline).frame(width: 76, alignment: .leading)
                                MeterBar(pct: p.pct, color: .score(p.pct))
                                Text(p.text).font(.subheadline.weight(.semibold).monospacedDigit())
                                    .frame(minWidth: 56, alignment: .trailing)
                            }
                        }
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(p.label) \(p.text)")
                }
                Text(latest.note).font(.footnote).foregroundStyle(Color.sfMuted)
            } else {
                Text("No scored days yet — upload your WHOOP export.").foregroundStyle(Color.sfMuted)
            }
        }
    }
}

struct TrendsCard: View {
    let days: [WhoopDay]
    let mode: Stats.TrendMode
    @State private var expanded: MetricKey?

    var body: some View {
        Card(title: mode == .recent ? "Trends · last 7 vs 30 days" : "Trends · last 7 days vs all time") {
            if days.isEmpty {
                Text("No data yet — upload your WHOOP export.").foregroundStyle(Color.sfMuted)
            } else {
                HStack {
                    Spacer()
                    Text("7d").frame(width: 44, alignment: .trailing)
                    Text(mode == .recent ? "30d" : "all").frame(width: 44, alignment: .trailing)
                    Text("trend").frame(width: 64, alignment: .trailing)
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Color.sfMuted)
                .accessibilityHidden(true)

                ForEach(Stats.trends(days, mode: mode)) { t in
                    VStack(alignment: .leading, spacing: 8) {
                        Button {
                            withAnimation { expanded = expanded == t.key ? nil : t.key }
                        } label: {
                            TrendRowView(trend: t, mode: mode)
                        }
                        .buttonStyle(.plain)
                        if expanded == t.key, t.all.count > 1 {
                            Chart(Array(t.all.enumerated()), id: \.offset) { i, v in
                                LineMark(x: .value("Day", i), y: .value(t.key.label, v))
                                    .foregroundStyle(Color.sfSteel)
                                    .interpolationMethod(.monotone)
                            }
                            .chartXAxis(.hidden)
                            .chartYAxis {
                                AxisMarks { _ in
                                    AxisGridLine().foregroundStyle(Color.sfLine)
                                    AxisValueLabel().foregroundStyle(Color.sfMuted)
                                }
                            }
                            .frame(height: 120)
                            .accessibilityLabel("\(t.key.label), all \(t.all.count) days")
                        }
                    }
                    if t.key != .restingHr { Divider().overlay(Color.sfLine) }
                }
            }
        }
    }
}

struct TrendRowView: View {
    let trend: Stats.Trend
    let mode: Stats.TrendMode
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let t = trend
        let vals = t.bars.compactMap { $0 }
        let lo = vals.min() ?? 0, span = max((vals.max() ?? 1) - lo, 1)
        let recent = mode == .recent ? 7 : 1
        let bars = Chart(Array(t.bars.enumerated()), id: \.offset) { i, v in
                BarMark(x: .value("i", i), y: .value("v", v.map { 0.2 + ($0 - lo) / span * 0.8 } ?? 0.03))
                    .foregroundStyle(i >= t.bars.count - recent ? Color.sfSteel : Color.sfDeepSteel)
            }
            .chartXAxis(.hidden).chartYAxis(.hidden)
            .chartYScale(domain: 0...1)
            .frame(height: 26)
        let avg7 = Text(t.avg7.map(Fmt.one) ?? "—").font(.subheadline.weight(.bold).monospacedDigit())
        let base = Text(t.base.map(Fmt.one) ?? "—").font(.subheadline.monospacedDigit()).foregroundStyle(Color.sfMuted)
        let delta = Text(t.delta.map { "\($0 > 0 ? "▲" : $0 < 0 ? "▼" : "▶") \(Fmt.signed($0))" } ?? "—")
            .font(.caption.weight(.semibold).monospacedDigit())
            .foregroundStyle(t.good == nil ? Color.sfMuted : t.good! ? Color.sfSteel : Color.sfRed)
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 6) {
                    Text(t.key.label).font(.subheadline)
                    bars
                    HStack(spacing: 16) { avg7; base; delta }
                }
            } else {
                HStack(spacing: 8) {
                    Text(t.key.label).font(.subheadline).frame(width: 84, alignment: .leading)
                    bars
                    avg7.frame(width: 44, alignment: .trailing)
                    base.frame(width: 44, alignment: .trailing)
                    delta.frame(width: 64, alignment: .trailing)
                }
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(t.key.label): 7-day \(t.avg7.map(Fmt.one) ?? "none"), \(mode == .recent ? "30-day" : "all-time") \(t.base.map(Fmt.one) ?? "none")\(t.delta.map { ", change \(Fmt.signed($0)) \(t.key.unit)" } ?? "")")
        .accessibilityHint("Shows the full chart")
    }
}

struct JournalInsightsCard: View {
    let analysis: JournalAnalysis?

    var body: some View {
        Card(title: analysis.map { "Journal insights · week of \(Day.short($0.weekOf))" } ?? "Journal insights") {
            if let a = analysis {
                Text(a.headline).font(.headline)
                ForEach(a.insights, id: \.title) { i in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: icon(i.effect))
                            .foregroundStyle(color(i.effect))
                            .font(.title3)
                            .accessibilityLabel(i.effect.rawValue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(i.title).font(.subheadline.weight(.semibold))
                            Text(i.detail).font(.footnote).foregroundStyle(Color.sfMuted)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("TRY THIS WEEK").font(.caption2.weight(.bold)).tracking(1).foregroundStyle(Color.sfAmber)
                    Text(a.suggestion).font(.subheadline)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.sfAmber.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                .accessibilityElement(children: .combine)
            } else {
                Text("Your weekly analysis arrives Monday — keep answering the WHOOP journal each morning and upload your export.")
                    .font(.subheadline)
                    .foregroundStyle(Color.sfMuted)
            }
        }
    }

    private func icon(_ e: JournalAnalysis.Insight.Effect) -> String {
        switch e {
        case .helps: "arrow.up.circle.fill"
        case .hurts: "arrow.down.circle.fill"
        case .mixed: "arrow.left.arrow.right.circle.fill"
        }
    }
    private func color(_ e: JournalAnalysis.Insight.Effect) -> Color {
        switch e {
        case .helps: .sfSteel
        case .hurts: .sfRed
        case .mixed: .sfAmber
        }
    }
}
