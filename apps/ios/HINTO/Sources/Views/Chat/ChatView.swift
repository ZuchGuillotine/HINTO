import SwiftUI

/// AI coach chat backed by `/v1/me/ai/conversations`.
/// Reuses the most recent general conversation (no situationship attached) or creates one,
/// loads its history, and posts each message to `.../messages`.
struct ChatView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    private enum Phase: Equatable {
        case loading
        case unavailable
        case failed(String)
        case ready
    }

    @State private var phase: Phase = .loading
    @State private var conversation: AiConversation?
    @State private var messages: [ChatMessage] = []
    @State private var usage: AiUsage?
    @State private var inputText = ""
    @State private var isTyping = false
    @State private var errorMessage: String?
    @State private var showError = false
    @FocusState private var inputFocused: Bool

    private static let welcomeText = "Hi! I'm your AI relationship coach. I'm here to help you navigate your situationships with clarity and confidence. What's on your mind?"

    private var canUseCoach: Bool {
        auth.currentUser?.capabilities.canUseAiCoach ?? false
    }

    private var hasRemainingMessages: Bool {
        guard let usage else { return true }
        return usage.remaining > 0
    }

    var body: some View {
        NavigationStack {
            Group {
                switch phase {
                case .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .unavailable:
                    unavailableState
                case .failed(let message):
                    failedState(message)
                case .ready:
                    conversationContent
                }
            }
            .navigationTitle("AI Coach")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("New Conversation", systemImage: "plus.bubble") {
                            Task { await startNewConversation() }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .disabled(phase != .ready || isTyping)
                }
            }
            .task { await loadConversation() }
            .alert("Message not sent", isPresented: $showError) {
                Button("OK") {}
            } message: {
                Text(errorMessage ?? "Something went wrong")
            }
        }
    }

    // MARK: - Conversation

    private var conversationContent: some View {
        VStack(spacing: 0) {
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
                .onAppear {
                    if let last = messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
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

            if let usage {
                usageFooter(usage)
            }

            if hasRemainingMessages {
                inputBar
            } else {
                limitReachedBar
            }
        }
    }

    private func usageFooter(_ usage: AiUsage) -> some View {
        HStack(spacing: Spacing.xxs) {
            Image(systemName: "sparkles")
                .font(.caption2)
            Text("\(usage.remaining) of \(usage.limit) messages left today")
                .font(.hintoCaption)
        }
        .foregroundStyle(usage.remaining > 0 ? Color.secondary : Color.hintoError)
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.xs)
        .background(.bar)
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

    private var limitReachedBar: some View {
        VStack(spacing: Spacing.xxs) {
            Text("You have used all of today's coach messages.")
                .font(.hintoBodySmall)
                .fontWeight(.medium)
            Text("Your messages reset tomorrow.")
                .font(.hintoCaption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.md)
        .background(.bar)
    }

    // MARK: - Empty / Error States

    private var unavailableState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "bubble.left.and.exclamationmark.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("Coach unavailable")
                .font(.hintoH3)

            Text("The AI coach is not available on your account right now.")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("Could not load the coach")
                .font(.hintoH3)

            Text(message)
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)

            HINTOButton(title: "Try Again", style: .secondary, icon: "arrow.clockwise") {
                Task { await loadConversation(force: true) }
            }
            .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    // MARK: - Loading

    private func loadConversation(force: Bool = false) async {
        if !force, conversation != nil, phase == .ready {
            return
        }

        guard canUseCoach, let token = auth.accessToken else {
            phase = .unavailable
            return
        }

        phase = .loading

        do {
            let list = try await api.listAiConversations(token: token)
            usage = list.data.usage

            let existing = list.data.conversations
                .filter { $0.situationshipId == nil }
                .sorted { $0.updatedAt > $1.updatedAt }
                .first

            let active: AiConversation
            if let existing {
                active = existing
            } else {
                let created = try await api.createAiConversation(token: token)
                active = created.data.conversation
            }
            conversation = active

            let history = try await api.listAiMessages(token: token, conversationId: active.conversationId)
            var loaded = history.data.messages.map { ChatMessage(aiMessage: $0) }
            if loaded.isEmpty {
                loaded = [.aiMessage(Self.welcomeText)]
            }
            messages = loaded
            phase = .ready
        } catch let error as APIError where error.isAuthenticationFailure {
            phase = .unavailable
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func startNewConversation() async {
        guard let token = auth.accessToken else { return }

        do {
            let created = try await api.createAiConversation(token: token)
            conversation = created.data.conversation
            withAnimation {
                messages = [.aiMessage(Self.welcomeText)]
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    // MARK: - Send Message

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isTyping, hasRemainingMessages else { return }

        let userMessage = ChatMessage.userMessage(text)
        withAnimation(.spring(response: 0.3)) {
            messages.append(userMessage)
        }
        inputText = ""

        Task {
            await deliver(text, optimisticMessageId: userMessage.id)
        }
    }

    private func deliver(_ text: String, optimisticMessageId: String) async {
        guard let token = auth.accessToken, let conversation else {
            rollback(optimisticMessageId, restoring: text, message: AuthError.sessionExpired.errorDescription)
            return
        }

        withAnimation { isTyping = true }

        do {
            let response = try await api.sendAiMessage(
                token: token,
                conversationId: conversation.conversationId,
                input: SendAiMessageRequest(content: text)
            )
            usage = response.data.usage

            withAnimation(.spring(response: 0.3)) {
                isTyping = false
                // Swap the optimistic bubble for the server copy so ids stay stable across reloads.
                if let index = messages.firstIndex(where: { $0.id == optimisticMessageId }) {
                    messages[index] = ChatMessage(aiMessage: response.data.userMessage)
                }
                messages.append(ChatMessage(aiMessage: response.data.assistantMessage, streaming: true))
            }
        } catch {
            withAnimation { isTyping = false }
            rollback(optimisticMessageId, restoring: text, message: error.localizedDescription)
        }
    }

    private func rollback(_ messageId: String, restoring text: String, message: String?) {
        withAnimation {
            messages.removeAll { $0.id == messageId }
        }
        if inputText.isEmpty {
            inputText = text
        }
        errorMessage = message
        showError = true
    }
}

#Preview {
    ChatView()
        .environment(AuthManager())
        .environment(APIClient())
}
