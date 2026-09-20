import ProjectDescription

// Info.plist strategy
// -------------------
// Tuist's `.extendingDefault(with:)` produces one Info.plist shared by every
// build configuration, so a Debug-only `NSAllowsLocalNetworking` cannot be
// expressed with it. The project therefore ships a hand-written
// `apps/ios/HINTO/Info.plist` that goes through Xcode's Info.plist
// preprocessor (`INFOPLIST_PREPROCESS`): Debug defines
// `HINTO_ALLOW_LOCAL_NETWORKING=1`, which enables the `NSAppTransportSecurity`
// block and the local-network usage string; Release defines it as 0 and the
// block is dropped. Build-setting substitution (`$(MARKETING_VERSION)`,
// `$(CURRENT_PROJECT_VERSION)`, `$(HINTO_API_BASE_URL)`) still applies.
// `-traditional` keeps the preprocessor from treating `//` in URLs and the
// DOCTYPE as comments.

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
            "CODE_SIGN_STYLE": "Automatic",
            "MARKETING_VERSION": "1.0.0",
            "CURRENT_PROJECT_VERSION": "1",
            "TARGETED_DEVICE_FAMILY": "1",
            "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
            "INFOPLIST_PREPROCESS": "YES",
            "INFOPLIST_OTHER_PREPROCESSOR_FLAGS": "-traditional",
            // Empty in Debug so `Configuration.apiBaseURL` falls back to the
            // local API unless the scheme sets `HINTO_API_BASE_URL`.
            "HINTO_API_BASE_URL": ""
        ],
        configurations: [
            .debug(
                name: .debug,
                settings: [
                    "INFOPLIST_PREPROCESSOR_DEFINITIONS": "HINTO_ALLOW_LOCAL_NETWORKING=1"
                ]
            ),
            .release(
                name: .release,
                settings: [
                    "INFOPLIST_PREPROCESSOR_DEFINITIONS": "HINTO_ALLOW_LOCAL_NETWORKING=0",
                    "HINTO_API_BASE_URL": "https://api.hnnt.app"
                ]
            )
        ]
    ),
    targets: [
        .target(
            name: "HINTO",
            destinations: [.iPhone],
            product: .app,
            bundleId: "app.hnnt",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .file(path: "apps/ios/HINTO/Info.plist"),
            sources: ["apps/ios/HINTO/Sources/**"],
            resources: [
                "apps/ios/HINTO/Resources/Assets.xcassets",
                "apps/ios/HINTO/Resources/PrivacyInfo.xcprivacy"
            ],
            entitlements: .dictionary([
                "com.apple.developer.applesignin": .array([.string("Default")]),
                "com.apple.developer.associated-domains": .array([.string("applinks:hnnt.app")])
            ])
        )
    ]
)
