import SwiftUI

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255,
                  opacity: opacity)
    }

    // "Operating in the shadows" — no pink, no purple, no gradients.
    static let sfBackground = Color(hex: 0x06080F)
    static let sfSurface = Color(hex: 0x0B1020)
    static let sfLine = Color(hex: 0x1A2240)
    static let sfText = Color(hex: 0xE8ECFF)
    static let sfMuted = Color(hex: 0x8A93B2)
    static let sfSteel = Color(hex: 0x2F7DFF)
    static let sfDeepSteel = Color(hex: 0x1D3A7A)
    static let sfAmber = Color(hex: 0xF5A524)
    static let sfRed = Color(hex: 0xFF4326)

    /// Score → red (low) → amber → steel blue (high), same stops as the web.
    static func score(_ s: Double) -> Color {
        let stops: [(Double, (Double, Double, Double))] = [(40, (255, 67, 38)), (65, (245, 165, 36)), (90, (47, 125, 255))]
        let x = max(stops[0].0, min(stops[2].0, s))
        let i = x <= stops[1].0 ? 0 : 1
        let (x0, c0) = stops[i], (x1, c1) = stops[i + 1]
        let t = (x - x0) / (x1 - x0)
        return Color(.sRGB, red: (c0.0 + (c1.0 - c0.0) * t) / 255, green: (c0.1 + (c1.1 - c0.1) * t) / 255,
                     blue: (c0.2 + (c1.2 - c0.2) * t) / 255)
    }

    static func goal(_ s: GoalStatus) -> Color {
        switch s {
        case .onTrack: .sfSteel
        case .atRisk: .sfAmber
        case .behind: .sfRed
        case .hit: .sfText
        }
    }
}

/// Solid off-white wordmark.
struct Wordmark: View {
    var body: some View {
        Text("THE SHADOW FORUM")
            .font(.system(.footnote, weight: .heavy))
            .tracking(3)
            .foregroundStyle(Color.sfText)
            .accessibilityLabel("The Shadow Forum")
            .accessibilityAddTraits(.isHeader)
    }
}

struct Card<Content: View>: View {
    var title: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Text(title.uppercased())
                    .font(.caption.weight(.semibold))
                    .tracking(1.2)
                    .foregroundStyle(Color.sfMuted)
                    .accessibilityAddTraits(.isHeader)
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.sfSurface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.sfLine, lineWidth: 1))
    }
}

/// Big bold number with a small label under it.
struct StatTile: View {
    let value: String
    let label: String
    var color: Color = .sfText

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.title2.weight(.bold).monospacedDigit())
                .foregroundStyle(color)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(label)
                .font(.caption)
                .foregroundStyle(Color.sfMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

struct GoalChip: View {
    let status: GoalStatus
    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 7).padding(.vertical, 2)
            .foregroundStyle(Color.goal(status))
            .overlay(Capsule().stroke(Color.goal(status).opacity(0.7), lineWidth: 1))
            .accessibilityLabel("Goal \(status.label)")
    }
}

/// Red "!" — no WHOOP upload in over a week.
struct OverdueBadge: View {
    var body: some View {
        Text("!")
            .font(.caption.weight(.black))
            .foregroundStyle(Color.sfBackground)
            .frame(width: 18, height: 18)
            .background(Color.sfRed, in: Circle())
            .accessibilityLabel("Upload overdue")
    }
}

/// Horizontal 0–100 bar.
struct MeterBar: View {
    let pct: Double
    var color: Color = .sfSteel
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.sfLine)
                Capsule().fill(color).frame(width: g.size.width * max(0, min(100, pct)) / 100)
            }
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}

struct LoadingOrError: View {
    let error: String?
    var retry: () async -> Void

    var body: some View {
        VStack(spacing: 12) {
            if let error {
                Text(error).foregroundStyle(Color.sfMuted).multilineTextAlignment(.center)
                Button("Try again") { Task { await retry() } }.buttonStyle(.bordered)
            } else {
                ProgressView().tint(.sfSteel)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 240)
    }
}

extension View {
    /// Screen chrome: dark background, off-white text.
    func shadowScreen() -> some View {
        self
            .scrollContentBackground(.hidden)
            .background(Color.sfBackground.ignoresSafeArea())
            .foregroundStyle(Color.sfText)
            .toolbarBackground(Color.sfBackground, for: .navigationBar, .tabBar)
            .toolbarBackground(.visible, for: .navigationBar, .tabBar)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 48)
            .foregroundStyle(Color.white)
            .background(Color.sfSteel.opacity(configuration.isPressed ? 0.7 : 1), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct ShadowField: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(Color.sfSurface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.sfLine))
            .foregroundStyle(Color.sfText)
    }
}

extension View {
    func shadowField() -> some View { modifier(ShadowField()) }
}
