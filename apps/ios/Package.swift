// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HINTO",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "HINTO",
            targets: ["HINTO"]
        ),
    ],
    targets: [
        .target(
            name: "HINTO",
            path: "HINTO/Sources"
        ),
        .testTarget(
            name: "HINTOTests",
            dependencies: ["HINTO"],
            path: "HINTO/Tests"
        ),
    ]
)
