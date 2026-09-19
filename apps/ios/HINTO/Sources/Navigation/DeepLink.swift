import Foundation

/// Parses the URLs the app registers for:
/// - custom scheme: `hinto://vote/<code>`
/// - universal link: `https://hinto.app/vote/<code>` (also `www.hinto.app`)
enum DeepLink {
    static let universalLinkHosts: Set<String> = ["hinto.app", "www.hinto.app"]
    static let customScheme = "hinto"

    static func voteInviteCode(from url: URL) -> String? {
        let segments = routeSegments(from: url)
        guard segments.count >= 2, segments[0].lowercased() == "vote" else {
            return nil
        }
        let code = segments[1].trimmingCharacters(in: .whitespacesAndNewlines)
        return code.isEmpty ? nil : code
    }

    /// Route segments with the scheme/host normalised away, e.g. ["vote", "ABC123"].
    private static func routeSegments(from url: URL) -> [String] {
        let pathSegments = url.pathComponents.filter { $0 != "/" }
        let scheme = url.scheme?.lowercased()
        let host = url.host?.lowercased()

        if scheme == customScheme {
            // hinto://vote/<code> -> host is "vote", path is "/<code>"
            if let host, !host.isEmpty {
                return [host] + pathSegments
            }
            return pathSegments
        }

        if let host, universalLinkHosts.contains(host) {
            return pathSegments
        }

        return []
    }
}
