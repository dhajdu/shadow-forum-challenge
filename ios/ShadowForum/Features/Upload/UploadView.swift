import SwiftUI
import UniformTypeIdentifiers

struct UploadView: View {
    enum Status: Equatable {
        case idle, reading, uploading, processing
        case done(Int)
        case failed(String)
    }

    @Environment(AppModel.self) private var app
    @State private var status: Status = .idle
    @State private var picking = false
    @State private var uploads: [Upload] = []

    private var busy: Bool { [.reading, .uploading, .processing].contains(status) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Upload WHOOP data").font(.largeTitle.bold())
                Card(title: "How") {
                    Label("Request a data export in the WHOOP app — WHOOP emails you a .zip.", systemImage: "1.circle")
                    Label("Share the .zip to Shadow Forum, or pick it from Files below.", systemImage: "2.circle")
                    Label("Re-uploading is safe — newer numbers replace older ones.", systemImage: "arrow.triangle.2.circlepath")
                }
                .font(.subheadline)

                Button {
                    picking = true
                } label: {
                    Label("Choose WHOOP export", systemImage: "doc.zipper")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy)

                if status != .idle { progressCard }

                if !uploads.isEmpty {
                    Card(title: "Recent uploads") {
                        ForEach(uploads) { u in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(u.fileName).font(.subheadline).lineLimit(1).truncationMode(.middle)
                                    Text(Day.short(String(u.createdAt.prefix(10)))
                                         + (u.rowsIngested.map { " · \($0) days" } ?? ""))
                                        .font(.caption).foregroundStyle(Color.sfMuted)
                                }
                                Spacer()
                                Text(u.status)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(u.status == "error" ? Color.sfRed : u.status == "parsed" ? Color.sfSteel : Color.sfMuted)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 60)
        }
        .fileImporter(isPresented: $picking, allowedContentTypes: [.zip, .commaSeparatedText]) { result in
            if case .success(let url) = result { Task { await upload(url) } }
        }
        .task { await loadUploads() }
        .onChange(of: app.pendingFile, initial: true) { _, file in
            // a shared / opened export — upload it outside the view's task so clearing it can't cancel
            guard let file, !busy else { return }
            app.pendingFile = nil
            Task { await upload(file) }
        }
        .navigationTitle("Upload")
        .navigationBarTitleDisplayMode(.inline)
        .shadowScreen()
    }

    private var progressCard: some View {
        Card(title: "Progress") {
            step("Read file", done: status != .reading, active: status == .reading)
            step("Upload to the forum", done: [.processing].contains(status) || isDone, active: status == .uploading)
            step("Parse & score days", done: isDone, active: status == .processing)
            switch status {
            case .done(let n):
                Text("Done — \(n) days ingested. The race is up to date.")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(Color.sfSteel)
            case .failed(let msg):
                Text(msg).font(.subheadline).foregroundStyle(Color.sfRed)
            default:
                EmptyView()
            }
        }
    }

    private var isDone: Bool { if case .done = status { true } else { false } }

    private func step(_ title: String, done: Bool, active: Bool) -> some View {
        let failed = { if case .failed = status { return true } else { return false } }()
        return HStack(spacing: 10) {
            Group {
                if active { ProgressView().tint(.sfSteel) }
                else if done && !failed { Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.sfSteel) }
                else { Image(systemName: "circle").foregroundStyle(Color.sfMuted) }
            }
            .frame(width: 22)
            Text(title).font(.subheadline)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title), \(active ? "in progress" : done && !failed ? "done" : "waiting")")
    }

    private func upload(_ url: URL) async {
        status = .reading
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            status = .failed("Couldn't read that file."); return
        }
        do {
            let n = try await app.backend.uploadWhoop(fileName: url.lastPathComponent, data: data) { stage in
                await MainActor.run { status = stage == .uploading ? .uploading : .processing }
            }
            status = .done(n)
            UIAccessibility.post(notification: .announcement, argument: "Upload done, \(n) days ingested")
        } catch {
            status = .failed(error.localizedDescription)
        }
        await loadUploads()
    }

    private func loadUploads() async {
        uploads = (try? await app.backend.uploads(userId: app.userId)) ?? uploads
    }
}
