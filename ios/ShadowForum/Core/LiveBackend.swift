import Foundation
import Supabase

/// Talks to the shared Supabase project as the signed-in rider, and to the web API with
/// their access token. Only the public anon key is in the app.
final class LiveBackend: ForumBackend {
    let client: SupabaseClient
    private let api: URL

    init(url: URL, anonKey: String, api: URL) {
        client = SupabaseClient(
            supabaseURL: url,
            supabaseKey: anonKey,
            options: .init(auth: .init(emitLocalSessionAsInitialSession: true))
        )
        self.api = api
    }

    var userId: String? {
        get async { try? await client.auth.session.user.id.uuidString.lowercased() }
    }

    private func uid() async throws -> String {
        guard let id = await userId else { throw ForumError("Not signed in.") }
        return id
    }

    // MARK: Auth

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(code: String, name: String, email: String, password: String) async throws {
        struct Body: Encodable { let code, name, email, password: String }
        try await post("/api/signup", Body(code: code, name: name, email: email, password: password), auth: false)
        try await signIn(email: email, password: password)
    }

    func signOut() async throws { try await client.auth.signOut() }

    // MARK: Reads (RLS)

    func standings() async throws -> [Standing] {
        try await client.from("race_standings").select().execute().value
    }

    func goalSummaries() async throws -> [GoalSummary] {
        try await client.from("goals").select("user_id, title, current_status").execute().value
    }

    func goal(userId: String) async throws -> Goal? {
        let rows: [Goal] = try await client.from("goals")
            .select("id, title, unit, target_value, current_value, current_status, current_progress")
            .eq("user_id", value: userId).limit(1).execute().value
        return rows.first
    }

    func profile(id: String) async throws -> Profile? {
        let rows: [Profile] = try await client.from("profiles").select("id, full_name, avatar_url")
            .eq("id", value: id).limit(1).execute().value
        return rows.first
    }

    func days(userId: String) async throws -> [WhoopDay] {
        // page past PostgREST's 1000-row cap — years of WHOOP history add up
        var all: [WhoopDay] = []
        let page = 1000
        while true {
            let rows: [WhoopDay] = try await client.from("whoop_days")
                .select("day, score, recovery, sleep, strain, resting_hr, hrv")
                .eq("user_id", value: userId)
                .order("day", ascending: true)
                .range(from: all.count, to: all.count + page - 1)
                .execute().value
            all += rows
            if rows.count < page { return all }
        }
    }

    func latestAnalysis(userId: String) async throws -> JournalAnalysis? {
        do {
            let rows: [JournalAnalysis] = try await client.from("journal_analyses")
                .select("week_of, headline, insights, suggestion")
                .eq("user_id", value: userId)
                .order("week_of", ascending: false).limit(1).execute().value
            return rows.first
        } catch {
            return nil // table not deployed yet, or nothing written — the card shows its empty state
        }
    }

    func uploads(userId: String) async throws -> [Upload] {
        try await client.from("uploads").select("id, file_name, status, rows_ingested, created_at")
            .eq("user_id", value: userId).order("created_at", ascending: false).limit(20).execute().value
    }

    func snapshot(before day: String) async throws -> StandingsSnapshot? {
        let rows: [StandingsSnapshot] = try await client.from("standings_snapshots").select("day, data")
            .lt("day", value: day).order("day", ascending: false).limit(1).execute().value
        return rows.first
    }

    func snapshot(onOrAfter day: String) async throws -> StandingsSnapshot? {
        let rows: [StandingsSnapshot] = try await client.from("standings_snapshots").select("day, data")
            .gte("day", value: day).order("day", ascending: true).limit(1).execute().value
        return rows.first
    }

    // MARK: Extra credit (owner-only CRUD, no server logic)

    func personalGoals(userId: String) async throws -> [PersonalGoal] {
        try await client.from("personal_goals").select("id, title, unit, target_value, current_value")
            .eq("user_id", value: userId).order("created_at", ascending: true).execute().value
    }

    func addPersonalGoal(title: String, unit: String?, target: Double?) async throws {
        struct Row: Encodable {
            let user_id, title: String
            let unit: String?
            let target_value: Double?
            let current_value: Double
        }
        try await client.from("personal_goals")
            .insert(Row(user_id: try await uid(), title: title, unit: unit, target_value: target, current_value: 0))
            .execute()
    }

