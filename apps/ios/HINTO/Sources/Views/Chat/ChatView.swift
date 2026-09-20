import SwiftUI

struct ChatView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var conversation: AIConversation?
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isTyping = false
    @State private var isLoading = true
    @State private var loadFailed = false
    @State private var dailyUsage: AIDailyUsage?
    @State private var limitNotice: String?
    @State private var errorMessage: String?
    @FocusState private var inputFocused: Bool

    private static let welcomeText =
        "Hi! I'm HNNT. I'm here to help you navigate your situationships with clarity and confidence. What's on your mind?"

    private var canUseCoach: Bool {
        auth.currentUser?.capabilities.canUseAiCoach ?? false
    }

    private var isAtDailyLimit: Bool {
        guard let dailyUsage else { return false }
        return dailyUsage.remaining == 0
    }

    private var trimmedInput: String {
        inputText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSend: Bool {
        !trimmedInput.isEmpty && !isTyping && !isAtDailyLimit && conversation != nil
    }

    var body: some View {
        NavigationStack {
            Group {
                if !canUseCoach {
                    coachUnavailableState
                } else if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if loadFailed {
                    loadFailedState
                } else {
                    chatContent
                }
            }
            .navigationTitle("HNNT")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if canUseCoach {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button("New Conversation", systemImage: "plus.bubble") {
                                Task { await startNewConversation() }
                            }
                            .disabled(isTyping)

                            if conversation != nil {
                                Button("Delete Conversation", systemImage: "trash", role: .destructive) {
                                    Task { await deleteCurrentConversation() }
                                }
                                .disabled(isTyping)
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
            }
            .task(id: canUseCoach) {
                await loadInitialConversation()
            }
            .alert("HNNT", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    // MARK: - Chat

    private var chatContent: some View {
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

            inputBar
        }
    }

    // MARK: - States

    private var coachUnavailableState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "bubble.left.and.exclamationmark.bubble.right")
                .font(.system(size: 52))
                .foregroundStyle(.tertiary)

            Text("Coach unavailable")
                .font(.hintoH3)

            Text("HNNT isn't available on your account right now. Check back soon.")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var loadFailedState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 52))
                .foregroundStyle(.tertiary)

            Text("Couldn't load your chat")
                .font(.hintoH3)

            Text("Check your connection and try again.")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)

            HINTOButton(title: "Try Again", style: .primary, icon: "arrow.clockwise") {
                Task { await loadInitialConversation() }
            }
            .frame(maxWidth: 220)
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        VStack(spacing: Spacing.xxs) {
            if let limitNotice {
                Text(limitNotice)
                    .font(.hintoCaption)
                    .foregroundStyle(Color.hintoWarning)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spacing.sm)
            } else if let dailyUsage {
                Text("\(dailyUsage.remaining) of \(dailyUsage.limit) messages left today")
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }

            HStack(spacing: Spacing.xs) {
                TextField(
                    isAtDailyLimit ? "Daily limit reached" : "Ask about your situationships...",
                    text: $inputText,
                    axis: .vertical
                )
                .font(.hintoBody)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(Color(.tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .focused($inputFocused)
                .disabled(isAtDailyLimit)

                Button {
                    sendMessage()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(canSend ? Color.hintoPink : Color.neutral300)
                        .symbolEffect(.bounce, value: inputText.isEmpty)
                }
                .disabled(!canSend)
            }
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(.bar)
    }

    // MARK: - Loading

    private func loadInitialConversation() async {
        guard canUseCoach, let token = auth.accessToken else {
            isLoading = false
            return
        }

        isLoading = true
        loadFailed = false
        defer { isLoading = false }

        do {
            let list = try await api.listConversations(token: token)
            let newest = list.data.conversations.max { $0.updatedAt < $1.updatedAt }

            if let newest {
                let detail = try await api.getConversation(token: token, conversationId: newest.conversationId)
                applyConversation(detail.data.conversation, apiMessages: detail.data.messages)
            } else {
                let created = try await api.createConversation(token: token)
                applyConversation(created.data.conversation, apiMessages: [])
            }
        } catch {
            loadFailed = true
            errorMessage = error.localizedDescription
        }
    }

    private func applyConversation(_ conversation: AIConversation, apiMessages: [AIMessage]) {
        self.conversation = conversation
        limitNotice = nil

        var mapped = apiMessages.map { ChatMessage(apiMessage: $0) }
        if mapped.isEmpty {
            mapped = [.aiMessage(Self.welcomeText)]
        }
        messages = mapped
    }

    private func startNewConversation() async {
        guard let token = auth.accessToken else { return }

        do {
            let created = try await api.createConversation(token: token)
            withAnimation {
                applyConversation(created.data.conversation, apiMessages: [])
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteCurrentConversation() async {
        guard let token = auth.accessToken, let current = conversation else { return }

        do {
            _ = try await api.deleteConversation(token: token, conversationId: current.conversationId)
            let created = try await api.createConversation(token: token)
            withAnimation {
                applyConversation(created.data.conversation, apiMessages: [])
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Send Message

    private func sendMessage() {
        let text = trimmedInput
        guard !text.isEmpty, canSend else { return }

        let userMsg = ChatMessage.userMessage(text)
        withAnimation(.spring(response: 0.3)) {
            messages.append(userMsg)
        }
        inputText = ""

        Task {
            await deliverMessage(text, pendingMessageId: userMsg.id)
        }
    }

    private func deliverMessage(_ text: String, pendingMessageId: String) async {
        guard let token = auth.accessToken, let current = conversation else { return }

        withAnimation { isTyping = true }
        defer {
            withAnimation { isTyping = false }
        }

        do {
            let response = try await api.sendConversationMessage(
                token: token,
                conversationId: current.conversationId,
                content: text
            )
            dailyUsage = response.data.dailyUsage
            limitNotice = nil

            withAnimation(.spring(response: 0.3)) {
                if let index = messages.firstIndex(where: { $0.id == pendingMessageId }) {
                    messages[index] = ChatMessage(apiMessage: response.data.userMessage)
                }
                messages.append(ChatMessage(apiMessage: response.data.assistantMessage, streaming: true))
            }
        } catch {
            withAnimation {
                messages.removeAll { $0.id == pendingMessageId }
            }
            inputText = text
            handleSendError(error)
        }
    }

    private func handleSendError(_ error: Error) {
        if let apiError = error as? APIError, case .server(let code, _, _) = apiError {
            switch code {
            case "quota_exceeded":
                if let dailyUsage {
                    self.dailyUsage = AIDailyUsage(aiMessagesUsed: dailyUsage.limit, limit: dailyUsage.limit)
                } else {
                    self.dailyUsage = AIDailyUsage(aiMessagesUsed: 0, limit: 0)
                }
                limitNotice = "You've used all of today's coach messages. Come back tomorrow."
                return
            case "rate_limited":
                limitNotice = "You're sending messages a little fast. Give it a moment and try again."
                return
            default:
                break
            }
        }
        errorMessage = error.localizedDescription
    }
}

#Preview {
    ChatView()
        .environment(AuthManager())
        .environment(APIClient())
}
