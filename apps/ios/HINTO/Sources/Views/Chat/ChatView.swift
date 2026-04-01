import SwiftUI

struct ChatView: View {
    @State private var messages: [ChatMessage] = [
        .aiMessage("Hi! I'm your AI relationship coach. I'm here to help you navigate your situationships with clarity and confidence. What's on your mind?")
    ]
    @State private var inputText = ""
    @State private var isTyping = false
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(messages) { message in
                                ChatBubbleView(message: message)
                                    .id(message.id)
                                    .transition(.asymmetric(
                                        insertion: .move(edge: .bottom).combined(with: .opacity),
                                        removal: .opacity
                                    ))
                            }

                            if isTyping {
                                TypingIndicatorView()
                                    .id("typing")
                                    .transition(.move(edge: .bottom).combined(with: .opacity))
                            }
                        }
                        .padding(.vertical, Spacing.sm)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: messages.count) {
                        withAnimation {
                            proxy.scrollTo(messages.last?.id ?? "typing", anchor: .bottom)
                        }
                    }
                    .onChange(of: isTyping) {
                        if isTyping {
                            withAnimation {
                                proxy.scrollTo("typing", anchor: .bottom)
                            }
                        }
                    }
                }

                Divider()

                // Input bar
                inputBar
            }
            .navigationTitle("AI Coach")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Clear Chat", systemImage: "trash") {
                            withAnimation {
                                messages = [messages.first].compactMap { $0 }
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(spacing: Spacing.xs) {
            TextField("Ask about your situationships...", text: $inputText, axis: .vertical)
                .font(.hintoBody)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(Color(.tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .focused($inputFocused)

            Button {
                sendMessage()
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(
                        inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? Color.neutral300
                            : Color.hintoPink
                    )
                    .symbolEffect(.bounce, value: inputText.isEmpty)
            }
            .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isTyping)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(.bar)
    }

    // MARK: - Send Message

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        let userMsg = ChatMessage.userMessage(text)
        withAnimation(.spring(response: 0.3)) {
            messages.append(userMsg)
        }
        inputText = ""

        Task {
            await generateAIResponse(to: text)
        }
    }

    private func generateAIResponse(to userText: String) async {
        withAnimation { isTyping = true }

        // Simulate API delay
        try? await Task.sleep(for: .seconds(1.5))

        let responses = [
            "That's a really thoughtful question. Based on what you've shared, it sounds like you're looking for more clarity about where things stand. Have you tried having a direct conversation about expectations?",
            "I hear you! It can be confusing when signals are mixed. One thing that might help is focusing on actions rather than words - what does their behavior consistently tell you?",
            "That's totally valid to feel that way. Remember, you deserve someone who makes you feel secure, not anxious. What would your ideal situation look like?",
            "Interesting! It sounds like you're growing and learning what you want. That's actually a really positive sign. What feels most important to you right now?",
            "I understand the confusion. Sometimes taking a step back to evaluate the pattern over time gives more clarity than analyzing individual moments. How have things been trending overall?",
        ]

        let response = responses.randomElement() ?? responses[0]

        withAnimation(.spring(response: 0.3)) {
            isTyping = false
            messages.append(.aiMessage(response, streaming: true))
        }
    }
}

#Preview {
    ChatView()
}
