import SwiftUI

struct CategoryPicker: View {
    @Binding var selected: SituationshipCategory?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.xs) {
                ForEach(SituationshipCategory.allCases) { category in
                    Button {
                        withAnimation(.spring(response: 0.3)) {
                            selected = category
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(category.emoji)
                                .font(.caption)
                            Text(category.rawValue)
                                .font(.hintoButtonSmall)
                        }
                        .padding(.horizontal, Spacing.sm)
                        .padding(.vertical, Spacing.xs)
                        .foregroundStyle(selected == category ? .white : .primary)
                        .background(
                            selected == category
                                ? Color.hintoPink
                                : Color(.tertiarySystemBackground)
                        )
                        .clipShape(Capsule())
                    }
                    .sensoryFeedback(.selection, trigger: selected)
                }
            }
            .padding(.horizontal, Spacing.xxs)
        }
    }
}

#Preview {
    CategoryPicker(selected: .constant(.crush))
}
