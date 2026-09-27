import SwiftUI

@main
struct ShadowForumApp: App {
    @State private var app = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = UIColor(Color.sfBackground)
        nav.shadowColor = .clear
        nav.titleTextAttributes = [.foregroundColor: UIColor(Color.sfText)]
        nav.largeTitleTextAttributes = [.foregroundColor: UIColor(Color.sfText)]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .preferredColorScheme(.dark)
                .tint(.sfSteel)
                .task { await app.start() }
                .onOpenURL { app.handle(url: $0) }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { app.checkInbox() }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            switch app.phase {
            case .loading:
                ZStack { Color.sfBackground.ignoresSafeArea(); ProgressView().tint(.sfSteel) }
            case .unconfigured:
                UnconfiguredView()
            case .signedOut:
                SignInView()
            case .needsGoal:
                GoalOnboardingView()
            case .ready:
                MainTabView()
            }
        }
        .animation(.default, value: app.phase)
    }
}

struct MainTabView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app
        TabView(selection: $app.tab) {
            NavigationStack {
                if app.debugScreen == "rider" {
                    RiderDetailView(riderId: DemoBackend.me, name: "Kai Tran")
                } else {
                    RaceView()
                }
            }
                .tabItem { Label("Race", systemImage: "flag.checkered") }
                .tag(AppModel.Tab.race)
            NavigationStack { MyZoneView() }
                .tabItem { Label("My Zone", systemImage: "person.crop.circle") }
                .tag(AppModel.Tab.zone)
            NavigationStack { UploadView() }
                .tabItem { Label("Upload", systemImage: "arrow.up.doc") }
                .tag(AppModel.Tab.upload)
            NavigationStack {
                switch app.debugScreen {
                case "rules": RulesView()
                case "report": ReportView()
                default: MoreView()
                }
            }
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
                .tag(AppModel.Tab.more)
        }
        .overlay(alignment: .bottomTrailing) { ChatButton() }
        .sheet(isPresented: $app.showChat) { ChatView() }
    }
}

/// The floating assistant button, over every tab.
struct ChatButton: View {
    @Environment(AppModel.self) private var app
    var body: some View {
        Button { app.showChat = true } label: {
            Image(systemName: "bubble.left.and.text.bubble.right.fill")
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(Color.sfSteel, in: Circle())
                .overlay(Circle().stroke(Color.sfDeepSteel, lineWidth: 2))
                .shadow(color: .black.opacity(0.5), radius: 8, y: 4)
        }
        .padding(.trailing, 18)
        .padding(.bottom, 64)
        .accessibilityLabel("Ask the WHOOP assistant")
    }
}

struct UnconfiguredView: View {
    var body: some View {
        VStack(spacing: 16) {
            Wordmark()
            Text("Not configured")
                .font(.title2.bold())
            Text("Copy ios/Config/Secrets.example.xcconfig to Secrets.xcconfig and add the Supabase URL and anon key, then rebuild.")
                .foregroundStyle(Color.sfMuted)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sfBackground.ignoresSafeArea())
        .foregroundStyle(Color.sfText)
    }
}
