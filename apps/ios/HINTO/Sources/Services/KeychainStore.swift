import Foundation
import Security

/// Minimal generic-password Keychain wrapper for small secrets (session tokens).
/// Items are stored with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, so they
/// are available to background refreshes after the first unlock but never leave the device
/// (no iCloud Keychain sync, not restored to another device from backup).
struct KeychainStore {
    let service: String

    init(service: String) {
        self.service = service
    }

    func string(forKey key: String) -> String? {
        var query = baseQuery(forKey: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    func set(_ value: String, forKey key: String) -> Bool {
        let data = Data(value.utf8)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let query = baseQuery(forKey: key)
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return true
        }
        if updateStatus != errSecItemNotFound {
            // Item exists but could not be updated (e.g. accessibility mismatch): replace it.
            SecItemDelete(query as CFDictionary)
        }

        var addQuery = query
        for (attributeKey, attributeValue) in attributes {
            addQuery[attributeKey] = attributeValue
        }
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        return addStatus == errSecSuccess
    }

    @discardableResult
    func remove(forKey key: String) -> Bool {
        let status = SecItemDelete(baseQuery(forKey: key) as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    private func baseQuery(forKey key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }
}
