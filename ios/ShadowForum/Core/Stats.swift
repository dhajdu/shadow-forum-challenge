import Foundation

// Presentation helpers ported from the web's app/me/stats.ts and app/rider/[id]/page.tsx,
// so My Zone and Rider detail read the same as the website. They only arrange rows the
// server already scored — no scoring happens here.

enum MetricKey: String, CaseIterable, Sendable {
    case score, recovery, sleep, strain, hrv, restingHr

    var label: String {
        switch self {
        case .score: "Race score"
        case .recovery: "Recovery"
        case .sleep: "Sleep"
        case .strain: "Strain"
        case .hrv: "HRV"
        case .restingHr: "Resting HR"
        }
    }
    var unit: String {
        switch self {
        case .recovery, .sleep: "%"
        case .hrv: "ms"
        case .restingHr: "bpm"
        default: ""
        }
    }
    var lowerIsBetter: Bool { self == .restingHr }

    func value(_ d: WhoopDay) -> Double? {
        switch self {
        case .score: d.score
        case .recovery: d.recovery
        case .sleep: d.sleep
        case .strain: d.strain
        case .hrv: d.hrv
        case .restingHr: d.restingHr
        }
    }
}

enum Stats {
    static func round1(_ x: Double) -> Double { (x * 10).rounded() / 10 }
    static func mean(_ xs: [Double]) -> Double? { xs.isEmpty ? nil : xs.reduce(0, +) / Double(xs.count) }
    static func strainPct(_ s: Double) -> Double { min(100, s / Race.strainMax * 100) }

    // MARK: Latest day

    struct Part: Sendable, Hashable { let label: String; let pct: Double; let text: String }
    struct Latest: Sendable {
        let day: String
        let score: Double
        let delta: Double? // vs the 30 days before it
        let parts: [Part]
        let note: String
    }

    static func latestDay(_ days: [WhoopDay]) -> Latest? {
        let scored = days.filter { $0.score != nil }
        guard let last = scored.last, let score = last.score else { return nil }
        let prior = mean(scored.filter { $0.day < last.day && $0.day >= Day.add(last.day, -30) }.compactMap(\.score))
        let parts = [
            Part(label: "Recovery", pct: last.recovery ?? 0, text: last.recovery.map { "\(Fmt.one($0))%" } ?? "—"),
            Part(label: "Sleep", pct: last.sleep ?? 0, text: last.sleep.map { "\(Fmt.one($0))%" } ?? "—"),
            Part(label: "Strain", pct: strainPct(last.strain ?? 0),
                 text: last.strain.map { "\(Fmt.one($0))/\(Int(Race.strainMax))" } ?? "—"),
        ]
        let sorted = parts.sorted { $0.pct > $1.pct }
        let best = sorted.first!, worst = sorted.last!
        return Latest(
            day: last.day, score: score, delta: prior.map { round1(score - $0) }, parts: parts,
            note: "\(best.label) carried the day (\(best.text)); \(worst.label.lowercased()) held it back (\(worst.text))."
        )
    }

    // MARK: Contest strip

    enum CellState: Sendable { case scored, missed, pending }
    struct Cell: Sendable, Hashable, Identifiable {
        let day: String
        let state: CellState
        let score: Double?
        var id: String { day }
    }

    /// One cell per contest day up to today: scored, missed (inside the uploaded range) or not uploaded yet.
    static func contestStrip(_ days: [WhoopDay], start: String = Race.startDay, today: String = Day.today()) -> [Cell] {
        let byDay = Dictionary(days.map { ($0.day, $0) }, uniquingKeysWith: { a, _ in a })
        let lastData = days.last?.day
        var cells: [Cell] = []
        var day = start
        while day <= today {
            let score = byDay[day]?.score
            let state: CellState = score != nil ? .scored : (lastData.map { day <= $0 } ?? false) ? .missed : .pending
            cells.append(Cell(day: day, state: state, score: score))
            day = Day.add(day, 1)
        }
        return cells
    }

    static func currentStreak(_ cells: [Cell]) -> Int {
        var n = 0
        for c in cells.filter({ $0.state != .pending }).reversed() {
            guard c.state == .scored else { break }
            n += 1
        }
        return n
    }

    // MARK: Trends

    enum TrendMode: Sendable { case recent, all }

