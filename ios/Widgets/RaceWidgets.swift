import SwiftUI
import WidgetKit

private let steel = Color(red: 0x2F / 255, green: 0x7D / 255, blue: 1)
private let amber = Color(red: 0xF5 / 255, green: 0xA5 / 255, blue: 0x24 / 255)
private let ink = Color(red: 0xE8 / 255, green: 0xEC / 255, blue: 1)
private let muted = Color(red: 0x8A / 255, green: 0x93 / 255, blue: 0xB2 / 255)
private let bg = Color(red: 0x06 / 255, green: 0x08 / 255, blue: 0x0F / 255)

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct SnapshotProvider: TimelineProvider {
    private var group: String { Bundle.main.object(forInfoDictionaryKey: "SFAppGroup") as? String ?? "" }

    func placeholder(in context: Context) -> SnapshotEntry { .init(date: .now, snapshot: .placeholder) }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(.init(date: .now, snapshot: context.isPreview ? .placeholder : WidgetSnapshot.load(group: group)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let entry = SnapshotEntry(date: .now, snapshot: WidgetSnapshot.load(group: group))
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(3600))))
    }
}

private func ordinal(_ n: Int) -> String {
    if (11...13).contains(n % 100) { return "\(n)th" }
    return "\(n)" + (n % 10 == 1 ? "st" : n % 10 == 2 ? "nd" : n % 10 == 3 ? "rd" : "th")
}

private func one(_ x: Double) -> String { String(format: "%.1f", x) }

struct MyPlaceView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SnapshotEntry

    var body: some View {
        if let s = entry.snapshot, let place = s.myPlace {
            if family == .accessoryRectangular {
                VStack(alignment: .leading) {
                    Text("Shadow Forum").font(.caption2.bold())
                    Text("\(ordinal(place)) of \(s.riders)").font(.headline)
                    Text("avg \(s.myAvg.map(one) ?? "—")").font(.caption)
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MY PLACE").font(.caption2.weight(.bold)).tracking(1).foregroundStyle(muted)
                    Text(ordinal(place)).font(.system(.largeTitle, weight: .heavy)).foregroundStyle(place == 1 ? amber : ink)
                    Text("of \(s.riders)").font(.caption).foregroundStyle(muted)
                    Spacer(minLength: 0)
                    Text(s.myAvg.map(one) ?? "—").font(.title2.bold().monospacedDigit()).foregroundStyle(steel)
                    Text("race avg · day \(s.contestDay)").font(.caption2).foregroundStyle(muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            Text("Open Shadow Forum to load the race.").font(.caption).foregroundStyle(muted)
        }
    }
}

struct TopThreeView: View {
    let entry: SnapshotEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("THE RACE · TOP 3").font(.caption2.weight(.bold)).tracking(1).foregroundStyle(muted)
            if let s = entry.snapshot, !s.top.isEmpty {
                ForEach(Array(s.top.enumerated()), id: \.offset) { i, r in
                    HStack {
                        Text("\(i + 1)").font(.subheadline.bold()).foregroundStyle(i == 0 ? amber : muted).frame(width: 16)
                        Text(r.name).font(.subheadline.weight(r.isMe ? .bold : .regular)).foregroundStyle(ink).lineLimit(1)
                        Spacer()
                        Text(r.avg.map(one) ?? "—").font(.subheadline.bold().monospacedDigit()).foregroundStyle(i == 0 ? amber : steel)
                    }
                }
                Spacer(minLength: 0)
                Text("Contest day \(s.contestDay)/91").font(.caption2).foregroundStyle(muted)
            } else {
                Text("Open Shadow Forum to load the race.").font(.caption).foregroundStyle(muted)
            }
        }
    }
}

struct MyPlaceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MyPlace", provider: SnapshotProvider()) { entry in
            MyPlaceView(entry: entry).containerBackground(bg, for: .widget)
        }
        .configurationDisplayName("My place")
        .description("Your place and race average.")
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}

struct TopThreeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TopThree", provider: SnapshotProvider()) { entry in
            TopThreeView(entry: entry).containerBackground(bg, for: .widget)
        }
        .configurationDisplayName("Race top 3")
        .description("The top three riders.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct RaceWidgetBundle: WidgetBundle {
    var body: some Widget {
        MyPlaceWidget()
        TopThreeWidget()
    }
}
