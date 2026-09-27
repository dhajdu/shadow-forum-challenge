import Foundation

/// Build-time configuration, injected from Config/*.xcconfig through Info.plist.
enum AppConfig {
    private static func value(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
    }

    static var supabaseURL: URL? { URL(string: value("SFSupabaseURL")) }
    static var supabaseAnonKey: String { value("SFSupabaseAnonKey") }
    static var apiBaseURL: URL { URL(string: value("SFAPIBaseURL")) ?? URL(string: "https://eoshadowforum.com")! }
    static var appGroup: String { value("SFAppGroup") }

    /// False until Secrets.xcconfig is filled in.
    static var isConfigured: Bool {
        guard let host = supabaseURL?.host, !host.contains("YOUR-PROJECT") else { return false }
        return !supabaseAnonKey.isEmpty && supabaseAnonKey != "your-anon-key"
    }

    /// Debug-only offline mode with fixture data (launch argument `-demo`), for previews and screenshots.
    static var isDemo: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-demo")
        #else
        false
        #endif
    }
}