    struct Trend: Sendable, Identifiable {
        let key: MetricKey
        let bars: [Double?] // 30 daily values (recent) or 26 weekly averages (all), oldest → newest
        let avg7: Double?
        let base: Double? // 30-day or all-time average
        let delta: Double?
        let good: Bool?
        let all: [Double]
        var id: String { key.rawValue }
    }

    private static func lastN(_ byDay: [String: WhoopDay], _ key: MetricKey, end: String, n: Int) -> [Double?] {
        (0..<n).map { i in byDay[Day.add(end, i - n + 1)].flatMap(key.value) }
    }

    /// Anchored on the newest uploaded day (uploads lag behind today).
    static func trends(_ days: [WhoopDay], mode: TrendMode) -> [Trend] {
        let end = days.last?.day
        let byDay = Dictionary(days.map { ($0.day, $0) }, uniquingKeysWith: { a, _ in a })
        return MetricKey.allCases.map { m in
            let daily = end.map { lastN(byDay, m, end: $0, n: 30) } ?? []
            let all = days.compactMap(m.value)
            let bars: [Double?]
            if mode == .recent {
                bars = daily
            } else if let end {
                let long = lastN(byDay, m, end: end, n: 26 * 7)
                bars = (0..<26).map { w in mean(long[(w * 7)..<(w * 7 + 7)].compactMap { $0 }) }
            } else {
                bars = []
            }
            let a7 = mean(daily.suffix(7).compactMap { $0 })
            let base = mode == .recent ? mean(daily.compactMap { $0 }) : mean(all)
            let delta = a7.flatMap { a in base.map { round1(a - $0) } }
            let good: Bool? = (delta == nil || delta == 0) ? nil : (m.lowerIsBetter ? delta! < 0 : delta! > 0)
            return Trend(key: m, bars: bars, avg7: a7.map(round1), base: base.map(round1), delta: delta, good: good, all: all)
        }
    }

    // MARK: Monthly

    struct Month: Sendable, Identifiable {
        let month: String // YYYY-MM
        let avg: Double
        let days: Int
        var id: String { month }
        var label: String { Day.date("\(month)-01")?.formatted(Date.FormatStyle(timeZone: .gmt).month(.abbreviated)) ?? month }
    }

    static func monthly(_ days: [WhoopDay]) -> [Month] {
        var by: [String: [Double]] = [:]
        for d in days { if let s = d.score { by[String(d.day.prefix(7)), default: []].append(s) } }
        return by.map { Month(month: $0.key, avg: round1(mean($0.value)!), days: $0.value.count) }
            .sorted { $0.month < $1.month }
    }

    // MARK: Rider contest table

    enum DayStatus: String, Sendable { case scored, inProgress = "in progress", missed }
    struct ContestRow: Sendable, Identifiable {
        let day: String
        let data: WhoopDay?
        let status: DayStatus
        var id: String { day }
    }

    /// Every contest day from the start to the newest uploaded day, newest first. Complete days score;
    /// the newest day counts with what it has ("in progress"); anything else unscored is missed.
    static func contestRows(_ days: [WhoopDay]) -> [ContestRow] {
        guard let newest = days.last?.day, newest >= Race.startDay else { return [] }
        let byDay = Dictionary(days.map { ($0.day, $0) }, uniquingKeysWith: { a, _ in a })
        var rows: [ContestRow] = []
        var day = newest
        while day >= Race.startDay {
            let d = byDay[day]
            let complete = d?.recovery != nil && d?.sleep != nil && d?.strain != nil
            let status: DayStatus = d?.score == nil ? .missed : complete ? .scored : .inProgress
            rows.append(ContestRow(day: day, data: d, status: status))
            day = Day.add(day, -1)
        }
        return rows
    }

    // MARK: Movers (race "this week" + monthly report)

    struct Mover: Sendable { let name: String; let delta: Int }

    /// Rank change per rider vs a snapshot (+ = moved up).
    static func rankDeltas(_ ranked: [Standing], snapshot: StandingsSnapshot?) -> [String: Int] {
        guard let snapshot else { return [:] }
        let prev = Dictionary(snapshot.data.map { ($0.userId, $0.rank) }, uniquingKeysWith: { a, _ in a })
        var out: [String: Int] = [:]
        for (i, s) in ranked.enumerated() { if let p = prev[s.userId] { out[s.userId] = p - (i + 1) } }
        return out
    }
}
