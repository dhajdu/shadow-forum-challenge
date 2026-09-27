import SwiftUI

/// The WHOOP data assistant — streams plain text from /api/assistant. It only sees your own data.
struct ChatView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var streaming = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private let starters = ["How did I sleep this week?", "What's hurting my recovery?", "How do I climb a place?"]

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if messages.isEmpty {
                            Text("Ask about your own WHOOP data — recovery, sleep, strain, your journal. Nobody else's data is visible to it.")
                                .font(.subheadline).foregroundStyle(Color.sfMuted)
                            ForEach(starters, id: \.self) { s in
                                Button(s) { input = s; Task { await send() } }
                                    .buttonStyle(.bordered)
                            }
                        }
                        ForEach(messages) { m in
                            Bubble(message: m).id(m.id)
                        }
                        if let error {
                            Text(error).font(.footnote).foregroundStyle(Color.sfRed)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: messages.last?.content) {
                    if let id = messages.last?.id { proxy.scrollTo(id, anchor: .bottom) }
                }
            }
            .safeAreaInset(edge: .bottom) { composer }
            .navigationTitle("Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .shadowScreen()
        }
        .presentationDragIndicator(.visible)
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Ask about your data…", text: $input, axis: .vertical)
                .lineLimit(1...4)
                .focused($focused)
                .shadowField()
                .onSubmit { Task { await send() } }
            Button {
                Task { await send() }
            } label: {
                Image(systemName: streaming ? "ellipsis" : "arrow.up")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Color.sfSteel, in: Circle())
            }
            .disabled(streaming || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.sfBackground)
    }

    private func send() async {
        let q = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !streaming else { return }
        input = ""; error = nil; streaming = true
        defer { streaming = false }
        messages.append(ChatMessage(role: .user, content: q))
        let history = messages
        messages.append(ChatMessage(role: .assistant, content: ""))
        let i = messages.count - 1
        do {
            for try await chunk in app.backend.chat(history) {
                messages[i].content += chunk
            }
            UIAccessibility.post(notification: .announcement, argument: messages[i].content)
        } catch {
            self.error = error.localizedDescription
            if messages[i].content.isEmpty { messages.remove(at: i) }
        }
    }
}

private struct Bubble: View {
    let message: ChatMessage
    var body: some View {
        let mine = message.role == .user
        HStack {
            if mine { Spacer(minLength: 40) }
            Group {
                if message.content.isEmpty {
                    ProgressView().tint(.sfMuted)
                } else {
                    Text(message.content).textSelection(.enabled)
                }
            }
            .font(.body)
            .padding(12)
            .background(mine ? Color.sfDeepSteel : Color.sfSurface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(mine ? Color.clear : Color.sfLine))
            if !mine { Spacer(minLength: 40) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel((mine ? "You: " : "Assistant: ") + message.content)
    }
}
