import SwiftUI

struct AvatarView: View {
    let url: String?
    let emoji: String?
    var size: CGFloat = 60
    var showEditOverlay: Bool = false

    var body: some View {
        ZStack {
            if let url, !url.isEmpty {
                AsyncImage(url: URL(string: url)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        emojiOrPlaceholder
                    case .empty:
                        ProgressView()
                            .frame(width: size, height: size)
                    @unknown default:
                        emojiOrPlaceholder
                    }
                }
            } else {
                emojiOrPlaceholder
            }

            if showEditOverlay {
                Color.black.opacity(0.4)
                Image(systemName: "camera.fill")
                    .foregroundStyle(.white)
                    .font(.system(size: size * 0.25))
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    @ViewBuilder
    private var emojiOrPlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [.hintoPink100, .hintoPink200],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            if let emoji, !emoji.isEmpty {
                Text(emoji)
                    .font(.system(size: size * 0.45))
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.35))
                    .foregroundStyle(.hintoPink400)
            }
        }
    }
}

#Preview {
    HStack(spacing: 16) {
        AvatarView(url: nil, emoji: "🥰", size: 60)
        AvatarView(url: nil, emoji: nil, size: 60)
        AvatarView(url: nil, emoji: "😍", size: 80, showEditOverlay: true)
    }
}
