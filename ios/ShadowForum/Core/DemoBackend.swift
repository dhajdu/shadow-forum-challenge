import Foundation

/// Offline fixture data (fictional riders) for SwiftUI previews and `-demo` screenshots.
/// Scores here are generated with the same formula the server uses, so the screens look real.
actor DemoBackend: ForumBackend {
    static let me = "demo-kai"

    private struct Rider { let id: String; let name: String; let base: Double; let lastGap: Int; let status: GoalStatus }
    private let riders: [Rider] = [
        .init(id: DemoBackend.me, name: "Kai Tran", base: 71, lastGap: 0, status: .onTrack),
        .init(id: "demo-minh", name: "Minh Pham", base: 76, lastGap: 0, status: .atRisk),
        .init(id: "demo-lan", name: "Lan Vo", base: 66, lastGap: 1, status: .onTrack),
        .init(id: "demo-duc", name: "Duc Hoang", base: 62, lastGap: 9, status: .behind),
        .init(id: "demo-sam", name: "Sam Reyes", base: 58, lastGap: 2, status: .hit),
    ]
    private var personal: [PersonalGoal] = [
        .init(id: "pg1", title: "Read 6 books", unit: "books", targetValue: 6, currentValue: 2),
        .init(id: "pg2", title: "Zone 2 rides", unit: "rides", targetValue: 24, currentValue: 7),
    ]
    private var myGoal = Goal(id: "g1", title: "Close 3 enterprise deals", unit: "deals", targetValue: 3,
                              currentValue: 1, currentStatus: .onTrack, currentProgress: 33)
    private var signedIn = true

    var userId: String? { signedIn ? Self.me : nil }

    func signIn(email: String, password: String) async throws { signedIn = true }
    func signUp(code: String, name: String, email: String, password: String) async throws { signedIn = true }
    func signOut() async throws { signedIn = false }

    // deterministic pseudo-random in 0..<1
    private func noise(_ seed: Int) -> Double {
        var x = UInt64(truncatingIfNeeded: seed &* 2_654_435_761 &+ 97)
        x ^= x >> 13; x = x &* 0x5bd1e995; x ^= x >> 15
        return Double(x % 10_000) / 10_000
    }

    private func generateDays(_ r: Rider) -> [WhoopDay] {
        let today = Day.today()
        let last = Day.add(today, -1 - r.lastGap)
        var out: [WhoopDay] = []
        var day = "2026-03-01"
        var i = 0
        let seedBase = r.id.utf8.reduce(0) { $0 &* 31 &+ Int($1) }
        while day <= last {
            i += 1
            let n = noise(seedBase &+ i)
            // a couple of unrecorded days per month
            if n < 0.04 && day < last { day = Day.add(day, 1); continue }
            let rec = max(5, min(99, (r.base + (noise(seedBase &+ i &* 7) - 0.5) * 50).rounded()))
            let sleep = max(40, min(100, (r.base + 12 + (noise(seedBase &+ i &* 11) - 0.5) * 30).rounded()))
            let strain = Stats.round1(max(4, min(20, 9 + (noise(seedBase &+ i &* 13) - 0.3) * 10)))
            let inProgress = day == last
            let s: Double? = inProgress ? nil : strain
            let parts = [rec, sleep] + (s.map { [Stats.strainPct($0)] } ?? [])
            out.append(WhoopDay(
                day: day, score: Stats.round1(parts.reduce(0, +) / Double(parts.count)),
                recovery: rec, sleep: sleep, strain: s,
                restingHr: (58 - (rec - 50) / 10 + noise(seedBase &+ i &* 17) * 3).rounded(),
                hrv: (45 + (rec - 50) / 2 + noise(seedBase &+ i &* 19) * 8).rounded()
            ))
            day = Day.add(day, 1)
        }
        return out
    }

    func standings() async throws -> [Standing] {
        riders.map { r in
            let days = generateDays(r)
            let contest = days.filter { $0.day >= Race.startDay }.compactMap(\.score)
            let all = days.compactMap(\.score)
            let lastContest = days.last(where: { $0.day >= Race.startDay && $0.score != nil })?.day
            return Standing(
                userId: r.id, fullName: r.name,
                contestAvg: Stats.round1(Stats.mean(contest) ?? 0), contestDays: contest.count,
                contestMissed: lastContest.map { Day.between(Race.startDay, $0) + 1 - contest.count } ?? 0,
                allAvg: Stats.round1(Stats.mean(all) ?? 0), allDays: all.count,
                lastDay: days.last?.day, lastDataDay: days.last?.day
            )
        }
    }

    func goalSummaries() async throws -> [GoalSummary] {
        riders.map { GoalSummary(userId: $0.id, title: "Q4 goal", currentStatus: $0.id == Self.me ? myGoal.currentStatus : $0.status) }
    }

    func goal(userId: String) async throws -> Goal? {
        if userId == Self.me { return myGoal }
        guard let r = riders.first(where: { $0.id == userId }) else { return nil }
        return Goal(id: "g-\(r.id)", title: "Grow revenue 20%", unit: "%", targetValue: 20, currentValue: 9,
                    currentStatus: r.status, currentProgress: 45)
    }

    func profile(id: String) async throws -> Profile? {
        riders.first(where: { $0.id == id }).map { Profile(id: $0.id, fullName: $0.name, avatarUrl: nil) }
    }

    func days(userId: String) async throws -> [WhoopDay] {
        riders.first(where: { $0.id == userId }).map(generateDays) ?? []
    }

    func latestAnalysis(userId: String) async throws -> JournalAnalysis? {
        JournalAnalysis(
            weekOf: "2026-09-21",
            headline: "Late meals are the biggest drag on your recovery.",
            insights: [
                .init(title: "Eating within 2h of bed costs ~9 recovery points",
                      detail: "71% next-day recovery on 23 late-meal days vs 80% on 41 other days.", effect: .hurts),
                .init(title: "Morning sunlight lifts sleep performance",
                      detail: "Sleep 88% on 30 days with sunlight vs 81% without (small sample).", effect: .helps),
                .init(title: "Caffeine after 2pm is mixed",
                      detail: "Recovery barely moves (−2), but HRV drops ~6 ms the next day.", effect: .mixed),
            ],
            suggestion: "Finish dinner by 7:30pm on at least four nights this week."
        )
    }

    func uploads(userId: String) async throws -> [Upload] {
        [
            Upload(id: "u2", fileName: "my_whoop_data_2026_09_26.zip", status: "parsed", rowsIngested: 210, createdAt: "2026-09-26T07:10:00Z"),
            Upload(id: "u1", fileName: "my_whoop_data_2026_09_19.zip", status: "parsed", rowsIngested: 203, createdAt: "2026-09-19T06:55:00Z"),
        ]
    }

    func snapshot(before day: String) async throws -> StandingsSnapshot? {
        StandingsSnapshot(day: "2026-09-22", data: [
            .init(userId: "demo-minh", rank: 1), .init(userId: "demo-lan", rank: 2),
            .init(userId: Self.me, rank: 3), .init(userId: "demo-duc", rank: 4), .init(userId: "demo-sam", rank: 5),
        ])
    }

    func snapshot(onOrAfter day: String) async throws -> StandingsSnapshot? { try await snapshot(before: day) }

    func personalGoals(userId: String) async throws -> [PersonalGoal] { personal }

    func addPersonalGoal(title: String, unit: String?, target: Double?) async throws {
        personal.append(.init(id: UUID().uuidString, title: title, unit: unit, targetValue: target, currentValue: 0))
    }

    func updatePersonalGoal(id: String, current: Double) async throws {
        personal = personal.map { $0.id == id ? .init(id: $0.id, title: $0.title, unit: $0.unit, targetValue: $0.targetValue, currentValue: current) : $0 }
    }

    func deletePersonalGoal(id: String) async throws { personal.removeAll { $0.id == id } }

    func createGoal(_ goal: NewGoal) async throws {}

    func updateGoal(_ u: GoalUpdate) async throws {
        let pct = u.targetValue.map { $0 > 0 ? max(0, min(100, Int((u.currentValue / $0 * 100).rounded()))) : 0 } ?? 0
        myGoal = Goal(id: myGoal.id, title: myGoal.title, unit: u.unit, targetValue: u.targetValue,
                      currentValue: u.currentValue, currentStatus: u.status, currentProgress: pct)
    }

    func uploadWhoop(fileName: String, data: Data, stage: @Sendable (UploadStage) async -> Void) async throws -> Int {
        await stage(.uploading)
        try await Task.sleep(for: .seconds(1))
        await stage(.processing)
        try await Task.sleep(for: .seconds(1))
        return 211
    }

    nonisolated func chat(_ messages: [ChatMessage]) -> AsyncThrowingStream<String, Error> {
        let reply = "Your recovery averaged 74% over the last 7 days, up 3 points on your 30-day average.\n\n- Sleep is carrying you: 86% vs 81%.\n- Strain is steady around 11.\n\nKeep late meals to a minimum — they cost you about 9 recovery points the next morning."
        return AsyncThrowingStream { c in
            Task {
                for word in reply.split(separator: " ", omittingEmptySubsequences: false) {
                    try? await Task.sleep(for: .milliseconds(35))
                    c.yield(String(word) + " ")
                }
                c.finish()
            }
        }
    }
}
