import Foundation

/// A voting invite opened through a universal link (`https://hnnt.app/vote/<code>`)
/// or the custom scheme (`hinto://vote/<code>`).
struct VoteInviteLink: Identifiable, Equatable {
    let inviteCode: String

    var id: String { inviteCode }

    private static let universalLinkHosts: Set<String> = ["hnnt.app", "www.hnnt.app"]

    init?(url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }

        let scheme = components.scheme?.lowercased()
        let host = components.host?.lowercased() ?? ""
        let segments = components.path
            .split(separator: "/", omittingEmptySubsequences: true)
            .map(String.init)

        let code: String?
        if scheme == "hinto", host == "vote" {
            code = segments.first
        } else if scheme == "https", Self.universalLinkHosts.contains(host),
                  segments.count >= 2, segments[0].lowercased() == "vote" {
            code = segments[1]
        } else {
            code = nil
        }

        guard let code, !code.isEmpty else { return nil }
        self.inviteCode = code
    }
}
