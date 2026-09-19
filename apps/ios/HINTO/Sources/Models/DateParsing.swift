import Foundation

/// Parses ISO-8601 timestamps as emitted by the API (Postgres `timestamptz`,
/// which may carry microsecond precision that `ISO8601DateFormatter` rejects).
enum HINTODate {
    private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ value: String) -> Date? {
        if let date = fractional.date(from: value) ?? plain.date(from: value) {
            return date
        }

        // Trim fractional seconds to millisecond precision and retry.
        let trimmed = value.replacingOccurrences(
            of: #"\.(\d{3})\d+"#,
            with: ".$1",
            options: .regularExpression
        )
        if trimmed != value, let date = fractional.date(from: trimmed) {
            return date
        }

        // Drop fractional seconds entirely as a last resort.
        let stripped = value.replacingOccurrences(
            of: #"\.\d+"#,
            with: "",
            options: .regularExpression
        )
        return plain.date(from: stripped)
    }
}
