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
            "SWIFT_VERSION": "5.9",
            "DEVELOPMENT_TEAM": "432862NB9P",
            "CODE_SIGN_STYLE": "Automatic"
        ]
    ),
    targets: [
        .target(
            name: "HINTO",
            destinations: .iOS,
            product: .app,
            bundleId: "app.hnnt",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "CFBundleDisplayName": .string("HINTO"),
                "CFBundleShortVersionString": .string("1.0"),
                "CFBundleVersion": .string("1"),
                "LSRequiresIPhoneOS": .boolean(true),
                "CFBundleURLTypes": .array([
                    .dictionary([
                        "CFBundleURLName": .string("app.hnnt.auth"),
                        "CFBundleURLSchemes": .array([.string("hinto")])
                    ])
                ]),
                "NSLocalNetworkUsageDescription": .string("HINTO connects to the local development API while testing on this device."),
                "NSAppTransportSecurity": .dictionary([
                    "NSAllowsLocalNetworking": .boolean(true)
                ]),
                "UILaunchScreen": .dictionary([:])
            ]),
            sources: ["apps/ios/HINTO/Sources/**"],
            resources: [],
            entitlements: .dictionary([
                "com.apple.developer.applesignin": .array([.string("Default")])
            ])
        )
    ]
)
