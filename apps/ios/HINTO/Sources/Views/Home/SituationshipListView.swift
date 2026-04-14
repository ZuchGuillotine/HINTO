import SwiftUI

struct SituationshipListView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api
    @State private var situationships: [Situationship] = []
    @State private var isLoading = true
    @State private var isReordering = false
    @State private var showCreateSheet = false
    @State private var showShareSheet = false
    @State private var selectedSituationship: Situationship?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if situationships.isEmpty {
                    emptyState
                } else {
                    listContent
                }
            }
            .navigationTitle("My List")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: Spacing.sm) {
                        if !situationships.isEmpty {
                            Button {
                                withAnimation(.spring) {
                                    isReordering.toggle()
                                }
                            } label: {
                                Image(systemName: isReordering ? "checkmark.circle.fill" : "arrow.up.arrow.down")
                                    .symbolEffect(.bounce, value: isReordering)
                            }
                            .tint(isReordering ? .hintoSuccess : .primary)

                            Button {
                                showShareSheet = true
                            } label: {
                                Image(systemName: "square.and.arrow.up")
                            }
                        }

                        Button {
                            showCreateSheet = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                        }
                    }
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                SituationshipDetailView(mode: .create) { newItem in
                    situationships.append(newItem)
                }
            }
            .sheet(item: $selectedSituationship) { item in
                SituationshipDetailView(mode: .edit(item)) { updated in
                    if let index = situationships.firstIndex(where: { $0.id == updated.id }) {
                        situationships[index] = updated
                    }
                }
            }
            .sheet(isPresented: $showShareSheet) {
                ShareSessionView(situationships: situationships)
            }
            .refreshable {
                await loadSituationships()
            }
            .task {
                await loadSituationships()
            }
        }
    }

    // MARK: - List Content

    private var listContent: some View {
        List {
            Section {
                ForEach(Array(situationships.enumerated()), id: \.element.id) { index, item in
                    SituationshipCard(
                        situationship: item,
                        rank: index + 1,
                        isReordering: isReordering
                    ) {
                        if !isReordering {
                            selectedSituationship = item
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }
                .onMove { from, to in
                    situationships.move(fromOffsets: from, toOffset: to)
                    Task { await saveReorder() }
                }
                .onDelete { offsets in
                    let ids = offsets.map { situationships[$0].id }
                    situationships.remove(atOffsets: offsets)
                    Task {
                        for id in ids {
                            await deleteSituationship(id: id)
                        }
                    }
                }
            } header: {
                if !situationships.isEmpty {
                    HStack {
                        Text("\(situationships.count) situationship\(situationships.count == 1 ? "" : "s")")
                            .font(.hintoCaption)
                            .foregroundStyle(.secondary)
                            .textCase(nil)

                        Spacer()

                        if isReordering {
                            Text("Drag to reorder")
                                .font(.hintoCaption)
                                .foregroundStyle(Color.hintoPink)
                                .textCase(nil)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .environment(\.editMode, .constant(isReordering ? .active : .inactive))
        .animation(.spring(response: 0.4), value: situationships)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "heart.text.clipboard")
                .font(.system(size: 64))
                .foregroundStyle(Color.hintoPink.gradient)
                .symbolEffect(.pulse)

            VStack(spacing: Spacing.xs) {
                Text("No situationships yet")
                    .font(.hintoH3)

                Text("Add the people in your life and rank them to get started")
                    .font(.hintoBody)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.xl)
            }

            HINTOButton(title: "Add Your First", style: .primary, icon: "plus") {
                showCreateSheet = true
            }
            .frame(maxWidth: 220)
        }
        .padding(Spacing.xl)
    }

    // MARK: - Data Loading

    private func loadSituationships() async {
        guard let token = auth.accessToken else { return }
        isLoading = situationships.isEmpty

        do {
            let response = try await api.getSituationships(token: token)
            withAnimation {
                situationships = response.data.items.sorted { $0.rank < $1.rank }
                isLoading = false
            }
        } catch {
            // Use mock data in dev mode
            if auth.accessToken == "dev-token" {
                situationships = Self.mockSituationships
            }
            isLoading = false
        }
    }

    private func saveReorder() async {
        guard let token = auth.accessToken else { return }
        let ids = situationships.map(\.id)
        _ = try? await api.reorderSituationships(
            token: token,
            order: ReorderRequest(orderedSituationshipIds: ids)
        )
    }

    private func deleteSituationship(id: String) async {
        guard let token = auth.accessToken else { return }
        _ = try? await api.deleteSituationship(token: token, id: id)
    }

    // MARK: - Mock Data

    static let mockSituationships: [Situationship] = [
        Situationship(situationshipId: "1", ownerProfileId: "dev", name: "Alex", emoji: "😍", category: "Crush", description: "Met at the coffee shop", rank: 1, status: .active, createdAt: "", updatedAt: ""),
        Situationship(situationshipId: "2", ownerProfileId: "dev", name: "Jordan", emoji: "🤔", category: "Friend", description: nil, rank: 2, status: .active, createdAt: "", updatedAt: ""),
        Situationship(situationshipId: "3", ownerProfileId: "dev", name: "Riley", emoji: "😅", category: "Ex", description: nil, rank: 3, status: .active, createdAt: "", updatedAt: ""),
        Situationship(situationshipId: "4", ownerProfileId: "dev", name: "Sam", emoji: "😊", category: "Work", description: nil, rank: 4, status: .active, createdAt: "", updatedAt: ""),
    ]
}

#Preview {
    SituationshipListView()
        .environment(AuthManager())
        .environment(APIClient())
}
