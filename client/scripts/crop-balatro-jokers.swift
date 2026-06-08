import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let fileManager = FileManager.default
let root = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let publicDirectory = root.appendingPathComponent("public/balatro")
let outputDirectory = publicDirectory.appendingPathComponent("jokers")

try fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let measuredColumns: [Int: [(start: Int, end: Int)]] = [
    1: [
        (13, 169), (178, 336), (345, 502), (511, 667), (675, 831),
        (839, 995), (1004, 1160), (1169, 1326), (1334, 1491), (1499, 1656)
    ],
    3: [
        (7, 166), (173, 338), (346, 512), (520, 688), (696, 879),
        (888, 1058), (1066, 1236), (1244, 1417), (1425, 1594), (1602, 1766)
    ]
]

let measuredRows: [Int: [(start: Int, end: Int)]] = [
    1: [(15, 184), (191, 360), (367, 536), (543, 714), (720, 922)],
    3: [(8, 164), (171, 322), (330, 478), (484, 621), (628, 755)]
]

for atlasNumber in 1...3 {
    let sourceURL = publicDirectory.appendingPathComponent("jokers-atlas-\(atlasNumber).jpg")
    guard
        let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        fatalError("Unable to read \(sourceURL.path)")
    }

    for localIndex in 0..<50 {
        let column = localIndex % 10
        let row = localIndex / 10
        let horizontalRange = measuredColumns[atlasNumber]?[column] ?? (
            column * image.width / 10 + 6,
            (column + 1) * image.width / 10 - 6
        )
        let verticalRange = measuredRows[atlasNumber]?[row] ?? (
            row * image.height / 5 + 6,
            (row + 1) * image.height / 5 - 6
        )
        let left = horizontalRange.0
        let right = horizontalRange.1
        let top = verticalRange.0
        let bottom = verticalRange.1
        let cropRect = CGRect(x: left, y: top, width: right - left, height: bottom - top)

        guard let cropped = image.cropping(to: cropRect) else {
            fatalError("Unable to crop atlas \(atlasNumber), item \(localIndex)")
        }

        let jokerIndex = (atlasNumber - 1) * 50 + localIndex
        let outputURL = outputDirectory.appendingPathComponent("joker-\(jokerIndex).jpg")
        guard let destination = CGImageDestinationCreateWithURL(
            outputURL as CFURL,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ) else {
            fatalError("Unable to create \(outputURL.path)")
        }

        CGImageDestinationAddImage(
            destination,
            cropped,
            [kCGImageDestinationLossyCompressionQuality: 0.94] as CFDictionary
        )

        guard CGImageDestinationFinalize(destination) else {
            fatalError("Unable to write \(outputURL.path)")
        }
    }
}

print("Cropped 150 Joker images into \(outputDirectory.path)")
