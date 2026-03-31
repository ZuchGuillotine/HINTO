import SwiftUI

@main
struct HINTOApp: App {
    @State private var authManager = AuthManager()
    @State private var apiClient = APIClient()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(authManager)
                .environment(apiClient)
                .tint(Color.hintoPink)
        }
    }
}
