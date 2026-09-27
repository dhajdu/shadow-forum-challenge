import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var app
    @State private var creating = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?

    private var valid: Bool {
        !email.isEmpty && password.count >= 6 && (!creating || (!name.isEmpty && !code.isEmpty))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Wordmark().padding(.top, 48)
                VStack(alignment: .leading, spacing: 6) {
                    Text(creating ? "Join the forum" : "Enter the shadow")
                        .font(.largeTitle.bold())
                    Text("Private, invite-only. Five riders, one race.")
                        .foregroundStyle(Color.sfMuted)
                }

                VStack(spacing: 12) {
                    if creating {
                        TextField("Full name", text: $name)
                            .textContentType(.name)
                            .shadowField()
                    }
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .shadowField()
                    SecureField("Password", text: $password)
                        .textContentType(creating ? .newPassword : .password)
                        .shadowField()
                    if creating {
                        SecureField("Access code", text: $code)
                            .textContentType(.oneTimeCode)
                            .shadowField()
                    }
                }

                if let error {
                    Text(error).font(.callout).foregroundStyle(Color.sfRed)
                }

                Button {
                    Task { await submit() }
                } label: {
                    if busy { ProgressView().tint(.white) } else { Text(creating ? "Create account" : "Sign in") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!valid || busy)
                .opacity(valid ? 1 : 0.5)

                Button(creating ? "Have an account? Sign in" : "Have an access code? Create an account") {
                    creating.toggle(); error = nil
                }
                .font(.callout)
                .frame(maxWidth: .infinity)
            }
            .padding(24)
        }
        .shadowScreen()
    }

    private func submit() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            if creating {
                try await app.backend.signUp(code: code, name: name, email: email, password: password)
            } else {
                try await app.backend.signIn(email: email, password: password)
            }
            if AppConfig.isDemo { await app.resolve() }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// First run: every rider commits to one locked Q4 business goal (same as the web's /welcome).
struct GoalOnboardingView: View {
    @Environment(AppModel.self) private var app
    @State private var title = ""
    @State private var target = ""
    @State private var unit = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Wordmark().padding(.top, 32)
                Text("Your Q4 business goal").font(.largeTitle.bold())
                Text("One goal, locked once set. Hit it and you pay nothing. Miss it and \(Race.missedGoalPenalty)M VND is owed by you — and \(Race.coachSharePenalty)M by your coach.")
                    .foregroundStyle(Color.sfMuted)
                TextField("e.g. Close 3 enterprise deals", text: $title, axis: .vertical).shadowField()
                HStack {
                    TextField("Target (optional)", text: $target).keyboardType(.decimalPad).shadowField()
                    TextField("Unit", text: $unit).shadowField()
                }
                if let error { Text(error).foregroundStyle(Color.sfRed) }
                Button {
                    Task { await save() }
                } label: {
                    if busy { ProgressView().tint(.white) } else { Text("Lock it in") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                Button("Sign out") { Task { await app.signOut() } }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(Color.sfMuted)
            }
            .padding(24)
        }
        .shadowScreen()
    }

    private func save() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            try await app.backend.createGoal(NewGoal(
                title: title, unit: unit.isEmpty ? nil : unit,
                targetValue: Double(target.replacingOccurrences(of: ",", with: ".")), targetDate: nil
            ))
            await app.resolve()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
