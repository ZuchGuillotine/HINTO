import SwiftUI

struct SituationshipCard: View {
    let situationship: Situationship
    let rank: Int
    var isReordering: Bool = false
    var onTap: (() -> Void)?

    @State private var isPressed = false

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Rank badge
            ZStack {
                Circle()
                    .fill(rankColor.gradient)
                    .frame(width: 32, height: 32)

                Text("\(rank)")
                    .font(.hintoLabel)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
            }

            // Avatar
            AvatarView(
                url: nil,
                emoji: situationship.displayEmoji,
                size: 48
            )

            // Info
            VStack(alignment: .leading, spacing: 2) {
                Text(situationship.name)
                    .font(.hintoH5)
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                if let category = situationship.category {
                    Text(category)
                        .font(.hintoCaption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Drag handle or chevron
            if isReordering {
                Image(systemName: "line.3.horizontal")
                    .font(.title3)
                    .foregroundStyle(.tertiary)
            } else {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(Spacing.md)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.2), value: isPressed)
        .onTapGesture {
            onTap?()
        }
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
    }

    private var rankColor: Color {
        switch rank {
        case 1: .hintoPink
        case 2: .hintoPink400
        case 3: .hintoPink300
        default: .neutral400
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        SituationshipCard(
            situationship: Situationship(
                situationshipId: "1",
                ownerProfileId: "owner",
                name: "Alex",
                emoji: "😍",
                category: "Crush",
                description: nil,
                rank: 1,
                status: .active,
                createdAt: "",
                updatedAt: ""
            ),
            rank: 1
        )
        SituationshipCard(
            situationship: Situationship(
                situationshipId: "2",
                ownerProfileId: "owner",
                name: "Jordan",
                emoji: "🤔",
                category: "Friend",
                description: nil,
                rank: 2,
                status: .active,
                createdAt: "",
                updatedAt: ""
            ),
            rank: 2,
            isReordering: true
        )
    }
    .padding()
}
