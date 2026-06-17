import Foundation
import CoreFoundation

struct FirebaseConfiguration {
    let apiKey: String
    let authDomain: String
    let projectID: String
    let storageBucket: String
    let messagingSenderID: String
    let appID: String
    let measurementID: String

    static func load() -> FirebaseConfiguration? {
        let fileValues = (Bundle.main.url(forResource: "FirebaseConfig", withExtension: "plist"))
            .flatMap { NSDictionary(contentsOf: $0) as? [String: String] } ?? [:]
        let environment = ProcessInfo.processInfo.environment

        func value(for key: String) -> String {
            normalize(environment[key] ?? fileValues[key] ?? "")
        }

        let configuration = FirebaseConfiguration(
            apiKey: value(for: "EXPO_PUBLIC_FIREBASE_API_KEY"),
            authDomain: value(for: "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
            projectID: value(for: "EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
            storageBucket: value(for: "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
            messagingSenderID: value(for: "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
            appID: value(for: "EXPO_PUBLIC_FIREBASE_APP_ID"),
            measurementID: value(for: "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID")
        )

        guard [
            configuration.apiKey,
            configuration.authDomain,
            configuration.projectID,
            configuration.storageBucket,
            configuration.messagingSenderID,
            configuration.appID
        ].allSatisfy({ !$0.isEmpty }) else {
            return nil
        }

        return configuration
    }

    private static func normalize(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        guard !trimmed.hasPrefix("YOUR_") else { return "" }
        guard !trimmed.hasPrefix("replace-with-") else { return "" }
        return trimmed
    }
}

struct FirebaseSession: Decodable {
    let idToken: String
    let localID: String

    enum CodingKeys: String, CodingKey {
        case idToken
        case localID = "localId"
    }
}

struct HomeSwipeUserData: Codable {
    var profileName: String?
    var signUpMethod: String?
    var account: AccountProfileInput?
    var onboardingRole: OnboardingRole?
    var tenantOnboarding: TenantOnboardingInput?
    var listerOnboarding: ListerOnboardingInput?
    var verificationState: VerificationState?
    var verificationDocuments: [VerificationDocument]?
    var applications: [RentalApplication]
    var conversations: [Conversation]
    var leases: [LeaseDraft]
    var savedListingIDs: [String]
    var savedSearches: [String]
}

struct HomeSwipeRemoteState {
    let listings: [Listing]
    let userData: HomeSwipeUserData?
}

enum FirebaseServiceError: Error {
    case notConfigured
    case notAuthenticated
    case invalidResponse
}

@MainActor
final class FirebaseService {
    private var configuration: FirebaseConfiguration?
    private var session: FirebaseSession?

    func isConfigured() -> Bool {
        FirebaseConfiguration.load() != nil
    }

    func connectAndLoad() async throws -> HomeSwipeRemoteState {
        let configuration = try requireConfiguration()
        let session = try await signInAnonymously(using: configuration)

        self.configuration = configuration
        self.session = session

        async let remoteListings = fetchListings(configuration: configuration, session: session)
        async let remoteUserData = fetchUserData(configuration: configuration, session: session)

        return try await HomeSwipeRemoteState(
            listings: remoteListings,
            userData: remoteUserData
        )
    }

    func saveUserData(_ data: HomeSwipeUserData) async throws {
        let (configuration, session) = try requireSession()
        let path = "homeswipeUsers/\(session.localID)"
        try await patchDocument(path: path, model: data, configuration: configuration, session: session)
    }

    func saveListing(_ listing: Listing) async throws {
        let (configuration, session) = try requireSession()
        let path = "homeswipeListings/\(listing.id)"
        try await patchDocument(path: path, model: listing, configuration: configuration, session: session)
    }

    private func requireConfiguration() throws -> FirebaseConfiguration {
        if let configuration {
            return configuration
        }
        guard let loaded = FirebaseConfiguration.load() else {
            throw FirebaseServiceError.notConfigured
        }
        self.configuration = loaded
        return loaded
    }

    private func requireSession() throws -> (FirebaseConfiguration, FirebaseSession) {
        guard let configuration, let session else {
            throw FirebaseServiceError.notAuthenticated
        }
        return (configuration, session)
    }

    private func signInAnonymously(using configuration: FirebaseConfiguration) async throws -> FirebaseSession {
        let url = URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=\(configuration.apiKey)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["returnSecureToken": true])

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(FirebaseSession.self, from: data)
    }

    private func fetchListings(configuration: FirebaseConfiguration, session: FirebaseSession) async throws -> [Listing] {
        let url = URL(string: "https://firestore.googleapis.com/v1/projects/\(configuration.projectID)/databases/(default)/documents/homeswipeListings?pageSize=100")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(session.idToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FirebaseServiceError.invalidResponse
        }

        if httpResponse.statusCode == 404 {
            return []
        }

        try validate(response: response, data: data)
        let payload = try JSONDecoder().decode(FirestoreDocumentListResponse.self, from: data)

        return try payload.documents?.map {
            let listing: Listing = try decodeModel(from: $0)
            return listing.id.isEmpty ? listing.withID(documentID(from: $0.name)) : listing
        } ?? []
    }

    private func fetchUserData(configuration: FirebaseConfiguration, session: FirebaseSession) async throws -> HomeSwipeUserData? {
        let url = URL(string: "https://firestore.googleapis.com/v1/projects/\(configuration.projectID)/databases/(default)/documents/homeswipeUsers/\(session.localID)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(session.idToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FirebaseServiceError.invalidResponse
        }

        if httpResponse.statusCode == 404 {
            return nil
        }

        try validate(response: response, data: data)
        let document = try JSONDecoder().decode(FirestoreDocument.self, from: data)
        return try decodeModel(from: document)
    }

    private func patchDocument<Model: Encodable>(
        path: String,
        model: Model,
        configuration: FirebaseConfiguration,
        session: FirebaseSession
    ) async throws {
        let url = URL(string: "https://firestore.googleapis.com/v1/projects/\(configuration.projectID)/databases/(default)/documents/\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(session.idToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(FirestoreWriteDocument(fields: makeFirestoreFields(from: model)))

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw FirebaseServiceError.invalidResponse
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            if let body = String(data: data, encoding: .utf8) {
                throw NSError(domain: "FirebaseService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: body])
            }
            throw FirebaseServiceError.invalidResponse
        }
    }

    private func makeFirestoreFields<Model: Encodable>(from model: Model) throws -> [String: FirestoreValue] {
        let data = try JSONEncoder().encode(model)
        let object = try JSONSerialization.jsonObject(with: data)

        guard let dictionary = object as? [String: Any] else {
            return [:]
        }

        return dictionary.mapValues(FirestoreValue.init(any:))
    }

    private func decodeModel<Model: Decodable>(from document: FirestoreDocument) throws -> Model {
        let jsonObject = document.fields.mapValues { $0.anyValue }
        let data = try JSONSerialization.data(withJSONObject: jsonObject)
        return try JSONDecoder().decode(Model.self, from: data)
    }

    private func documentID(from path: String) -> String {
        path.split(separator: "/").last.map(String.init) ?? ""
    }
}

private struct FirestoreWriteDocument: Encodable {
    let fields: [String: FirestoreValue]
}

private struct FirestoreDocumentListResponse: Decodable {
    let documents: [FirestoreDocument]?
}

private struct FirestoreDocument: Decodable {
    let name: String
    let fields: [String: FirestoreValue]
}

private struct FirestoreArrayValue: Codable {
    let values: [FirestoreValue]?
}

private struct FirestoreMapValue: Codable {
    let fields: [String: FirestoreValue]?
}

private struct FirestoreValue: Codable {
    var stringValue: String?
    var integerValue: String?
    var doubleValue: Double?
    var booleanValue: Bool?
    var arrayValue: FirestoreArrayValue?
    var mapValue: FirestoreMapValue?
    var nullValue: String?

    nonisolated init(any: Any) {
        switch any {
        case let value as String:
            stringValue = value
        case let value as NSNumber where CFGetTypeID(value) == CFBooleanGetTypeID():
            booleanValue = value.boolValue
        case let value as NSNumber:
            if value.doubleValue.rounded(.towardZero) == value.doubleValue {
                integerValue = String(value.intValue)
            } else {
                doubleValue = value.doubleValue
            }
        case let value as [Any]:
            arrayValue = FirestoreArrayValue(values: value.map(FirestoreValue.init(any:)))
        case let value as [String: Any]:
            mapValue = FirestoreMapValue(fields: value.mapValues(FirestoreValue.init(any:)))
        default:
            nullValue = "NULL_VALUE"
        }
    }

    nonisolated var anyValue: Any {
        if let stringValue { return stringValue }
        if let integerValue { return Int(integerValue) ?? 0 }
        if let doubleValue { return doubleValue }
        if let booleanValue { return booleanValue }
        if let arrayValue { return arrayValue.values?.map(\.anyValue) ?? [] }
        if let mapValue { return mapValue.fields?.mapValues(\.anyValue) ?? [:] }
        return NSNull()
    }
}

private extension Listing {
    func withID(_ id: String) -> Listing {
        Listing(
            id: id,
            kind: kind,
            title: title,
            location: location,
            price: price,
            meta: meta,
            host: host,
            imageURL: imageURL,
            tag: tag,
            description: description,
            amenities: amenities,
            details: details
        )
    }
}
