import Foundation
import Observation
import Supabase

@MainActor @Observable
final class AppModel {
    enum Phase: Equatable { case loading, unconfigured, signedOut, needsGoal, ready }
    enum Tab: Hashable { case race, zone, upload, more }

    var phase: Phase = .loading
    var userId: String = ""
    var tab: Tab = .race
    var showChat = false
    /// A WHOOP export handed to the app (share extension inbox or "Open in…"), waiting to upload.
    var pendingFile: URL?

    let backend: any ForumBackend
    private let live: LiveBackend?

    /// Debug-only: open straight to one screen (`-screen rider`), for simulator screenshots.
    var debugScreen: String? {
        #if DEBUG
        UserDefaults.standard.string(forKey: "screen")
        #else
        nil
        #endif
    }

    init() {
        if AppConfig.isDemo {
            backend = DemoBackend(); live = nil
        } else if AppConfig.isConfigured, let url = AppConfig.supabaseURL {
            let l = LiveBackend(url: url, anonKey: AppConfig.supabaseAnonKey, api: AppConfig.apiBaseURL)
            backend = l; live = l
        } else {
            backend = DemoBackend(); live = nil; phase = .unconfigured
        }
    }

    /// Follows the Supabase session for the life of the app.
    func start() async {
        guard phase != .unconfigured else { return }
        guard let live else { return await resolve() }
        for await (event, _) in live.client.auth.authStateChanges {
            switch event {
            case .initialSession, .signedIn, .signedOut, .userDeleted: await resolve()
            default: break
            }
        }
    }

    /// Signed in? Has a goal? (The web sends riders without a goal to onboarding.)
    func resolve() async {
        guard let id = await backend.userId else {
            userId = ""; phase = .signedOut; return
        }
        userId = id
        do {
            phase = try await backend.goal(userId: id) == nil ? .needsGoal : .ready
            switch debugScreen {
            case "zone": tab = .zone
            case "upload": tab = .upload
            case "more", "rules", "report": tab = .more
            case "chat": showChat = true
            case "signin": phase = .signedOut
            case "onboarding": phase = .needsGoal
            default: break
            }
        } catch {
            phase = .ready // offline — let the screens show their own errors
        }
        checkInbox()
    }

    func signOut() async {
        try? await backend.signOut()
        tab = .race
        if live == nil { await resolve() }
    }

    // MARK: Incoming files

    func handle(url: URL) {
        if url.isFileURL {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            if let copy = Self.copyToTemp(url) { receive(copy) }
        } else if url.scheme == "shadowforum" {
            checkInbox()
        }
    }

    /// Picks up an export the share extension saved into the shared App Group container.
    func checkInbox() {
        guard phase == .ready,
              let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: AppConfig.appGroup)?
                .appending(path: "Inbox"),
              let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.creationDateKey]),
              let file = files.sorted(by: { $0.lastPathComponent > $1.lastPathComponent }).first,
              let copy = Self.copyToTemp(file)
        else { return }
        for f in files { try? FileManager.default.removeItem(at: f) }
        receive(copy)
    }

    private func receive(_ file: URL) {
        pendingFile = file
        tab = .upload
    }

    private static func copyToTemp(_ url: URL) -> URL? {
        let name = url.lastPathComponent.replacingOccurrences(of: #"^\d+-"#, with: "", options: .regularExpression)
        let dest = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString).appending(path: name)
        do {
            try FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: url, to: dest)
            return dest
        } catch {
            return nil
        }
    }
}
