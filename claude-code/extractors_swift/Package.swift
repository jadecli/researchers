// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "Extractors",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "Extractors",
            targets: ["Extractors"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/scinfu/SwiftSoup.git", from: "2.7.0"),
    ],
    targets: [
        .target(
            name: "Extractors",
            dependencies: ["SwiftSoup"],
            path: "Sources/Extractors"
        ),
    ]
)
