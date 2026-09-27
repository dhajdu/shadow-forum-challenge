import Foundation

// Rows as Supabase returns them. Keys are snake_case in Postgres.

/// One row of the `race_standings` view — the source of truth for the race.
struct Standing: Codable, Sendable, Identifiable, Hashable {
    let userId: String
    let fullName: String
    let contestAvg: Double
    let contestDays: Int
    let contestMissed: Int
    let allAvg: Double
    let allDays: Int
    let lastDay: String?
    let lastDataDay: String?

    var id: String { userId }
    /// No WHOOP data newer than `Race.staleDays` days — the red "!".
    var isStale: Bool { Race.isStale(lastDataDay: lastDataDay) }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id", fullName = "full_name", contestAvg = "contest_avg", contestDays = "contest_days"
        case contestMissed = "contest_missed", allAvg = "all_avg", allDays = "all_days", lastDay = "last_day"
        case lastDataDay = "last_data_day"
    }
}

enum GoalStatus: String, Codable, Sendable, CaseIterable, Identifiable {
    case onTrack = "on_track", atRisk = "at_risk", behind, hit
    var id: String { rawValue }
    var label: String {
        switch self {
        case .onTrack: "on track"
        case .atRisk: "at risk"
        case .behind: "behind"
        case .hit: "hit"
        }
    }
}

/// The public part of every rider's business goal (goals are readable by all riders).
struct GoalSummary: Codable, Sendable, Hashable {
    let userId: String
    let title: String
    let currentStatus: GoalStatus
    enum CodingKeys: String, CodingKey { case userId = "user_id", title, currentStatus = "current_status" }
}

struct Goal: Codable, Sendable, Hashable {
    let id: String
    let title: String
    let unit: String?
    let targetValue: Double?
    let currentValue: Double
    let currentStatus: GoalStatus
    let currentProgress: Int

    enum CodingKeys: String, CodingKey {
        case id, title, unit, targetValue = "target_value", currentValue = "current_value"
        case currentStatus = "current_status", currentProgress = "current_progress"
    }
}

struct PersonalGoal: Codable, Sendable, Identifiable, Hashable {
    let id: String
    let title: String
    let unit: String?
    let targetValue: Double?
    let currentValue: Double

    enum CodingKeys: String, CodingKey {
        case id, title, unit, targetValue = "target_value", currentValue = "current_value"
    }

    /// Percent of target, or nil when there's no target.
    var pct: Int? {
        guard let t = targetValue, t > 0 else { return nil }
        return max(0, min(100, Int((currentValue / t * 100).rounded())))
    }
}

struct Profile: Codable, Sendable, Hashable {
    let id: String
    let fullName: String
    let avatarUrl: String?
    enum CodingKeys: String, CodingKey { case id, fullName = "full_name", avatarUrl = "avatar_url" }
}

/// One WHOOP day (wake day). Score is computed at ingest, server-side.
struct WhoopDay: Codable, Sendable, Hashable {
    let day: String
    let score: Double?
    let recovery: Double?
    let sleep: Double?
    let strain: Double?
    let restingHr: Double?
    let hrv: Double?

    enum CodingKeys: String, CodingKey {
        case day, score, recovery, sleep, strain, restingHr = "resting_hr", hrv
    }
}

/// The weekly Claude analysis of a rider's journal (private to the rider).
struct JournalAnalysis: Codable, Sendable, Hashable {
    struct Insight: Codable, Sendable, Hashable {
        enum Effect: String, Codable, Sendable { case helps, hurts, mixed }
        let title: String
        let detail: String
        let effect: Effect
    }
    let weekOf: String
    let headline: String
    let insights: [Insight]
    let suggestion: String

    enum CodingKeys: String, CodingKey { case weekOf = "week_of", headline, insights, suggestion }
}

struct Upload: Codable, Sendable, Identifiable, Hashable {
    let id: String
    let fileName: String
    let status: String
    let rowsIngested: Int?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, fileName = "file_name", status, rowsIngested = "rows_ingested", createdAt = "created_at"
    }
}

/// Weekly place snapshot written by the Steward cron.
struct StandingsSnapshot: Codable, Sendable {
    struct Entry: Codable, Sendable {
        let userId: String
        let rank: Int
        enum CodingKeys: String, CodingKey { case userId = "user_id", rank }
    }
    let day: String
    let data: [Entry]
}

struct ChatMessage: Identifiable, Sendable, Hashable, Codable {
    enum Role: String, Codable, Sendable { case user, assistant }
    var id = UUID()
    let role: Role
    var content: String

    enum CodingKeys: String, CodingKey { case role, content }
}

struct GoalUpdate: Encodable, Sendable {
    var currentValue: Double
    var targetValue: Double?
    var unit: String?
    var status: GoalStatus
    var note: String?
}

struct NewGoal: Encodable, Sendable {
    var title: String
    var unit: String?
    var targetValue: Double?
    var targetDate: String?
}

struct IngestResult: Decodable, Sendable {
    let ingested: Int
    let error: String?
}
