import ProjectDescription

let project = Project(
    name: "HINTO",
    organizationName: "HINTO",
    options: .options(
        defaultKnownRegions: ["en"],
        developmentRegion: "en"
    ),
    settings: .settings(
        base: [
            "SWIFT_VERSION": "5.9"
        ]
    ),
    targets: [
        .target(
            name: "HINTO",
            destinations: .iOS,
            product: .app,
            bundleId: "app.hinto.restart",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "CFBundleDisplayName": .string("HINTO"),
                "CFBundleShortVersionString": .string("1.0"),
                "CFBundleVersion": .string("1"),
                "HINTOAPIBaseURL": .string("http://127.0.0.1:3000"),
                "LSRequiresIPhoneOS": .boolean(true),
                "NSAppTransportSecurity": .dictionary([
                    "NSAllowsLocalNetworking": .boolean(true)
                ]),
                "UILaunchScreen": .dictionary([:])
            ]),
            sources: ["apps/ios/HINTO/Sources/**"],
            resources: []
        )
    ]
)
