import SwiftUI

struct ChatBubbleView: View {
    let message: ChatMessage
    @State private var displayedText = ""
    @State private var streamingComplete = false

    var body: some View {
        HStack(alignment: .bottom, spacing: Spacing.xs) {
            if message.isUser { Spacer(minLength: 60) }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                Text(message.isStreaming && !streamingComplete ? displayedText : message.text)
                    .font(.hintoBody)
                    .foregroundStyle(message.isUser ? .white : .primary)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(
                        message.isUser
                            ? Color.hintoPink
                            : Color(.tertiarySystemBackground)
                    )
                    .clipShape(BubbleShape(isUser: message.isUser))

                Text(message.formattedTime)
                    .font(.hintoCaption)
                    .foregroundStyle(.tertiary)
            }

            if !message.isUser { Spacer(minLength: 60) }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.xxs)
        .task {
            if message.isStreaming {
                await streamText()
            }
        }
    }

    private func streamText() async {
        displayedText = ""
        for char in message.text {
            displayedText.append(char)
            try? await Task.sleep(for: .milliseconds(25))
        }
        streamingComplete = true
    }
}

struct BubbleShape: Shape {
    let isUser: Bool

    func path(in rect: CGRect) -> Path {
        let radius: CGFloat = 16
        let tailRadius: CGFloat = 6

        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: isUser
                ? [.topLeft, .topRight, .bottomLeft]
                : [.topLeft, .topRight, .bottomRight],
            cornerRadii: CGSize(width: radius, height: radius)
        )

        return Path(path.cgPath)
    }
}

struct TypingIndicatorView: View {
    @State private var dotIndex = 0

    var body: some View {
        HStack(spacing: Spacing.xs) {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.neutral400)
                        .frame(width: 8, height: 8)
                        .scaleEffect(dotIndex == index ? 1.3 : 1.0)
                        .animation(
                            .easeInOut(duration: 0.4)
                                .repeatForever()
                                .delay(Double(index) * 0.15),
                            value: dotIndex
                        )
                }
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.sm)
            .background(Color(.tertiarySystemBackground))
            .clipShape(BubbleShape(isUser: false))

            Spacer()
        }
        .padding(.horizontal, Spacing.md)
        .onAppear { dotIndex = 2 }
    }
}

#Preview {
    VStack {
        ChatBubbleView(message: .aiMessage("Hi! I'm your AI coach. What's on your mind?"))
        ChatBubbleView(message: .userMessage("Tell me about my situationships"))
        TypingIndicatorView()
    }
}
