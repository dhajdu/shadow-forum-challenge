import SwiftUI

struct MoreView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        List {
            Section {
                NavigationLink { RulesView() } label: { Label("The Rules", systemImage: "scroll") }
                NavigationLink { ReportView() } label: { Label("Monthly report", systemImage: "chart.bar.doc.horizontal") }
            }
            .listRowBackground(Color.sfSurface)
            Section {
                Link(destination: AppConfig.apiBaseURL) { Label("Open the website", systemImage: "safari") }
                Button(role: .destructive) {
                    Task { await app.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
            .listRowBackground(Color.sfSurface)
        }
        .navigationTitle("More")
        .shadowScreen()
    }
}

struct RulesView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("The Rules").font(.largeTitle.bold())
                    Text("Q4 2026 · agreed by the five. Amounts in VND.").foregroundStyle(Color.sfMuted)
                }
                Card(title: "1 · Business goal") {
                    Text("Each rider commits to one Q4 business goal. **Hit it and you pay nothing.** Miss it and **\(Race.missedGoalPenalty)M VND** is owed by **the rider** and another **\(Race.coachSharePenalty)M VND** by **their coach** — skin in the game on both sides of the 1-on-1.")
                }
                Card(title: "2 · Race Into the Shadow") {
                    Text("Final standings rank on your average daily **WHOOP score — a blend of Recovery, Sleep performance and Strain**. Only days from the contest start count. A day scores once WHOOP has recorded all three numbers; your newest day (still in progress when you export) counts with what it has and is updated on your next upload.")
                    Text(Race.formula).font(.footnote.monospaced()).foregroundStyle(Color.sfMuted)
                    ForEach(Array(Race.placementPenalties.enumerated()), id: \.offset) { i, amt in
                        HStack {
                            Text(Fmt.ordinal(i + 1) + (i == 0 ? " (winner)" : ""))
                            Spacer()
                            Text(amt == 0 ? "0" : "\(amt)M VND")
                                .fontWeight(.bold)
                                .foregroundStyle(amt == 0 ? Color.sfAmber : Color.sfRed)
                        }
                        .font(.subheadline.monospacedDigit())
                    }
                }
                Card(title: "3 · Keep your data current") {
                    Text("Upload your WHOOP export regularly. You'll get a **weekly nudge** to upload. A red **!** marks anyone whose newest data is more than \(Race.staleDays) days old.")
                }
                Card(title: "4 · The window") {
                    Text("The race starts **\(Day.monthDay(Race.startDay))** and runs through **\(Day.monthDay(Race.endDay))**, then the kitty settles.")
                }
                Card(title: "5 · Monthly coaching call") {
                    Text("It's the **coach's responsibility to schedule the monthly 1-on-1 call** with their rider — a live rep at high-performance coaching.")
                }
            }
            .font(.subheadline)
            .padding(16)
            .padding(.bottom, 60)
        }
        .navigationTitle("Rules")
        .navigationBarTitleDisplayMode(.inline)
        .shadowScreen()
    }
}

/// Monthly recap — rank change vs the oldest snapshot in the last ~35 days (same as lib/report.ts).
struct ReportView: View {
    @Environment(AppModel.self) private var app
    @State private var rows: [(Standing, Int?, GoalStatus)] = []
    @State private var loaded = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MONTHLY REPORT").font(.caption.weight(.semibold)).tracking(1.2).foregroundStyle(Color.sfMuted)
                    Text(Day.monthTitle(Day.today())).font(.largeTitle.bold())
                }
                if !loaded {
                    LoadingOrError(error: error) { await load() }
                } else {
                    let movers = rows.compactMap { r in r.1.map { (r.0.fullName, $0) } }
                    HStack(spacing: 12) {
                        Card(title: "Biggest mover") { mover(movers.max { $0.1 < $1.1 }) }
                        Card(title: "Biggest faller") { mover(movers.min { $0.1 < $1.1 }) }
                    }
                    Card(title: "Per-rider recap") {
                        ForEach(Array(rows.enumerated()), id: \.element.0.userId) { i, r in
                            HStack(spacing: 10) {
                                Text("\(i + 1)").font(.subheadline.monospacedDigit()).foregroundStyle(Color.sfMuted).frame(width: 18)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(r.0.fullName).font(.subheadline.weight(.semibold))
                                    GoalChip(status: r.2)
                                }
                                Spacer()
                                Text(r.0.contestAvg > 0 ? Fmt.one(r.0.contestAvg) : "—").font(.headline.monospacedDigit())
                                Text(delta(r.1)).font(.caption.monospacedDigit())
                                    .foregroundStyle((r.1 ?? 0) > 0 ? Color.sfSteel : (r.1 ?? 0) < 0 ? Color.sfRed : Color.sfMuted)
                                    .frame(width: 40, alignment: .trailing)
                                let owes = Race.penalty(forIndex: i)
                                Text(Fmt.owes(owes)).font(.subheadline.weight(.bold).monospacedDigit())
                                    .foregroundStyle(owes == 0 ? Color.sfAmber : Color.sfRed)
                                    .frame(width: 34, alignment: .trailing)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 60)
        }
        .refreshable { await load() }
        .task { if !loaded { await load() } }
        .navigationTitle("Report")
        .navigationBarTitleDisplayMode(.inline)
        .shadowScreen()
    }

    private func mover(_ m: (String, Int)?) -> some View {
        Text(m.map { "\($0.0) \(delta($0.1))" } ?? "—").font(.headline)
    }

    private func delta(_ d: Int?) -> String {
        guard let d else { return "—" }
        return d > 0 ? "▲ +\(d)" : d < 0 ? "▼ \(d)" : "–"
    }

    private func load() async {
        error = nil
        do {
            async let s = app.backend.standings()
            async let g = app.backend.goalSummaries()
            async let snap = app.backend.snapshot(onOrAfter: Day.add(Day.today(), -35))
            let ranked = Race.ranked(try await s)
            let status = Dictionary((try await g).map { ($0.userId, $0.currentStatus) }, uniquingKeysWith: { a, _ in a })
            let deltas = Stats.rankDeltas(ranked, snapshot: try? await snap)
            rows = ranked.map { ($0, deltas[$0.userId], status[$0.userId] ?? .onTrack) }
            loaded = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}

extension Day {
    /// "September 23, 2026"
    static func monthDay(_ s: String) -> String {
        guard let d = date(s) else { return s }
        return d.formatted(Date.FormatStyle(timeZone: .gmt).month(.wide).day().year())
    }
}
