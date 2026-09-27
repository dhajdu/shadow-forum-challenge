import Foundation

/// Contest rules for display. Mirrors lib/contest.ts + lib/standings.ts on the web.
/// Scores and averages are computed server-side; this only ranks and labels them.
enum Race {
    static let startDay = "2026-09-23"
    static let endDay = "2026-12-22"
    static let contestDays = 91
    /// Placement penalties in VND millions: 1st pays 0, then 2M..5M.
    static let placementPenalties = [0, 2, 3, 4, 5]
    static let missedGoalPenalty = 5
    static let coachSharePenalty = 5
    static let staleDays = 7
    static let strainMax = 21.0

    static var pot: Int { placementPenalties.reduce(0, +) }

    static func penalty(forIndex i: Int) -> Int {
        placementPenalties[min(i, placementPenalties.count - 1)]
    }

    /// 1-based day of the contest, clamped to 0...91.
    static func dayOfContest(today: String = Day.today()) -> Int {
        max(0, min(contestDays, Day.between(startDay, today) + 1))
    }

    static func isStale(lastDataDay: String?, today: String = Day.today()) -> Bool {
        guard let last = lastDataDay else { return true }
        return last < Day.add(today, -staleDays)
    }

    /// Highest contest average first; riders with no scored days go last, by name.
    static func ranked(_ rows: [Standing]) -> [Standing] {
        rows.sorted { x, y in
            let xs = x.contestDays > 0, ys = y.contestDays > 0
            if xs != ys { return xs }
            if x.contestAvg != y.contestAvg { return x.contestAvg > y.contestAvg }
            return x.fullName.localizedCompare(y.fullName) == .orderedAscending
        }
    }

    static let formula = "Day score = (Recovery % + Sleep % + Strain ÷ 21 × 100) ÷ 3"
}

/// Calendar-day strings (YYYY-MM-DD, UTC) — the same keys the database uses.
enum Day {
    private static let iso = Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()

    static func date(_ s: String) -> Date? { try? Date(s, strategy: iso) }
    static func string(_ d: Date) -> String { d.formatted(iso) }
    static func today(now: Date = .now) -> String { string(now) }

    static func add(_ s: String, _ n: Int) -> String {
        guard let d = date(s) else { return s }
        return string(d.addingTimeInterval(Double(n) * 86_400))
    }

    /// Whole days from a to b.
    static func between(_ a: String, _ b: String) -> Int {
        guard let x = date(a), let y = date(b) else { return 0 }
        return Int((y.timeIntervalSince(x) / 86_400).rounded())
    }

    /// "Sep 27"
    static func short(_ s: String) -> String {
        guard let d = date(s) else { return s }
        return d.formatted(Date.FormatStyle(timeZone: .gmt).month(.abbreviated).day())
    }

    /// "Tue, Sep 23"
    static func weekday(_ s: String) -> String {
        guard let d = date(s) else { return s }
        return d.formatted(Date.FormatStyle(timeZone: .gmt).weekday(.abbreviated).month(.abbreviated).day())
    }

    /// "September 2026"
    static func monthTitle(_ s: String) -> String {
        guard let d = date(s) else { return s }
        return d.formatted(Date.FormatStyle(timeZone: .gmt).month(.wide).year())
    }
}

enum Fmt {
    static func one(_ x: Double) -> String {
        let r = (x * 10).rounded() / 10
        return r == r.rounded() ? String(Int(r)) : String(format: "%.1f", r)
    }
    static func signed(_ x: Double) -> String { (x > 0 ? "+" : "") + one(x) }
    static func ordinal(_ n: Int) -> String {
        if (11...13).contains(n % 100) { return "\(n)th" }
        switch n % 10 {
        case 1: return "\(n)st"
        case 2: return "\(n)nd"
        case 3: return "\(n)rd"
        default: return "\(n)th"
        }
    }
    static func owes(_ m: Int) -> String { m == 0 ? "0" : "\(m)M" }
}
