import Foundation
import PhotosUI
import SwiftUI
import UIKit

enum ImageUploadDataError: LocalizedError {
    case unreadableImage

    var errorDescription: String? {
        switch self {
        case .unreadableImage: "Could not read the selected image"
        }
    }
}

func loadJPEGUploadData(
    from item: PhotosPickerItem?,
    maxDimension: CGFloat = 1024,
    compressionQuality: CGFloat = 0.82
) async throws -> Data? {
    guard let item else { return nil }
    guard let data = try await item.loadTransferable(type: Data.self),
          let image = UIImage(data: data) else {
        throw ImageUploadDataError.unreadableImage
    }

    let size = image.size
    let largestDimension = max(size.width, size.height)
    let scale = largestDimension > maxDimension ? maxDimension / largestDimension : 1
    let targetSize = CGSize(width: size.width * scale, height: size.height * scale)

    let renderer = UIGraphicsImageRenderer(size: targetSize)
    let resized = renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: targetSize))
    }

    guard let jpegData = resized.jpegData(compressionQuality: compressionQuality) else {
        throw ImageUploadDataError.unreadableImage
    }

    return jpegData
}
