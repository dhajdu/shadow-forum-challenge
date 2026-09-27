import SwiftUI
import WidgetKit

struct RaceView: View {
    @Environment(AppModel.self) private var app
    @State private var rows: [Standing] = []
    @State private var goals: [String: GoalSummary] = [:]
    @State private var mover: Stats.Mover?
    @State private var snapshotDay: String?
    @State private var loaded = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if !loaded {
                    LoadingOrError(error: error) { await load() }
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { i, s in
                            NavigationLink(value: s) {
                                RaceRow(place: i + 1, standing: s, goal: goals[s.userId]?.currentStatus,
                                        isMe: s.userId == app.userId)
                            }
                            .buttonStyle(.plain)
                            if i < rows.count - 1 { Divider().overlay(Color.sfLine) }
                        }
                    }
                    .background(Color.sfSurface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.sfLine))

                    weekCard
                    Text("Pot: 1st pays 0, then 2M–5M VND · business goal miss = \(Race.missedGoalPenalty)M rider + \(Race.coachSharePenalty)M coach, settled at year end.")
                        .font(.footnote)
                        .foregroundStyle(Color.sfMuted)
                }
            }
            .padding(16)
            .padding(.bottom, 60)
        }
        .refreshable { await load() }
        .task { if !loaded { await load() } }
        .navigationDestination(for: Standing.self) { RiderDetailView(riderId: $0.userId, name: $0.fullName) }
        .toolbar {
            ToolbarItem(placement: .principal) { Wordmark() }
        }
        .navigationBarTitleDisplayMode(.inline)
        .shadowScreen()
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Race Into the Shadow").font(.largeTitle.bold())
            Text("Highest average WHOOP score leads. Deepest into the shadow pays nothing.")
                .font(.subheadline).foregroundStyle(Color.sfMuted)
            HStack(spacing: 12) {
                Card { StatTile(value: "\(Race.dayOfContest())/\(Race.contestDays)", label: "contest day") }
                Card { StatTile(value: "\(Race.pot)M", label: "pot · VND", color: .sfAmber) }
            }
        }
    }

    private var weekCard: some View {
        Card(title: "This week") {
            Group {
                if snapshotDay == nil {
                    Text("No weekly snapshot yet — movers show from the first one.")
                } else if let mover {
                    Text("Biggest mover: **\(mover.name)** \(mover.delta > 0 ? "▲" : "▼") \(abs(mover.delta)) since \(Day.short(snapshotDay!))")
                } else {
                    Text("No place changes since \(Day.short(snapshotDay!)).")
                }
            }
            .font(.subheadline)
            let overdue = rows.filter(\.isStale).count
            Text(overdue == 0 ? "Everyone's uploads are current." : "\(overdue) rider\(overdue == 1 ? "" : "s") overdue on uploads.")
                .font(.subheadline)
                .foregroundStyle(overdue == 0 ? Color.sfMuted : Color.sfRed)
        }
    }

    /// Hand the widgets the latest race (App Group only — no credentials leave the app).
    private func publishWidget(_ ranked: [Standing]) {
        let i = ranked.firstIndex { $0.userId == app.userId }
        let avg = { (s: Standing) in s.contestDays > 0 ? s.contestAvg : nil }
        WidgetSnapshot(
            myPlace: i.map { $0 + 1 }, riders: ranked.count, myAvg: i.flatMap { avg(ranked[$0]) },
            top: ranked.prefix(3).map { .init(name: $0.fullName.split(separator: " ").first.map(String.init) ?? $0.fullName,
                                              avg: avg($0), isMe: $0.userId == app.userId) },
            contestDay: Race.dayOfContest(), updated: .now
        ).save(group: AppConfig.appGroup)
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func load() async {
        error = nil
        do {
            async let s = app.backend.standings()
            async let g = app.backend.goalSummaries()
            async let snap = app.backend.snapshot(before: Day.today())
            let ranked = Race.ranked(try await s)
            let snapshot = try? await snap
            rows = ranked
            goals = Dictionary((try await g).map { ($0.userId, $0) }, uniquingKeysWith: { a, _ in a })
            snapshotDay = snapshot?.day
            let deltas = Stats.rankDeltas(ranked, snapshot: snapshot)
            mover = ranked.compactMap { s in deltas[s.userId].flatMap { $0 == 0 ? nil : Stats.Mover(name: s.fullName, delta: $0) } }
                .max { abs($0.delta) < abs($1.delta) }
            loaded = true
            publishWidget(ranked)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct RaceRow: View {
    let place: Int
    let standing: Standing
    let goal: GoalStatus?
    let isMe: Bool

    private var owes: Int { Race.penalty(forIndex: place - 1) }
    private var scored: Bool { standing.contestDays > 0 }

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                // large text: stack the numbers under the name
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) { medal; nameLine }
                    detailLine
                    HStack(spacing: 20) { avgView; owesView }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                HStack(spacing: 12) {
                    medal
                    VStack(alignment: .leading, spacing: 4) { nameLine; detailLine }
                    Spacer(minLength: 4)
                    avgView
                    owesView.frame(minWidth: 40, alignment: .trailing)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(isMe ? Color.sfDeepSteel.opacity(0.25) : Color.clear)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibility)
        .accessibilityHint("Shows daily scores")
    }

    private var medal: some View {
        Text("\(place)")
            .font(.headline.monospacedDigit())
            .frame(minWidth: 34, minHeight: 34)
            .foregroundStyle(place == 1 ? Color.sfBackground : Color.sfText)
            .background(place == 1 ? Color.sfAmber : Color.clear, in: Circle())
            .overlay(Circle().stroke(place == 1 ? Color.sfAmber : Color.sfDeepSteel, lineWidth: 1.5))
    }

    private var nameLine: some View {
        HStack(spacing: 6) {
            Text(standing.fullName).font(.headline).lineLimit(typeSize.isAccessibilitySize ? 2 : 1)
            if standing.isStale { OverdueBadge() }
        }
    }

    private var detailLine: some View {
        HStack(spacing: 6) {
            if let goal { GoalChip(status: goal) } else { Text("goal not set").font(.caption2).foregroundStyle(Color.sfMuted) }
            Text("\(standing.contestDays)d · \(standing.contestMissed) missed")
                .font(.caption)
                .foregroundStyle(Color.sfMuted)
        }
    }

    private var avgView: some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(scored ? Fmt.one(standing.contestAvg) : "—")
                .font(.title2.weight(.heavy).monospacedDigit())
                .foregroundStyle(scored ? Color.score(standing.contestAvg) : Color.sfMuted)
            Text("avg").font(.caption2).foregroundStyle(Color.sfMuted)
        }
    }

    private var owesView: some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(Fmt.owes(owes))
                .font(.headline.monospacedDigit())
                .foregroundStyle(owes == 0 ? Color.sfAmber : Color.sfRed)
            Text("owes").font(.caption2).foregroundStyle(Color.sfMuted)
        }
    }

    private var accessibility: String {
        var parts = ["\(Fmt.ordinal(place)) place", standing.fullName + (isMe ? ", you" : "")]
        parts.append(scored ? "average \(Fmt.one(standing.contestAvg))" : "no scored days yet")
        parts.append("\(standing.contestDays) scored days, \(standing.contestMissed) missed")
        parts.append(owes == 0 ? "owes nothing" : "owes \(owes) million dong")
        if let goal { parts.append("goal \(goal.label)") }
        if standing.isStale { parts.append("upload overdue") }
        return parts.joined(separator: ", ")
    }
}
