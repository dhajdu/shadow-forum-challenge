import SwiftUI

struct GoalCard: View {
    let goal: Goal
    var onUpdate: () -> Void

    var body: some View {
        Card(title: "Business goal") {
            HStack(alignment: .top) {
                Text(goal.title).font(.headline)
                Spacer()
                GoalChip(status: goal.currentStatus)
            }
            MeterBar(pct: Double(goal.currentProgress), color: .goal(goal.currentStatus))
            Text(progressLine).font(.subheadline.monospacedDigit()).foregroundStyle(Color.sfMuted)
            Button("Update progress", action: onUpdate)
                .buttonStyle(.bordered)
        }
    }

    private var progressLine: String {
        let unit = goal.unit.map { " \($0)" } ?? ""
        let of = goal.targetValue.map { " of \(Fmt.one($0))\(unit)" } ?? ""
        return "\(Fmt.one(goal.currentValue))\(unit)\(of) · \(goal.currentProgress)%"
    }
}

/// Current / target / unit / status / note — saved through PATCH /api/goal (progress % and the
/// coach's log are computed server-side).
struct GoalEditorSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    let goal: Goal
    var onSaved: () async -> Void

    @State private var current = ""
    @State private var target = ""
    @State private var unit = ""
    @State private var status: GoalStatus = .onTrack
    @State private var note = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section { Text(goal.title).font(.headline) }
                Section("Measure") {
                    LabeledContent("Current") {
                        TextField("0", text: $current).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Target") {
                        TextField("e.g. 3", text: $target).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Unit") {
                        TextField("e.g. deals", text: $unit).multilineTextAlignment(.trailing)
                    }
                }
                Section("Status this month") {
                    Picker("Status", selection: $status) {
                        ForEach(GoalStatus.allCases) { Text($0.label.capitalized).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("Update note (goes to your coach)") {
                    TextField("Type an update…", text: $note, axis: .vertical).lineLimit(2...5)
                }
                if let error { Text(error).foregroundStyle(Color.sfRed) }
            }
            .scrollContentBackground(.hidden)
            .background(Color.sfBackground)
            .navigationTitle("Update progress")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if busy { ProgressView() } else { Button("Save") { Task { await save() } }.bold() }
                }
            }
        }
        .onAppear {
            current = Fmt.one(goal.currentValue)
            target = goal.targetValue.map(Fmt.one) ?? ""
            unit = goal.unit ?? ""
            status = goal.currentStatus
        }
    }

    private func number(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".")) }

    private func save() async {
        guard let c = number(current.isEmpty ? "0" : current) else { error = "Current must be a number."; return }
        if !target.isEmpty && number(target) == nil { error = "Target must be a number."; return }
        busy = true; error = nil
        defer { busy = false }
        do {
            try await app.backend.updateGoal(GoalUpdate(
                currentValue: c, targetValue: number(target), unit: unit.isEmpty ? nil : unit,
                status: status, note: note.isEmpty ? nil : note
            ))
            await onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Personal goals that don't count toward the contest. Owner-only rows, edited directly.
struct ExtraCreditCard: View {
    @Environment(AppModel.self) private var app
    let goals: [PersonalGoal]
    var reload: () async -> Void

    @State private var adding = false
    @State private var editing: PersonalGoal?
    @State private var editValue = ""
    @State private var newTitle = ""
    @State private var newTarget = ""
    @State private var newUnit = ""

    var body: some View {
        Card(title: "Extra Credit") {
            Text("Personal goals — just for you. These don't count toward the contest.")
                .font(.footnote).foregroundStyle(Color.sfMuted)
            ForEach(goals) { g in
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(g.title).font(.subheadline.weight(.semibold))
                        Text(line(g)).font(.caption.monospacedDigit()).foregroundStyle(Color.sfMuted)
                        if let p = g.pct { MeterBar(pct: Double(p)) }
                    }
                    Spacer()
                    Menu {
                        Button("Update", systemImage: "pencil") { editValue = Fmt.one(g.currentValue); editing = g }
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            Task { try? await app.backend.deletePersonalGoal(id: g.id); await reload() }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").font(.title3)
                    }
                    .accessibilityLabel("Options for \(g.title)")
                }
                .accessibilityElement(children: .contain)
            }
            Button("Add personal goal", systemImage: "plus") { adding = true }
                .buttonStyle(.bordered)
        }
        .alert("Update \(editing?.title ?? "")", isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })) {
            TextField("Current", text: $editValue).keyboardType(.decimalPad)
            Button("Save") {
                if let g = editing, let v = Double(editValue.replacingOccurrences(of: ",", with: ".")) {
                    Task { try? await app.backend.updatePersonalGoal(id: g.id, current: v); await reload() }
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("New personal goal", isPresented: $adding) {
            TextField("Goal", text: $newTitle)
            TextField("Target (optional)", text: $newTarget).keyboardType(.decimalPad)
            TextField("Unit (optional)", text: $newUnit)
            Button("Add") {
                let title = newTitle.trimmingCharacters(in: .whitespaces)
                let target = Double(newTarget.replacingOccurrences(of: ",", with: "."))
                let unit = newUnit.isEmpty ? nil : newUnit
                newTitle = ""; newTarget = ""; newUnit = ""
                guard !title.isEmpty else { return }
                Task { try? await app.backend.addPersonalGoal(title: title, unit: unit, target: target); await reload() }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func line(_ g: PersonalGoal) -> String {
        let unit = g.unit.map { " \($0)" } ?? ""
        var s = "\(Fmt.one(g.currentValue))\(unit)"
        if let t = g.targetValue { s += " of \(Fmt.one(t))\(unit)" }
        if let p = g.pct { s += " · \(p)%" }
        return s
    }
}