    func updatePersonalGoal(id: String, current: Double) async throws {
        try await client.from("personal_goals").update(["current_value": current])
            .eq("id", value: id).eq("user_id", value: try await uid()).execute()
    }

    func deletePersonalGoal(id: String) async throws {
        try await client.from("personal_goals").delete()
            .eq("id", value: id).eq("user_id", value: try await uid()).execute()
    }

    // MARK: Business goal (web API — progress % and coach log are server-side)

    func createGoal(_ goal: NewGoal) async throws { try await send("POST", "/api/goal", goal) }
    func updateGoal(_ update: GoalUpdate) async throws { try await send("PATCH", "/api/goal", update) }

    // MARK: Upload + ingest

    func uploadWhoop(fileName: String, data: Data, stage: @Sendable (UploadStage) async -> Void) async throws -> Int {
        let userId = try await uid()
        let safeName = fileName.replacingOccurrences(of: "/", with: "_")
        let ms = Int(Date().timeIntervalSince1970 * 1000)
        let path = "\(userId)/\(ms)_\(safeName)"
        let isZip = safeName.lowercased().hasSuffix(".zip")

        await stage(.uploading)
        try await client.storage.from("whoop").upload(
            path, data: data, options: FileOptions(contentType: isZip ? "application/zip" : "text/csv", upsert: false)
        )

        struct NewUpload: Encodable { let user_id, file_path, file_name, status: String }
        struct Row: Decodable { let id: String }
        let row: Row = try await client.from("uploads")
            .insert(NewUpload(user_id: userId, file_path: path, file_name: safeName, status: "uploaded"))
            .select("id").single().execute().value

        await stage(.processing)
        struct Body: Encodable { let uploadId: String }
        let result: IngestResult = try await post("/api/ingest", Body(uploadId: row.id))
        if let error = result.error { throw ForumError(error) }
        return result.ingested
    }

    // MARK: Assistant

    func chat(_ messages: [ChatMessage]) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    struct Body: Encodable { let messages: [ChatMessage] }
                    var req = try await request("POST", "/api/assistant", auth: true)
                    req.httpBody = try JSONEncoder().encode(Body(messages: messages))
                    let (bytes, response) = try await URLSession.shared.bytes(for: req)
                    guard let http = response as? HTTPURLResponse else { throw ForumError("No response.") }
                    if http.statusCode != 200 {
                        var data = Data()
                        for try await b in bytes { data.append(b) }
                        throw Self.apiError(data, status: http.statusCode)
                    }
                    // plain text, token by token — flush whenever the buffer is valid UTF-8
                    var buffer = Data()
                    for try await b in bytes {
                        buffer.append(b)
                        if let text = String(data: buffer, encoding: .utf8) {
                            continuation.yield(text)
                            buffer.removeAll(keepingCapacity: true)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: HTTP

    private func request(_ method: String, _ path: String, auth: Bool) async throws -> URLRequest {
        var req = URLRequest(url: api.appending(path: path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 90
        if auth {
            let token = try await client.auth.session.accessToken // refreshed if needed
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private func post<B: Encodable, R: Decodable>(_ path: String, _ body: B, auth: Bool = true) async throws -> R {
        try await sendDecoding("POST", path, body, auth: auth)
    }

    private func post<B: Encodable>(_ path: String, _ body: B, auth: Bool = true) async throws {
        let _: Empty = try await sendDecoding("POST", path, body, auth: auth)
    }

    private func send<B: Encodable>(_ method: String, _ path: String, _ body: B) async throws {
        let _: Empty = try await sendDecoding(method, path, body, auth: true)
    }

    private struct Empty: Decodable {}

    private func sendDecoding<B: Encodable, R: Decodable>(_ method: String, _ path: String, _ body: B, auth: Bool) async throws -> R {
        var req = try await request(method, path, auth: auth)
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw Self.apiError(data, status: status) }
        return try JSONDecoder().decode(R.self, from: data)
    }

    private static func apiError(_ data: Data, status: Int) -> ForumError {
        struct E: Decodable { let error: String? }
        if let e = try? JSONDecoder().decode(E.self, from: data), let msg = e.error { return ForumError(msg) }
        return ForumError(status == 401 ? "Your session expired — sign in again." : "Server error (\(status)).")
    }
}
