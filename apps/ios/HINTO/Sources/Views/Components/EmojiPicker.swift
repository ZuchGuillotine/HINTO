import SwiftUI

struct EmojiPicker: View {
    @Binding var selectedEmoji: String
    var onSelect: ((String) -> Void)?

    private let emojis = [
        "🙂", "😊", "🥰", "😍", "😘",
        "😎", "🤔", "😅", "😭", "😡",
        "💖", "💕", "💔", "✨", "🔥",
        "👀", "🦋", "🌹", "💅", "👑",
    ]

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 5)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(emojis, id: \.self) { emoji in
                Button {
                    withAnimation(.spring(response: 0.3)) {
                        selectedEmoji = emoji
                    }
                    onSelect?(emoji)
                } label: {
                    Text(emoji)
                        .font(.system(size: 28))
                        .frame(width: 48, height: 48)
                        .background(
                            selectedEmoji == emoji
                                ? Color.hintoPink.opacity(0.2)
                                : Color(.tertiarySystemBackground)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                        .overlay {
                            if selectedEmoji == emoji {
                                RoundedRectangle(cornerRadius: CornerRadius.md)
                                    .strokeBorder(Color.hintoPink, lineWidth: 2)
                            }
                        }
                        .scaleEffect(selectedEmoji == emoji ? 1.1 : 1.0)
                }
                .sensoryFeedback(.selection, trigger: selectedEmoji)
            }
        }
    }
}

#Preview {
    EmojiPicker(selectedEmoji: .constant("🥰"))
        .padding()
}
