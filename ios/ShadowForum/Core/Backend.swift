import Foundation

enum UploadStage: Sendable, Equatable {
    case uploading, processing
}

/// Everything the screens need from the backend. Reads go straight to Supabase (RLS applies);
/// anything with server-side logic (ingest, sign-up, goals, assistant) goes through the web API.
protocol ForumBackend: Sendable {
    var userId: String? { get async }

    func signIn(email: String, password: String) async throws
    func signUp(code: String, name: String, email: String, password: String) async throws
    func signOut() async throws

    func standings() async throws -> [Standing]
    func goalSummaries() async throws -> [GoalSummary]
    func goal(userId: String) async throws -> Goal?
    func profile(id: String) async throws -> Profile?
    func days(userId: String) async throws -> [WhoopDay]
    func latestAnalysis(userId: String) async throws -> JournalAnalysis?
    func uploads(userId: String) async throws -> [Upload]
    /// Newest snapshot strictly before `day`.
    func snapshot(before day: String) async throws -> StandingsSnapshot?
    /// Oldest snapshot on or after `day`.
    func snapshot(onOrAfter day: String) async throws -> StandingsSnapshot?

    func personalGoals(userId: String) async throws -> [PersonalGoal]
    func addPersonalGoal(title: String, unit: String?, target: Double?) async throws
    func updatePersonalGoal(id: String, current: Double) async throws
    func deletePersonalGoal(id: String) async throws

    func createGoal(_ goal: NewGoal) async throws
    func updateGoal(_ update: GoalUpdate) async throws

    /// Upload a WHOOP export to Storage, record it, and ingest it via POST /api/ingest.
    func uploadWhoop(fileName: String, data: Data, stage: @Sendable (UploadStage) async -> Void) async throws -> Int

    /// Stream the assistant's plain-text reply.
    func chat(_ messages: [ChatMessage]) -> AsyncThrowingStream<String, Error>
}

struct ForumError: LocalizedError, Sendable {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}
