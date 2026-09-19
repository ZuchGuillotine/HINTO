import ProjectDescription

// HINTO iOS app (Tuist manifest).
//
// Configuration split:
// - Debug   -> HINTO_API_BASE_URL = http://127.0.0.1:3000, ATS local-networking exception on.
// - Release -> HINTO_API_BASE_URL = https://api.hinto.app, no ATS exception.
//
// `HINTO_API_BASE_URL` is substituted into Info.plist (`HINTOAPIBaseURL`) at build time.
// The ATS exception is compiled into Info.plist only when `HINTO_DEBUG` is defined,
// which relies on Info.plist preprocessing (INFOPLIST_PREPROCESS). `-traditional` keeps
// the preprocessor from treating `//` in URLs and the DOCTYPE as comments.

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
            "MARKETING_VERSION": "1.0",
            "CURRENT_PROJECT_VERSION": "1",
            "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
            "INFOPLIST_PREPROCESS": "YES",
            "INFOPLIST_OTHER_PREPROCESSOR_FLAGS": "-traditional",
            "TARGETED_DEVICE_FAMILY": "1",
        ],
        configurations: [
            .debug(
                name: .debug,
                settings: [
                    "HINTO_API_BASE_URL": "http://127.0.0.1:3000",
                    "INFOPLIST_PREPROCESSOR_DEFINITIONS": "HINTO_DEBUG=1",
                ]
            ),
            .release(
                name: .release,
                settings: [
                    "HINTO_API_BASE_URL": "https://api.hinto.app",
                    "INFOPLIST_PREPROCESSOR_DEFINITIONS": "",
                ]
            ),
        ]
    ),
    targets: [
        .target(
            name: "HINTO",
            destinations: [.iPhone],
            product: .app,
            bundleId: "app.hinto.restart",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .file(path: "apps/ios/HINTO/Info.plist"),
            sources: ["apps/ios/HINTO/Sources/**"],
            resources: [
                "apps/ios/HINTO/Resources/Assets.xcassets",
                "apps/ios/HINTO/Resources/PrivacyInfo.xcprivacy",
            ],
            entitlements: .file(path: "apps/ios/HINTO/HINTO.entitlements")
        )
    ]
)
