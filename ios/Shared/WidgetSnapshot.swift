import Foundation

/// The little bit of race state the widgets show. The app writes it to the shared App Group
/// after each Race load; widgets never talk to the network or hold credentials.
struct WidgetSnapshot: Codable, Sendable {
    struct Rider: Codable, Sendable, Hashable { let name: String; let avg: Double?; let isMe: Bool }

    let myPlace: Int?
    let riders: Int
    let myAvg: Double?
    let top: [Rider]
    let contestDay: Int
    let updated: Date

    private static let key = "widgetSnapshot"

    static func load(group: String) -> WidgetSnapshot? {
        guard let data = UserDefaults(suiteName: group)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    func save(group: String) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: group)?.set(data, forKey: Self.key)
    }

    static let placeholder = WidgetSnapshot(
        myPlace: 2, riders: 5, myAvg: 74.3,
        top: [.init(name: "Minh", avg: 76.1, isMe: false), .init(name: "You", avg: 74.3, isMe: true), .init(name: "Lan", avg: 66.0, isMe: false)],
        contestDay: 5, updated: .now
    )
}
