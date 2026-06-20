import SwiftUI
import Observation
import UniformTypeIdentifiers

struct ContentView: View {
    @State private var store = HomeSwipeStore()

    var body: some View {
        ZStack {
            Color(hex: "#f8fafc").ignoresSafeArea()

            if store.didCompleteOnboarding {
                ZStack(alignment: .bottom) {
                    VStack(spacing: 0) {
                        Group {
                            switch store.activeTab {
                            case .home:
                                HomeScreen(store: $store)
                            case .tools:
                                ToolsScreen(store: $store)
                            case .messages:
                                MessagesScreen(store: $store)
                            case .profile:
                                ProfileScreen(store: $store)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                        Spacer(minLength: 92)
                    }

                    BottomTabBar(activeTab: $store.activeTab)
                }
            } else {
                OnboardingScreen(store: $store)
            }
        }
        .sheet(item: $store.selectedListing) { listing in
            ListingDetailView(
                listing: listing,
                isSaved: store.savedListingIDs.contains(listing.id),
                affordabilityProfile: store.affordabilityProfileContext,
                onToggleSaved: { store.toggleSaved(listing) },
                onSubmitToolApplication: { title, report in
                    store.submitToolApplication(title: title, report: report)
                }
            )
        }
        .task {
            await store.startFirebase()
        }
    }
}

enum OnboardingRole: String, CaseIterable, Identifiable, Codable {
    case tenant = "Looking for a Home"
    case lister = "Listing Property"

    var id: String { rawValue }

    var profileLabel: String {
        switch self {
        case .tenant:
            return "Tenant"
        case .lister:
            return "Lister"
        }
    }
}

enum VerificationState: String, Codable {
    case notVerified = "Not Verified"
    case pendingReview = "Pending Review"
    case verified = "Verified"
}

enum AppTab: String, CaseIterable, Identifiable, Codable {
    case home = "Home"
    case tools = "Tools"
    case messages = "Messages"
    case profile = "Profile"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .home:
            return "house"
        case .tools:
            return "wrench.and.screwdriver"
        case .messages:
            return "message"
        case .profile:
            return "person.crop.circle"
        }
    }
}

enum ListingKind: String, CaseIterable, Identifiable, Codable {
    case rentals = "Rentals"
    case sales = "For sale"
    case stands = "Stands"

    var id: String { rawValue }
}

enum ProfileView: String, CaseIterable, Identifiable, Codable {
    case overview
    case myHomes
    case personal
    case saved
    case applications
    case documents
    case support

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview:
            return "Profile"
        case .myHomes:
            return "My homes"
        case .personal:
            return "Personal Information"
        case .saved:
            return "Saved"
        case .applications:
            return "Applications"
        case .documents:
            return "Verification Center"
        case .support:
            return "Support"
        }
    }
}

struct Listing: Identifiable, Hashable, Codable {
    let id: String
    let kind: ListingKind
    var title: String
    var location: String
    var price: String
    var meta: String
    var host: String
    var imageURL: String
    var tag: String
    var description: String
    var amenities: [String]
    var details: [String]
}

struct Conversation: Identifiable, Hashable, Codable {
    let id: String
    let person: String
    let role: String
    let listingTitle: String
    var profile: PublicProfileSnapshot?
    var time: String
    var messages: [String]
}

struct PublicProfileSnapshot: Hashable, Codable {
    var name = ""
    var role = ""
    var verification = ""
    var location = ""
    var budget = ""
    var propertyTypes: [String] = []
    var amenities: [String] = []
    var employmentStatus = ""
    var householdTypes: [String] = []
    var leasePreferences: [String] = []
    var primaryLocation = ""
    var propertyCount = ""
    var listerType = ""
}

struct RentalApplication: Identifiable, Hashable, Codable {
    let id: String
    let listingID: String
    let property: String
    let landlord: String
    let status: String
    let submitted: String
    let nextStep: String
}

struct LeaseDraft: Identifiable, Hashable, Codable {
    let id: String
    let property: String
    let landlord: String
    let tenant: String
    let rent: String
    let deposit: String
    let startDate: String
    let endDate: String
    let utilities: String
    let petPolicy: String
    let parking: String
    var status: String
    var landlordSigned: Bool
    var tenantSigned: Bool
}

struct VerificationDocument: Identifiable, Hashable, Codable {
    let id: String
    let title: String
    var status: String
    let standard: String
    let risk: String
    var fileName = ""
}

struct VerificationSignal: Identifiable, Hashable {
    let id = UUID()
    let source: String
    let label: String
    let status: String
    let detail: String
}

struct AffordabilityProfileContext {
    let monthlyIncome: Double
    let monthlyIncomeLabel: String
    let verificationStatus: String
    let currentLocation: String
    let userType: String
}

struct AffordabilityAnswers {
    var employmentStatus = ""
    var employer = ""
    var yearsEmployed = ""
    var hasLoans: Bool?
    var loanRepayment = ""
    var deposit = ""
}

struct ListingDraft {
    var propertyType = ""
    var spaceType = ""
    var location = ""
    var area = ""
    var city = ""
    var price = ""
}

struct ListingEditDraft {
    var title = ""
    var location = ""
    var price = ""
    var meta = ""
    var description = ""
}

struct AccountProfileInput: Codable {
    var fullName = ""
    var email = ""
    var phone = ""
    var employer = ""
    var monthlyBudget = ""
    var password = ""
    var forgotPasswordMessage = ""

    enum CodingKeys: String, CodingKey {
        case fullName
        case email
        case phone
        case employer
        case monthlyBudget
    }
}

struct TenantOnboardingInput: Codable {
    var city = ""
    var budget = ""
    var propertyTypes: Set<String> = []
    var amenities: Set<String> = []
    var employmentStatus = ""
    var householdTypes: Set<String> = []
    var leasePreferences: Set<String> = []
}

struct ListerOnboardingInput: Codable {
    var listerType = ""
    var primaryLocation = ""
    var propertyCount = ""
}

let verificationRoleOptions = [
    "Landlord / Property Owner",
    "Property Manager",
    "Real Estate Agent",
    "Property Developer",
    "Estate Agency"
]

func requiredVerificationDocuments(for role: OnboardingRole?, listerType: String) -> [VerificationDocument] {
    func document(_ id: String, _ title: String, _ standard: String) -> VerificationDocument {
        VerificationDocument(id: id, title: title, status: "Missing", standard: standard, risk: "Required")
    }

    guard role == .lister else {
        return [
            document("national-id-passport", "National ID / Passport", "Upload a valid national ID or passport."),
            document("proof-of-income", "Proof of Income", "Upload a payslip, employment letter, or bank statement."),
            document("police-clearance", "Police Clearance Certificate", "Upload a police clearance certificate.")
        ]
    }

    switch listerType {
    case "Landlord / Property Owner":
        return [
            document("national-id-passport", "National ID / Passport", "Upload a valid national ID or passport."),
            document("title-deed-ownership", "Title Deed or Proof of Property Ownership", "Upload a title deed or accepted proof that you own the property.")
        ]
    case "Property Manager":
        return [
            document("national-id-passport", "National ID / Passport", "Upload a valid national ID or passport."),
            document("company-registration", "Company Registration Documents", "Upload company registration documents for the managing business."),
            document("management-authority", "Property Management Agreement or Letter of Authority", "Upload the agreement or authority letter proving you can manage the property.")
        ]
    case "Real Estate Agent":
        return [
            document("national-id-passport", "National ID / Passport", "Upload a valid national ID or passport.")
        ]
    case "Property Developer":
        return [
            document("national-id-passport", "National ID / Passport", "Upload a valid national ID or passport."),
            document("company-registration", "Company Registration Documents", "Upload company registration documents for the development company."),
            document("development-permit", "Development Permit / Project Approval Documents", "Upload the development permit or approved project documents.")
        ]
    case "Estate Agency":
        return [
            document("agency-licence", "Real Estate Agency Licence", "Upload the real estate agency licence.")
        ]
    default:
        return [
            document("national-id-passport", "National ID / Passport", "Upload a valid national ID or passport.")
        ]
    }
}

struct LeaseDraftInput {
    var property = ""
    var landlord = ""
    var tenant = ""
    var rent = ""
    var deposit = ""
    var startDate = ""
    var endDate = ""
    var utilities = ""
    var petPolicy = ""
    var parking = ""
}

enum ToolKind: String, CaseIterable, Identifiable {
    case homeLoan = "Home Loan Affordability"
    case rentLoan = "Rent Loan"
    case householdInsurance = "Household Insurance"
    case propertyUpgrades = "Property Upgrades"
    case buildingFinancing = "Building Financing"
    case homeInsurance = "Home Insurance"
    case leases = "Lease PDF Generator"

    var id: String { rawValue }

    var subtitle: String {
        switch self {
        case .homeLoan: return "Estimate buying power"
        case .rentLoan: return "Rent support finance"
        case .householdInsurance: return "Contents cover estimate"
        case .propertyUpgrades: return "Managed upgrades finance"
        case .buildingFinancing: return "Build-stage finance"
        case .homeInsurance: return "Property cover estimate"
        case .leases: return "Create and share leases"
        }
    }

    var icon: String {
        switch self {
        case .homeLoan: return "house"
        case .rentLoan: return "banknote"
        case .householdInsurance: return "shield"
        case .propertyUpgrades: return "hammer"
        case .buildingFinancing: return "building.2"
        case .homeInsurance: return "lock.shield"
        case .leases: return "doc.text"
        }
    }
}

struct ToolInputs {
    var currency = "USD"
    var income = ""
    var loanYears = "10"
    var deposit = ""
    var monthlyRent = ""
    var supportMonths = "1"
    var repaymentMonths = "6"
    var contentsValue = ""
    var coverType = "Standard"
    var insuranceItem = "Buildings"
    var insuranceSumInsured = ""
    var insuranceMonths = "12"
    var upgradeType = "Solar Installation"
    var propertyLocation = ""
    var upgradeBudget = ""
    var siteInspection = ""
    var siteInspectionDate = Date()
    var buildingStage = "Foundation"
    var standLocation = ""
    var buildBudget = ""
    var buildLoanYears = "5"
    var propertyValue = ""
    var propertyType = "House"
    var insuranceLocation = ""
}

struct ToolReport {
    let title: String
    let inputs: [(String, String)]
    let results: [(String, String)]
    var notes: [String] = []
}

struct HomeFilters {
    var minPrice = ""
    var maxPrice = ""
    var bedrooms = ""
    var bathrooms = ""
    var amenity = ""
    var savedOnly = false
}

@MainActor
@Observable
final class HomeSwipeStore {
    @ObservationIgnored
    private let firebase = FirebaseService()
    @ObservationIgnored
    private var didStartFirebase = false
    @ObservationIgnored
    private let onboardingCompleteKey = "homeswipe.onboarding.complete"
    @ObservationIgnored
    private let onboardingRoleKey = "homeswipe.onboarding.role"
    @ObservationIgnored
    private let verificationStateKey = "homeswipe.verification.state"
    @ObservationIgnored
    private let userSnapshotKey = "homeswipe.user.snapshot"
    @ObservationIgnored
    private let adminApplicationsEmail = "homeswipelistings@gmail.com"
    @ObservationIgnored
    private static let demoConversationIDs: Set<String> = ["moyo-properties", "tari-m", "prime-estates"]

    var activeTab: AppTab = .home
    var activeKind: ListingKind = .rentals
    var activeProfileView: ProfileView = .overview
    var searchText = ""
    var filters = HomeFilters()
    var showFilters = false
    var showAddListing = false
    var listingDraft = ListingDraft()
    var firebaseStatus = "Not configured"
    var profileName = "Guest"
    var didCompleteOnboarding = false
    var onboardingStep = 0
    var onboardingRole: OnboardingRole?
    var signUpMethod = "Google"
    var account = AccountProfileInput()
    var tenantOnboarding = TenantOnboardingInput()
    var listerOnboarding = ListerOnboardingInput()
    var verificationState: VerificationState = .notVerified
    var selectedListing: Listing?
    var savedListingIDs: Set<String> = ["1", "4"]
    var activeConversationID = ""
    var replyDraft = ""
    var showsConversationProfile = false
    var verificationSignals: [VerificationSignal] = []

    var listings: [Listing] = [
        Listing(
            id: "1",
            kind: .rentals,
            title: "Sunny 2 bed apartment",
            location: "Borrowdale, Harare",
            price: "$850/mo",
            meta: "2 beds · 2 baths · gated",
            host: "Moyo Properties",
            imageURL: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
            tag: "Available now",
            description: "A bright apartment with open-plan living, secure access, and quick access to Borrowdale shops and schools.",
            amenities: ["Gated security", "Backup water", "Fitted kitchen", "Balcony"],
            details: ["2 bedrooms", "2 bathrooms", "Covered parking", "Available immediately"]
        ),
        Listing(
            id: "2",
            kind: .rentals,
            title: "Modern garden cottage",
            location: "Avondale, Harare",
            price: "$520/mo",
            meta: "1 bed · furnished · Wi-Fi",
            host: "Tari Homes",
            imageURL: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
            tag: "Verified landlord",
            description: "A compact furnished cottage with a private garden, ideal for a single professional or couple.",
            amenities: ["Furnished", "Wi-Fi ready", "Private garden", "Solar backup"],
            details: ["1 bedroom", "1 bathroom", "Shared gate", "Month-to-month accepted"]
        ),
        Listing(
            id: "3",
            kind: .sales,
            title: "Family home with pool",
            location: "Greendale, Harare",
            price: "$180,000",
            meta: "4 beds · 3 baths · title deed",
            host: "Prime Estates",
            imageURL: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80",
            tag: "For sale",
            description: "A spacious family home with mature trees, generous entertainment space, and a clean title deed.",
            amenities: ["Swimming pool", "Title deed", "Staff quarters", "Borehole"],
            details: ["4 bedrooms", "3 bathrooms", "Double garage", "1,800 sqm stand"]
        ),
        Listing(
            id: "4",
            kind: .sales,
            title: "Townhouse near schools",
            location: "Newlands, Harare",
            price: "$130,000",
            meta: "3 beds · garage · solar",
            host: "Kudu Realty",
            imageURL: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
            tag: "Viewing today",
            description: "Low-maintenance townhouse near schools and shops, with modern finishes and reliable solar power.",
            amenities: ["Solar system", "Garage", "Modern kitchen", "Secure complex"],
            details: ["3 bedrooms", "2.5 bathrooms", "Sectional title", "Viewing slots open"]
        ),
        Listing(
            id: "5",
            kind: .stands,
            title: "Ready-to-build stand",
            location: "Ruwa, Mashonaland East",
            price: "$28,000",
            meta: "600 sqm · serviced · cession",
            host: "Stand Market",
            imageURL: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
            tag: "Stands",
            description: "Serviced residential stand in a growing suburb with road access and paperwork ready for transfer.",
            amenities: ["Serviced land", "Road access", "Council approved", "Ready to build"],
            details: ["600 sqm", "Cession", "Flat terrain", "Marked boundaries"]
        ),
        Listing(
            id: "6",
            kind: .stands,
            title: "Corner stand in new suburb",
            location: "Norton, Mashonaland West",
            price: "$18,500",
            meta: "900 sqm · road access · council",
            host: "Green Acre Land",
            imageURL: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
            tag: "Popular",
            description: "A corner stand with generous frontage in a developing area suited for a family home or investment build.",
            amenities: ["Corner stand", "Road frontage", "Council paperwork", "Investment area"],
            details: ["900 sqm", "Council stand", "Road access", "Flexible payment terms"]
        )
    ]

    var conversations: [Conversation] = []

    var applications: [RentalApplication] = []

    var leases: [LeaseDraft] = []
    var leaseDraft = LeaseDraftInput()

    var documents: [VerificationDocument] = requiredVerificationDocuments(for: .tenant, listerType: "")

    init() {
        didCompleteOnboarding = UserDefaults.standard.bool(forKey: onboardingCompleteKey)
        loadLocalUserSnapshot()
        if let roleValue = UserDefaults.standard.string(forKey: onboardingRoleKey) {
            onboardingRole = OnboardingRole(rawValue: roleValue)
        }
        if let statusValue = UserDefaults.standard.string(forKey: verificationStateKey),
           let savedStatus = VerificationState(rawValue: statusValue) {
            verificationState = savedStatus
        }
        configureVerificationDocuments()
    }

    var activeHomeFilterCount: Int {
        [
            filters.minPrice,
            filters.maxPrice,
            filters.bedrooms,
            filters.bathrooms,
            filters.amenity,
            filters.savedOnly ? "saved" : ""
        ]
            .filter { !$0.isEmpty }
            .count
    }

    var filteredListings: [Listing] {
        listings.filter { listing in
            let matchesKind = listing.kind == activeKind
            let searchBlob = listingSearchText(listing)
            let normalizedSearch = normalizeSearch(searchText)
            let matchesSearch = normalizedSearch.isEmpty || searchBlob.contains(normalizedSearch)
            let matchesAmenity = filters.amenity.isEmpty || searchBlob.contains(filters.amenity.lowercased())
            let matchesSaved = !filters.savedOnly || savedListingIDs.contains(listing.id)
            let price = numberValue(in: listing.price)
            let minPrice = numberValue(in: filters.minPrice)
            let maxPrice = numberValue(in: filters.maxPrice)
            let bedrooms = numberValue(in: filters.bedrooms)
            let bathrooms = numberValue(in: filters.bathrooms)
            let listingBedrooms = numberValue(in: listing.meta + " " + listing.details.joined(separator: " "))
            let listingBathrooms = numberValue(in: listing.meta + " " + listing.details.joined(separator: " "))

            return matchesKind
                && matchesSearch
                && matchesAmenity
                && matchesSaved
                && (minPrice == 0 || price >= minPrice)
                && (maxPrice == 0 || price <= maxPrice)
                && (bedrooms == 0 || listingBedrooms >= bedrooms)
                && (bathrooms == 0 || listingBathrooms >= bathrooms)
        }
        .sorted { first, second in
            let normalizedSearch = normalizeSearch(searchText)
            if !normalizedSearch.isEmpty {
                return listingSearchScore(first, for: normalizedSearch) > listingSearchScore(second, for: normalizedSearch)
            }
            return first.title < second.title
        }
    }

    var searchSuggestions: [String] {
        let normalized = normalizeSearch(searchText)
        let listingParts = listings
            .filter { $0.kind == activeKind }
            .flatMap { listing in
                [listing.location, listing.title, listing.meta, listing.price, listing.description] + listing.amenities + listing.details
            }
        let terms = (Self.zimbabweSearchTerms + listingParts)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0.count > 1 }
        var seen = Set<String>()
        let unique = terms.filter { seen.insert(normalizeSearch($0)).inserted }
        if normalized.isEmpty {
            return Array(unique.prefix(10))
        }
        let matching = unique.filter { suggestionScore($0, query: normalized) > 0 }
        let sorted = matching.sorted { first, second in
            let firstScore = suggestionScore(first, query: normalized)
            let secondScore = suggestionScore(second, query: normalized)
            if firstScore == secondScore {
                return first.count < second.count
            }
            return firstScore > secondScore
        }
        return Array(sorted.prefix(10))
    }

    var savedListings: [Listing] {
        listings.filter { savedListingIDs.contains($0.id) }
    }

    var myListings: [Listing] {
        listings.filter { listing in
            listing.host == profileName || listing.tag == "New"
        }
    }

    var verificationBadgeName: String {
        verificationState == .verified ? "\(profileName) ✓" : profileName
    }

    var verificationRoleLabel: String {
        if onboardingRole == .lister {
            return listerOnboarding.listerType.isEmpty ? "Lister" : listerOnboarding.listerType
        }

        return "Tenant"
    }

    var uploadedDocumentCount: Int {
        documents.filter { $0.status == "Verified" }.count
    }

    var hasUploadedAllRequiredDocuments: Bool {
        !documents.isEmpty && uploadedDocumentCount == documents.count
    }

    var affordabilityProfileContext: AffordabilityProfileContext {
        let location: String
        if onboardingRole == .lister {
            location = listerOnboarding.primaryLocation.isEmpty ? "Not set" : listerOnboarding.primaryLocation
        } else {
            location = tenantOnboarding.city.isEmpty ? "Not set" : tenantOnboarding.city
        }

        let income = estimatedMonthlyIncomeFromBudget(tenantOnboarding.budget)
        return AffordabilityProfileContext(
            monthlyIncome: income,
            monthlyIncomeLabel: income > 0 ? "$\(Int(income)) per month" : "Not on profile",
            verificationStatus: verificationState.rawValue,
            currentLocation: location,
            userType: onboardingRole?.profileLabel ?? "Tenant"
        )
    }

    var isTenantOnboardingComplete: Bool {
        !tenantOnboarding.city.isEmpty
            && !tenantOnboarding.budget.isEmpty
            && !tenantOnboarding.propertyTypes.isEmpty
            && !tenantOnboarding.employmentStatus.isEmpty
    }

    var isListerOnboardingComplete: Bool {
        !listerOnboarding.listerType.isEmpty
            && !listerOnboarding.primaryLocation.isEmpty
            && !listerOnboarding.propertyCount.isEmpty
    }

    var activeConversation: Conversation? {
        conversations.first(where: { $0.id == activeConversationID })
    }

    var publicProfileSnapshot: PublicProfileSnapshot {
        PublicProfileSnapshot(
            name: profileName,
            role: verificationRoleLabel,
            verification: verificationState.rawValue,
            location: onboardingRole == .tenant ? tenantOnboarding.city : listerOnboarding.primaryLocation,
            budget: tenantOnboarding.budget,
            propertyTypes: Array(tenantOnboarding.propertyTypes).sorted(),
            amenities: Array(tenantOnboarding.amenities).sorted(),
            employmentStatus: tenantOnboarding.employmentStatus,
            householdTypes: Array(tenantOnboarding.householdTypes).sorted(),
            leasePreferences: Array(tenantOnboarding.leasePreferences).sorted(),
            primaryLocation: listerOnboarding.primaryLocation,
            propertyCount: listerOnboarding.propertyCount,
            listerType: listerOnboarding.listerType
        )
    }

    private var currentUserData: HomeSwipeUserData {
        HomeSwipeUserData(
            profileName: profileName,
            signUpMethod: signUpMethod,
            account: account,
            onboardingRole: onboardingRole,
            tenantOnboarding: tenantOnboarding,
            listerOnboarding: listerOnboarding,
            publicProfile: publicProfileSnapshot,
            verificationState: verificationState,
            verificationDocuments: documents,
            applications: applications,
            conversations: conversations,
            leases: leases,
            savedListingIDs: Array(savedListingIDs)
        )
    }

    func startFirebase() async {
        guard !didStartFirebase else { return }
        didStartFirebase = true

        let configured = firebase.isConfigured()
        guard configured else {
            firebaseStatus = "Not configured"
            return
        }

        firebaseStatus = "Connecting"

        do {
            let remoteState = try await firebase.connectAndLoad()

            if !remoteState.listings.isEmpty {
                listings = mergeListings(local: listings, remote: remoteState.listings)
            }

            if let userData = remoteState.userData {
                applyUserData(userData)
                applications = userData.applications.filter { !Self.demoApplicationIDs.contains($0.id) }
                conversations = userData.conversations.filter { !Self.demoConversationIDs.contains($0.id) }
                leases = userData.leases.filter { !Self.demoLeaseIDs.contains($0.id) }
                savedListingIDs = Set(userData.savedListingIDs)
            } else {
                try await firebase.saveUserData(currentUserData)
            }

            firebaseStatus = "Synced"
        } catch {
            firebaseStatus = "Offline"
        }
    }

    func toggleSaved(_ listing: Listing) {
        if savedListingIDs.contains(listing.id) {
            savedListingIDs.remove(listing.id)
        } else {
            savedListingIDs.insert(listing.id)
        }
        syncUserData()
    }

    func addListing() {
        let location = [listingDraft.area, listingDraft.city]
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .joined(separator: ", ")

        let listing = Listing(
            id: UUID().uuidString,
            kind: activeKind,
            title: listingDraft.propertyType.isEmpty ? "New listing" : listingDraft.propertyType,
            location: listingDraft.location.isEmpty ? location : listingDraft.location,
            price: listingDraft.price.isEmpty ? "Price on request" : "$\(listingDraft.price)",
            meta: listingDraft.spaceType.isEmpty ? "Details available on request" : listingDraft.spaceType,
            host: profileName,
            imageURL: listings.first?.imageURL ?? "",
            tag: "New",
            description: "Recently added from the SwiftUI listing form.",
            amenities: ["Direct listing"],
            details: ["Awaiting full details"]
        )

        listings.insert(listing, at: 0)
        showAddListing = false
        listingDraft = ListingDraft()
        syncUserData()
        syncListing(listing)
    }

    func updateListing(_ listing: Listing) {
        guard let index = listings.firstIndex(where: { $0.id == listing.id }) else { return }
        listings[index] = listing
        syncUserData()
        syncListing(listing)
    }

    func deleteListing(_ listing: Listing) {
        listings.removeAll { $0.id == listing.id }
        savedListingIDs.remove(listing.id)
        if selectedListing?.id == listing.id {
            selectedListing = nil
        }
        syncUserData()
        deleteRemoteListing(listing)
    }

    func createLease() {
        let property = leaseDraft.property.trimmingCharacters(in: .whitespacesAndNewlines)
        let landlord = leaseDraft.landlord.trimmingCharacters(in: .whitespacesAndNewlines)
        let tenant = leaseDraft.tenant.trimmingCharacters(in: .whitespacesAndNewlines)
        let rent = leaseDraft.rent.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !property.isEmpty, !landlord.isEmpty, !tenant.isEmpty, !rent.isEmpty else {
            return
        }

        let lease = LeaseDraft(
            id: UUID().uuidString,
            property: property,
            landlord: landlord,
            tenant: tenant,
            rent: rent,
            deposit: leaseDraft.deposit.isEmpty ? "No deposit recorded" : leaseDraft.deposit,
            startDate: leaseDraft.startDate.isEmpty ? "Start date to be confirmed" : leaseDraft.startDate,
            endDate: leaseDraft.endDate.isEmpty ? "End date to be confirmed" : leaseDraft.endDate,
            utilities: leaseDraft.utilities.isEmpty ? "Utilities to be agreed in writing." : leaseDraft.utilities,
            petPolicy: leaseDraft.petPolicy.isEmpty ? "Pet policy to be agreed in writing." : leaseDraft.petPolicy,
            parking: leaseDraft.parking.isEmpty ? "Parking to be agreed in writing." : leaseDraft.parking,
            status: "Draft",
            landlordSigned: false,
            tenantSigned: false
        )

        leases.insert(lease, at: 0)
        leaseDraft = LeaseDraftInput()
        syncUserData()
    }

    func deleteLease(_ lease: LeaseDraft) {
        leases.removeAll { $0.id == lease.id }
        syncUserData()
    }

    func sendReply() {
        let trimmed = replyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = conversations.firstIndex(where: { $0.id == activeConversationID }) else {
            return
        }

        conversations[index].messages.append(trimmed)
        replyDraft = ""
        syncUserData()
    }

    func startChat(for listing: Listing) {
        let conversationID = "listing-\(listing.id)"
        if let index = conversations.firstIndex(where: { $0.id == conversationID }) {
            conversations[index].time = "Now"
        } else {
            conversations.insert(
                Conversation(
                    id: conversationID,
                    person: listing.host,
                    role: listing.kind == .rentals ? "Landlord" : "Agent",
                    listingTitle: listing.title,
                    profile: profileSnapshot(for: listing),
                    time: "Now",
                    messages: ["Hi, I am interested in \(listing.title). Is it still available?"]
                ),
                at: 0
            )
        }
        activeConversationID = conversationID
        showsConversationProfile = false
        activeTab = .messages
        syncUserData()
    }

    func markDocumentReady(_ document: VerificationDocument, fileName: String = "Uploaded document") {
        guard let index = documents.firstIndex(of: document) else { return }
        documents[index].status = "Verified"
        documents[index].fileName = fileName
        verificationState = documents.allSatisfy { $0.status == "Verified" } ? .verified : .pendingReview
        persistOnboardingState()
        persistLocalUserSnapshot()
        syncUserData()
    }

    func skipOnboardingVerification() {
        configureVerificationDocuments()
        verificationState = .notVerified
        persistOnboardingState()
        advanceOnboarding()
    }

    func advanceOnboarding() {
        if onboardingStep == 0 {
            configureVerificationDocuments()
            onboardingStep = 1
            persistLocalUserSnapshot()
            return
        }

        onboardingStep += 1
        if onboardingStep == verificationStepIndex {
            configureVerificationDocuments()
        }
        persistLocalUserSnapshot()
        if onboardingStep > finalOnboardingStep {
            finishOnboarding()
        }
    }

    func finishOnboarding() {
        didCompleteOnboarding = true
        onboardingStep = 0

        if onboardingRole == .tenant {
            activeTab = .home
            activeKind = .rentals
            searchText = ""
            filters.amenity = tenantOnboarding.amenities.first ?? ""
        } else {
            activeTab = .profile
        }

        persistOnboardingState()
        persistLocalUserSnapshot()
        syncUserData()
    }

    func openVerificationCenter() {
        activeProfileView = .documents
        activeTab = .profile
    }

    func configureVerificationDocuments() {
        let currentByID = Dictionary(uniqueKeysWithValues: documents.map { ($0.id, $0) })
        documents = requiredVerificationDocuments(for: onboardingRole, listerType: listerOnboarding.listerType).map { required in
            guard let existing = currentByID[required.id] else { return required }
            var merged = required
            merged.status = existing.status
            merged.fileName = existing.fileName
            return merged
        }
    }

    private func persistOnboardingState() {
        if !account.fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            profileName = account.fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        UserDefaults.standard.set(didCompleteOnboarding, forKey: onboardingCompleteKey)
        if let onboardingRole {
            UserDefaults.standard.set(onboardingRole.rawValue, forKey: onboardingRoleKey)
        }
        UserDefaults.standard.set(verificationState.rawValue, forKey: verificationStateKey)
    }

    var verificationStepIndex: Int {
        onboardingRole == .tenant ? 9 : 5
    }

    var finalOnboardingStep: Int {
        onboardingRole == .tenant ? 10 : 6
    }

    func continueFromSignup() {
        if signUpMethod != "Email" {
            account.forgotPasswordMessage = ""
            if account.fullName.isEmpty {
                profileName = signUpMethod == "Apple" ? "Apple User" : "Google User"
                account.fullName = profileName
            }
            onboardingStep = 1
            persistLocalUserSnapshot()
            return
        }

        profileName = account.fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Guest" : account.fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        account.forgotPasswordMessage = ""
        onboardingStep = 1
        persistLocalUserSnapshot()
    }

    func requestPasswordReset() {
        let email = account.email.trimmingCharacters(in: .whitespacesAndNewlines)
        account.forgotPasswordMessage = email.isEmpty ? "Enter your email first, then request a reset link." : "Password reset request prepared for \(email)."
        persistLocalUserSnapshot()
    }

    func saveProfileDetails() {
        let name = account.fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        let email = account.email.trimmingCharacters(in: .whitespacesAndNewlines)
        account.fullName = name
        account.email = email
        account.phone = account.phone.trimmingCharacters(in: .whitespacesAndNewlines)
        account.employer = account.employer.trimmingCharacters(in: .whitespacesAndNewlines)
        account.monthlyBudget = account.monthlyBudget.trimmingCharacters(in: .whitespacesAndNewlines)
        account.password = ""
        account.forgotPasswordMessage = ""
        profileName = name.isEmpty ? profileName : name
        activeProfileView = .overview
        syncUserData()
    }

    func submitToolApplication(title: String, report: ToolReport) {
        let submittedDate = Date.now.formatted(date: .abbreviated, time: .omitted)
        let summary = report.results.prefix(3).map { "\($0.0): \($0.1)" }.joined(separator: " · ")
        let application = RentalApplication(
            id: UUID().uuidString,
            listingID: "tool-\(title.lowercased().replacingOccurrences(of: " ", with: "-"))",
            property: title,
            landlord: "HomeSwipe Finance",
            status: "In Review",
            submitted: submittedDate,
            nextStep: "\(summary). Sent for HomeSwipe review at \(adminApplicationsEmail)."
        )
        applications.insert(application, at: 0)
        activeProfileView = .applications
        activeTab = .profile
        persistLocalUserSnapshot()
        syncUserData()
    }

    private func applyUserData(_ userData: HomeSwipeUserData) {
        profileName = userData.profileName ?? profileName
        signUpMethod = userData.signUpMethod ?? signUpMethod
        account = userData.account ?? account
        onboardingRole = userData.onboardingRole ?? onboardingRole
        tenantOnboarding = userData.tenantOnboarding ?? tenantOnboarding
        listerOnboarding = userData.listerOnboarding ?? listerOnboarding
        verificationState = userData.verificationState ?? verificationState
        if let remoteDocuments = userData.verificationDocuments, !remoteDocuments.isEmpty {
            documents = remoteDocuments
        }
        persistOnboardingState()
        persistLocalUserSnapshot()
    }

    private func persistLocalUserSnapshot() {
        if let data = try? JSONEncoder().encode(currentUserData) {
            UserDefaults.standard.set(data, forKey: userSnapshotKey)
        }
    }

    private func loadLocalUserSnapshot() {
        guard let data = UserDefaults.standard.data(forKey: userSnapshotKey),
              let snapshot = try? JSONDecoder().decode(HomeSwipeUserData.self, from: data) else {
            return
        }
        applyUserData(snapshot)
    }

    func runVerification() {
        let missingDocuments = documents.filter { $0.status == "Missing" }.count

        verificationSignals = [
            VerificationSignal(
                source: "HomeSwipe",
                label: missingDocuments > 0 ? "Required uploads incomplete" : "Required uploads complete",
                status: missingDocuments > 0 ? "Review" : "Pass",
                detail: missingDocuments > 0 ? "Upload every required document for \(verificationRoleLabel) to become verified." : "\(verificationRoleLabel) verification is complete."
            ),
            VerificationSignal(
                source: "Profile",
                label: verificationState.rawValue,
                status: verificationState == .verified ? "Pass" : "Review",
                detail: verificationState == .verified ? "Your profile badge is active." : "Your profile badge activates automatically after all required uploads are complete."
            )
        ]
    }

    func syncUserData() {
        persistOnboardingState()
        persistLocalUserSnapshot()
        guard firebaseStatus != "Not configured" else { return }
        let payload = currentUserData
        firebaseStatus = "Saving"

        Task {
            do {
                try await firebase.saveUserData(payload)
                await MainActor.run {
                    firebaseStatus = "Synced"
                }
            } catch {
                await MainActor.run {
                    firebaseStatus = "Offline"
                }
            }
        }
    }

    private func syncListing(_ listing: Listing) {
        guard firebaseStatus != "Not configured" else { return }

        Task {
            do {
                try await firebase.saveListing(listing)
                await MainActor.run {
                    firebaseStatus = "Synced"
                }
            } catch {
                await MainActor.run {
                    firebaseStatus = "Offline"
                }
            }
        }
    }

    private func deleteRemoteListing(_ listing: Listing) {
        guard firebaseStatus != "Not configured" else { return }

        Task {
            do {
                try await firebase.deleteListing(listing)
                await MainActor.run {
                    firebaseStatus = "Synced"
                }
            } catch {
                await MainActor.run {
                    firebaseStatus = "Offline"
                }
            }
        }
    }

    private func mergeListings(local: [Listing], remote: [Listing]) -> [Listing] {
        var merged = Dictionary(uniqueKeysWithValues: local.map { ($0.id, $0) })
        for listing in remote {
            merged[listing.id] = listing
        }
        return Array(merged.values)
    }

    private static let demoApplicationIDs: Set<String> = ["application-1", "application-2", "application-3"]
    private static let demoLeaseIDs: Set<String> = ["lease-1"]
    private static let zimbabweSearchTerms = [
        "Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo", "Chitungwiza", "Victoria Falls", "Kadoma", "Kwekwe", "Marondera", "Ruwa", "Norton",
        "Borrowdale", "Avondale", "Mount Pleasant", "Greendale", "Highlands", "Marlborough", "Eastlea", "Newlands", "Mabelreign", "Waterfalls",
        "Famona", "Khumalo", "Burnside", "Hillside", "Suburbs", "Cottage", "Apartment", "House", "Townhouse", "Stand", "Serviced stand",
        "Borehole", "Solar backup", "Gated", "Furnished", "Parking", "Pool", "Garden", "Road access", "Council stand"
    ]

    private func normalizeSearch(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    private func searchTokens(_ value: String) -> [String] {
        normalizeSearch(value)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 1 }
    }

    private func suggestionScore(_ suggestion: String, query: String) -> Int {
        let value = normalizeSearch(suggestion)
        if value.hasPrefix(query) {
            return 2
        }
        if value.contains(query) {
            return 1
        }
        return 0
    }

    private func listingSearchText(_ listing: Listing) -> String {
        normalizeSearch("\(listing.title) \(listing.location) \(listing.meta) \(listing.price) \(listing.description) \(listing.amenities.joined(separator: " ")) \(listing.details.joined(separator: " "))")
    }

    private func listingSearchScore(_ listing: Listing, for search: String) -> Int {
        let normalized = normalizeSearch(search)
        guard !normalized.isEmpty else { return 0 }
        let tokens = searchTokens(normalized)
        let title = normalizeSearch(listing.title)
        let location = normalizeSearch(listing.location)
        let meta = normalizeSearch(listing.meta)
        let amenities = normalizeSearch(listing.amenities.joined(separator: " "))
        let details = normalizeSearch(listing.details.joined(separator: " "))
        let searchable = listingSearchText(listing)
        var score = searchable.contains(normalized) ? 12 : 0
        for token in tokens {
            if title.contains(token) { score += 9 }
            if location.contains(token) { score += 8 }
            if amenities.contains(token) { score += 6 }
            if meta.contains(token) || details.contains(token) { score += 5 }
        }
        return score
    }

    private func profileSnapshot(for listing: Listing) -> PublicProfileSnapshot {
        PublicProfileSnapshot(
            name: listing.host,
            role: listing.kind == .rentals ? "Landlord" : "Agent",
            verification: listing.tag == "Verified landlord" ? VerificationState.verified.rawValue : "Listed on HomeSwipe",
            location: listing.location,
            primaryLocation: listing.location,
            propertyCount: "1+",
            listerType: listing.kind == .rentals ? "Landlord / Property Owner" : "Real Estate Agent"
        )
    }

    private func numberValue(in text: String) -> Double {
        let cleaned = text.replacingOccurrences(of: ",", with: "")
        let number = cleaned.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
        return Double(number) ?? 0
    }

    private func estimatedMonthlyIncomeFromBudget(_ budget: String) -> Double {
        switch budget {
        case "Under $200":
            return 600
        case "$200-$500":
            return 1150
        case "$500-$1000":
            return 2500
        case "$1000+":
            return 4000
        default:
            return 0
        }
    }
}

struct OnboardingScreen: View {
    @Binding var store: HomeSwipeStore
    @State private var documentPendingUpload: VerificationDocument?
    @State private var isDocumentImporterPresented = false

    private let cities = ["Harare", "Bulawayo", "Mutare", "Gweru", "Other"]
    private let budgets = ["Under $200", "$200-$500", "$500-$1000", "$1000+"]
    private let propertyTypes = ["Apartment", "House", "Cottage", "Room", "Townhouse"]
    private let amenities = ["Wi-Fi", "Parking", "Borehole", "Solar", "Security", "Furnished"]
    private let employmentStatuses = ["Employed", "Self-Employed", "Student", "Other"]
    private let householdTypes = ["Living Alone", "Couple", "Family", "Shared Accommodation", "Student Housing"]
    private let leasePreferences = ["Month-to-Month", "6 Months", "12 Months", "Long-Term"]
    private let listerTypes = verificationRoleOptions
    private let propertyCounts = ["1-5", "6-20", "20+"]

    var body: some View {
        Group {
            if store.onboardingStep == 0 {
                signUpStep
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 18) {
                        onboardingProgress

                        if store.onboardingStep == 1 {
                            roleStep
                        } else if store.onboardingRole == .tenant {
                            tenantStep
                        } else {
                            listerStep
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 24)
                    .padding(.bottom, 40)
                }
            }
        }
        .fileImporter(
            isPresented: $isDocumentImporterPresented,
            allowedContentTypes: [.pdf, .image],
            allowsMultipleSelection: false
        ) { result in
            guard let document = documentPendingUpload else { return }
            if case .success(let urls) = result, let url = urls.first {
                store.markDocumentReady(document, fileName: url.lastPathComponent)
            }
            documentPendingUpload = nil
        }
    }

    private var onboardingProgress: some View {
        HStack(spacing: 8) {
            ForEach(0...store.finalOnboardingStep, id: \.self) { step in
                Capsule()
                    .fill(step <= store.onboardingStep ? Color.hex("#0f766e") : Color.hex("#dbeafe"))
                    .frame(height: 5)
            }
        }
    }

    private var signUpStep: some View {
        WelcomeSignupScreen(
            store: $store,
            isEmailSignupComplete: isEmailSignupComplete
        )
    }

    private var isEmailSignupComplete: Bool {
        !store.account.fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && store.account.email.contains("@")
            && store.account.password.count >= 6
    }

    private var roleStep: some View {
        VStack(alignment: .leading, spacing: 18) {
            PageTitle(title: "How will you use HomeSwipe?", subtitle: "Choose one role. We will only ask for information relevant to that role.")
            VStack(alignment: .leading, spacing: 12) {
                ForEach(OnboardingRole.allCases) { role in
                    ChoiceButton(title: role.rawValue, isSelected: store.onboardingRole == role) {
                        store.onboardingRole = role
                    }
                }
            }
            .cardStyle()

            PrimaryOnboardingButton(title: "Continue", isEnabled: store.onboardingRole != nil) {
                store.advanceOnboarding()
            }
        }
    }

    @ViewBuilder
    private var tenantStep: some View {
        switch store.onboardingStep {
        case 2:
            VStack(alignment: .leading, spacing: 18) {
                SingleChoiceSection(title: "Which city are you searching in?", options: cities, selection: $store.tenantOnboarding.city)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.tenantOnboarding.city.isEmpty) { store.advanceOnboarding() }
            }
        case 3:
            VStack(alignment: .leading, spacing: 18) {
                SingleChoiceSection(title: "Monthly Budget", options: budgets, selection: $store.tenantOnboarding.budget)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.tenantOnboarding.budget.isEmpty) { store.advanceOnboarding() }
            }
        case 4:
            VStack(alignment: .leading, spacing: 18) {
                MultiChoiceSection(title: "Property Types", options: propertyTypes, selections: $store.tenantOnboarding.propertyTypes)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.tenantOnboarding.propertyTypes.isEmpty) { store.advanceOnboarding() }
            }
        case 5:
            VStack(alignment: .leading, spacing: 18) {
                MultiChoiceSection(title: "Amenities", options: amenities, selections: $store.tenantOnboarding.amenities)
                PrimaryOnboardingButton(title: "Continue", isEnabled: true) { store.advanceOnboarding() }
            }
        case 6:
            VStack(alignment: .leading, spacing: 18) {
                SingleChoiceSection(title: "Employment Status", options: employmentStatuses, selection: $store.tenantOnboarding.employmentStatus)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.tenantOnboarding.employmentStatus.isEmpty) { store.advanceOnboarding() }
            }
        case 7:
            VStack(alignment: .leading, spacing: 18) {
                MultiChoiceSection(title: "Household Type", options: householdTypes, selections: $store.tenantOnboarding.householdTypes)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.tenantOnboarding.householdTypes.isEmpty) { store.advanceOnboarding() }
            }
        case 8:
            VStack(alignment: .leading, spacing: 18) {
                MultiChoiceSection(title: "Lease Preference", options: leasePreferences, selections: $store.tenantOnboarding.leasePreferences)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.tenantOnboarding.leasePreferences.isEmpty) { store.advanceOnboarding() }
            }
        case 9:
            verificationStep(title: "Verification Optional", message: "Upload tenant documents now or finish them later from your Profile tab.")
        default:
            readyStep(title: "You're All Set", message: "Start discovering homes that match your preferences.", buttonTitle: "Start Browsing")
        }
    }

    @ViewBuilder
    private var listerStep: some View {
        switch store.onboardingStep {
        case 2:
            VStack(alignment: .leading, spacing: 18) {
                SingleChoiceSection(title: "I am a:", options: listerTypes, selection: $store.listerOnboarding.listerType)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.listerOnboarding.listerType.isEmpty) { store.advanceOnboarding() }
            }
        case 3:
            VStack(alignment: .leading, spacing: 18) {
                SingleChoiceSection(title: "Primary Location", options: cities, selection: $store.listerOnboarding.primaryLocation)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.listerOnboarding.primaryLocation.isEmpty) { store.advanceOnboarding() }
            }
        case 4:
            VStack(alignment: .leading, spacing: 18) {
                SingleChoiceSection(title: "Number of Properties", options: propertyCounts, selection: $store.listerOnboarding.propertyCount)
                PrimaryOnboardingButton(title: "Continue", isEnabled: !store.listerOnboarding.propertyCount.isEmpty) { store.advanceOnboarding() }
            }
        case 5:
            verificationStep(title: "Verification Optional", message: "Upload only the documents required for \(store.verificationRoleLabel), or finish later from Profile.")
        default:
            readyStep(title: "You're All Set", message: "Start managing listings, messages, and verification from your dashboard.", buttonTitle: "Go to Dashboard")
        }
    }

    private func verificationStep(title: String, message: String) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            PageTitle(title: title, subtitle: message)

            VStack(alignment: .leading, spacing: 10) {
                BenefitRow(text: "Only required documents for \(store.verificationRoleLabel)")
                BenefitRow(text: "Verification is optional during onboarding")
                BenefitRow(text: "Finish or update uploads from Profile")
            }
            .cardStyle()

            VStack(alignment: .leading, spacing: 12) {
                Text("Required uploads")
                    .font(.system(size: 18, weight: .heavy))
                ForEach(store.documents) { document in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: document.status == "Verified" ? "checkmark.seal.fill" : "doc.badge.plus")
                            .foregroundStyle(Color.hex("#0f766e"))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(document.title)
                                .font(.system(size: 15, weight: .bold))
                            Text(document.standard)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.hex("#64748b"))
                            if !document.fileName.isEmpty {
                                Text("Uploaded: \(document.fileName)")
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(Color.hex("#2563eb"))
                            }
                        }
                        Spacer()
                        if document.status == "Verified" {
                            Text("Uploaded")
                                .font(.system(size: 12, weight: .heavy))
                                .foregroundStyle(Color.hex("#2563eb"))
                        } else {
                            Button {
                                documentPendingUpload = document
                                isDocumentImporterPresented = true
                            } label: {
                                Text("Upload")
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(Color.hex("#0f766e"))
                                    .padding(.horizontal, 10)
                                    .frame(height: 32)
                                    .background(Color.hex("#f0fdfa"))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(12)
                    .background(Color.hex("#f8fafc"))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .cardStyle()

            PrimaryOnboardingButton(title: store.hasUploadedAllRequiredDocuments ? "Continue Verified" : "Finish Without Verification", isEnabled: true) {
                store.advanceOnboarding()
            }
            SecondaryOnboardingButton(title: "Open Verification Later In Profile") {
                store.skipOnboardingVerification()
            }
        }
    }

    private func readyStep(title: String, message: String, buttonTitle: String) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Spacer(minLength: 80)
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 58, weight: .bold))
                .foregroundStyle(Color.hex("#0f766e"))
            PageTitle(title: title, subtitle: message)
            PrimaryOnboardingButton(title: buttonTitle, isEnabled: true) {
                store.finishOnboarding()
            }
        }
    }
}

struct WelcomeSignupScreen: View {
    @Binding var store: HomeSwipeStore
    let isEmailSignupComplete: Bool
    @State private var keyboardHeight: CGFloat = 0

    private var isEmailSelected: Bool {
        store.signUpMethod == "Email"
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                welcomeBackground

                VStack(spacing: 0) {
                    header
                    Spacer(minLength: 12)
                    authPanel
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .padding(.horizontal, 18)
                .padding(.top, keyboardHeight > 0 ? 18 : max(54, proxy.safeAreaInsets.top + 20))
                .padding(.bottom, bottomPanelPadding(safeAreaBottom: proxy.safeAreaInsets.bottom))
                .offset(y: keyboardHeight > 0 ? -keyboardOffset(for: proxy.size.height) : 0)
                .animation(.snappy(duration: 0.28), value: keyboardHeight)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .ignoresSafeArea(.container)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) { notification in
            keyboardHeight = keyboardHeight(from: notification)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardHeight = 0
        }
    }

    private func bottomPanelPadding(safeAreaBottom: CGFloat) -> CGFloat {
        keyboardHeight > 0 ? 12 : max(16, safeAreaBottom + 10)
    }

    private func keyboardOffset(for screenHeight: CGFloat) -> CGFloat {
        min(max(140, keyboardHeight - 44), screenHeight * 0.34)
    }

    private func keyboardHeight(from notification: Notification) -> CGFloat {
        guard let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return 0
        }

        return max(0, frame.height)
    }

    private var welcomeBackground: some View {
        ZStack {
            Image("WelcomeHome")
                .resizable()
                .scaledToFill()
                .scaleEffect(1.16)
                .offset(y: -18)
                .ignoresSafeArea()
                .clipped()

            LinearGradient(
                colors: [.black.opacity(0.16), .black.opacity(0.32), .black.opacity(0.78)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                Image(systemName: "house.fill")
                    .font(.system(size: 18, weight: .heavy))
                Text("HomeSwipe")
                    .font(.system(size: 17, weight: .heavy))
            }
            .foregroundStyle(.white)

            Spacer(minLength: 0)

            Text("Discover Your Dream Home")
                .font(.system(size: 44, weight: .regular))
                .foregroundStyle(.white)
                .lineLimit(3)
                .minimumScaleFactor(0.64)
                .frame(maxWidth: 340, alignment: .leading)
        }
        .frame(maxWidth: .infinity, minHeight: 210, alignment: .leading)
    }

    private var authPanel: some View {
        VStack(spacing: 12) {
            Capsule()
                .fill(Color.hex("#d1d5db"))
                .frame(width: 56, height: 4)
                .padding(.bottom, 2)

            HStack(spacing: 10) {
                socialButton(title: "Google", icon: "g.circle", method: "Google")
                socialButton(title: "Apple", icon: "apple.logo", method: "Apple")
                socialButton(title: "Email", icon: "envelope", method: "Email")
            }

            if isEmailSelected {
                VStack(alignment: .leading, spacing: 8) {
                    CompactAccountTextField(title: "Full name", text: $store.account.fullName)
                    CompactAccountTextField(title: "Email", text: $store.account.email, keyboard: .emailAddress)
                    CompactAccountSecureField(title: "Password", text: $store.account.password)
                    HStack {
                        Button {
                            store.requestPasswordReset()
                        } label: {
                            Text("Forgot password?")
                                .font(.system(size: 12, weight: .heavy))
                                .foregroundStyle(Color.hex("#0f766e"))
                        }
                        .buttonStyle(.plain)
                        Spacer()
                    }
                    if !store.account.forgotPasswordMessage.isEmpty {
                        Text(store.account.forgotPasswordMessage)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.hex("#64748b"))
                            .lineLimit(2)
                    }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            PrimaryOnboardingButton(
                title: isEmailSelected ? "Continue" : "Continue with \(store.signUpMethod == "Email" ? "Email" : store.signUpMethod)",
                isEnabled: !isEmailSelected || isEmailSignupComplete
            ) {
                store.continueFromSignup()
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func socialButton(title: String, icon: String, method: String) -> some View {
        Button {
            withAnimation(.snappy) {
                store.signUpMethod = method
            }
        } label: {
            VStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .heavy))
                Text(title)
                    .font(.system(size: 12, weight: .heavy))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(store.signUpMethod == method ? .white : Color.hex("#0f172a"))
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(store.signUpMethod == method ? Color.hex("#0f766e") : Color.hex("#f8fafc"))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(store.signUpMethod == method ? Color.hex("#0f766e") : Color.hex("#e2e8f0"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct CompactAccountTextField: View {
    let title: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default

    var body: some View {
        TextField(title, text: $text)
            .keyboardType(keyboard)
            .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
            .autocorrectionDisabled(keyboard == .emailAddress)
            .textFieldStyle(.plain)
            .font(.system(size: 14, weight: .bold))
            .padding(.horizontal, 12)
            .frame(height: 42)
            .background(Color.hex("#f8fafc"))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct CompactAccountSecureField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        SecureField(title, text: $text)
            .textFieldStyle(.plain)
            .font(.system(size: 14, weight: .bold))
            .padding(.horizontal, 12)
            .frame(height: 42)
            .background(Color.hex("#f8fafc"))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct SingleChoiceSection: View {
    let title: String
    let options: [String]
    @Binding var selection: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 18, weight: .heavy))
            ForEach(options, id: \.self) { option in
                ChoiceButton(title: option, isSelected: selection == option) {
                    selection = option
                }
            }
        }
        .cardStyle()
    }
}

struct AccountTextField: View {
    let title: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.hex("#334155"))
            TextField(title, text: $text)
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
                .autocorrectionDisabled(keyboard == .emailAddress)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .frame(height: 46)
                .background(Color.hex("#f8fafc"))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct AccountSecureField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.hex("#334155"))
            SecureField(title, text: $text)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .frame(height: 46)
                .background(Color.hex("#f8fafc"))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct MultiChoiceSection: View {
    let title: String
    let options: [String]
    @Binding var selections: Set<String>

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 18, weight: .heavy))
            VStack(spacing: 10) {
                ForEach(options, id: \.self) { option in
                    ChoiceButton(title: option, isSelected: selections.contains(option)) {
                        if selections.contains(option) {
                            selections.remove(option)
                        } else {
                            selections.insert(option)
                        }
                    }
                }
            }
        }
        .cardStyle()
    }
}

struct ChoiceButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? Color.hex("#0f766e") : Color.hex("#94a3b8"))
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.hex("#0f172a"))
                Spacer()
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .background(isSelected ? Color.hex("#ecfeff") : Color.hex("#f8fafc"))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.hex("#0f766e") : Color.hex("#e2e8f0"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct OnboardingActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct PrimaryOnboardingButton: View {
    let title: String
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(isEnabled ? Color.hex("#0f766e") : Color.hex("#94a3b8"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}

struct SecondaryOnboardingButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Color.hex("#0f766e"))
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct BenefitRow: View {
    let text: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Color.hex("#0f766e"))
            Text(text)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.hex("#334155"))
        }
    }
}

struct HomeScreen: View {
    @Binding var store: HomeSwipeStore

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 14) {
                HomeHeader(store: $store)
                SearchBar(store: $store)

                if store.showFilters {
                    FilterPanel(filters: $store.filters)
                }

                if store.showAddListing {
                    if store.onboardingRole == .tenant {
                        EmptyProfilePanel(icon: "person.crop.circle", title: "Add homes from Profile", message: "Tenant add-home tools live in Profile so the home feed stays focused on listings.")
                    } else {
                        AddListingPanel(store: $store)
                    }
                }

                SegmentedKindControl(activeKind: $store.activeKind)

                HStack {
                    Text("Available listings")
                        .font(.system(size: 22, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f172a"))
                    Spacer()
                    Text("\(store.filteredListings.count)")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.hex("#64748b"))
                }

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(store.filteredListings) { listing in
                        ListingCard(
                            listing: listing,
                            isSaved: store.savedListingIDs.contains(listing.id),
                            onToggleSaved: { store.toggleSaved(listing) },
                            onChat: { store.startChat(for: listing) },
                            onOpen: {
                                store.selectedListing = listing
                            }
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
    }
}

struct ToolsScreen: View {
    @Binding var store: HomeSwipeStore
    @State private var activeTool: ToolKind?
    @State private var toolStep = 0
    @State private var toolInputs = ToolInputs()
    private let insuranceItems = ["Buildings", "Contents", "Clothing and Personal effects", "Spectacles", "Cellphones", "Jewellery", "Wedding Rings"]
    private let insurancePeriods = ["4", "8", "12"]

    init(
        store: Binding<HomeSwipeStore>,
        initialActiveTool: ToolKind? = nil,
        initialToolStep: Int = 0,
        initialToolInputs: ToolInputs = ToolInputs()
    ) {
        self._store = store
        self._activeTool = State(initialValue: initialActiveTool)
        self._toolStep = State(initialValue: initialToolStep)
        self._toolInputs = State(initialValue: initialToolInputs)
    }

    var body: some View {
        Group {
            if let activeTool {
                activeToolFlow(activeTool)
            } else {
                toolHome
            }
        }
    }

    private var toolHome: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "Tools", subtitle: "Run financing, insurance, project, and lease calculators inside HomeSwipe.")

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 152), spacing: 10)], spacing: 10) {
                    ForEach(ToolKind.allCases) { tool in
                        Button {
                            openTool(tool)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: tool.icon)
                                    .font(.system(size: 20, weight: .heavy))
                                    .foregroundStyle(Color.hex("#0f766e"))
                                    .frame(width: 38, height: 38)
                                    .background(Color.hex("#ccfbf1"))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(tool.rawValue)
                                        .font(.system(size: 14, weight: .heavy))
                                        .foregroundStyle(Color.hex("#0f172a"))
                                        .lineLimit(2)
                                    Text(tool.subtitle)
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(Color.hex("#64748b"))
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .frame(minHeight: 76)
                            .background(.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.hex("#ccfbf1"), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
    }

    private func activeToolFlow(_ tool: ToolKind) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(tool.rawValue)
                            .font(.system(size: 28, weight: .heavy))
                            .foregroundStyle(Color.hex("#0f172a"))
                        Text(tool.subtitle)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.hex("#64748b"))
                    }
                    Spacer()
                    Image(systemName: tool.icon)
                        .font(.system(size: 28, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f766e"))
                }

                HStack(spacing: 8) {
                    ToolNavButton(title: "Home", icon: "house", action: closeTool)
                    ToolNavButton(title: "Back", icon: "chevron.left", action: goBack)
                    ToolNavButton(title: "Restart", icon: "arrow.clockwise", action: restartTool)
                    ToolNavButton(title: "Cancel", icon: "xmark", tint: Color.hex("#b91c1c"), action: closeTool)
                }

                if tool == .leases {
                    leaseToolFlow
                } else if let report = report(for: tool), toolStep >= questionCount(for: tool) {
                    ToolReportView(report: report, shareText: reportShareText(report), primaryActions: primaryActions(for: tool)) { actionTitle in
                        store.submitToolApplication(title: actionTitle, report: report)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text("Question \(toolStep + 1) of \(questionCount(for: tool))")
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundStyle(Color.hex("#0f766e"))
                            Spacer()
                        }

                        toolQuestion(for: tool, step: toolStep)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 320)

                        HStack(spacing: 10) {
                            ToolSecondaryButton(title: "Back", icon: "chevron.left", action: goBack)
                            ToolPrimaryButton(title: toolStep == questionCount(for: tool) - 1 ? "Calculate Estimate" : "Next", icon: toolStep == questionCount(for: tool) - 1 ? "function" : "chevron.right") {
                                toolStep += 1
                            }
                        }
                    }
                    .cardStyle()
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
    }

    private var leaseToolFlow: some View {
        VStack(alignment: .leading, spacing: 16) {
            let fields = leaseFields
            if toolStep < fields.count {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Question \(toolStep + 1) of \(fields.count)")
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f766e"))
                    fields[toolStep]
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 320)
                    HStack(spacing: 10) {
                        ToolSecondaryButton(title: "Back", icon: "chevron.left", action: goBack)
                        ToolPrimaryButton(title: "Next", icon: "chevron.right") { toolStep += 1 }
                    }
                }
                .cardStyle()
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Review lease details")
                        .font(.system(size: 22, weight: .heavy))
                    Text("Create the draft, then share it with the other user for review or signing.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.hex("#64748b"))
                    LeaseReviewBox(leaseDraft: store.leaseDraft)
                    HStack(spacing: 10) {
                        ToolSecondaryButton(title: "Back", icon: "chevron.left", action: goBack)
                        ToolPrimaryButton(title: "Create lease draft", icon: "plus.circle") {
                            store.createLease()
                        }
                    }
                }
                .cardStyle()

                leaseDraftsList
            }
        }
    }

    private var leaseDraftsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Lease drafts")
                    .font(.system(size: 22, weight: .heavy))
                Spacer()
                Text("\(store.leases.count)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.hex("#64748b"))
            }

            if store.leases.isEmpty {
                EmptyProfilePanel(icon: "doc.text", title: "No leases yet", message: "Create a lease draft above, then share it with the other user for review or signing.")
            }

            ForEach($store.leases) { $lease in
                VStack(alignment: .leading, spacing: 12) {
                    Text(lease.property)
                        .font(.system(size: 19, weight: .heavy))
                    Text("\(lease.landlord) · \(lease.tenant)")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.hex("#475569"))
                    Text("Rent \(lease.rent) · Deposit \(lease.deposit)")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.hex("#475569"))

                    HStack(spacing: 10) {
                        SignatureButton(title: "Landlord sign", isDone: $lease.landlordSigned)
                        SignatureButton(title: "Tenant sign", isDone: $lease.tenantSigned)
                    }

                    HStack(spacing: 10) {
                        ShareLink(item: leaseShareText(lease)) {
                            Label("Share lease", systemImage: "square.and.arrow.up")
                                .font(.system(size: 14, weight: .heavy))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 42)
                                .background(Color.hex("#0f766e"))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .simultaneousGesture(TapGesture().onEnded {
                            if lease.status == "Draft" {
                                lease.status = "Sent for signing"
                                store.syncUserData()
                            }
                        })

                        Button {
                            store.deleteLease(lease)
                        } label: {
                            Label("Delete", systemImage: "trash")
                                .font(.system(size: 14, weight: .heavy))
                                .foregroundStyle(Color.hex("#b91c1c"))
                                .frame(maxWidth: .infinity)
                                .frame(height: 42)
                                .background(Color.hex("#fef2f2"))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.hex("#fecaca"), lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .cardStyle()
            }
        }
    }

    private var leaseFields: [AnyView] {
        [
            AnyView(ToolValueInput(title: "Property", text: $store.leaseDraft.property)),
            AnyView(ToolValueInput(title: "Landlord", text: $store.leaseDraft.landlord)),
            AnyView(ToolValueInput(title: "Tenant", text: $store.leaseDraft.tenant)),
            AnyView(ToolValueInput(title: "Monthly rent", text: $store.leaseDraft.rent, prefix: "$", keyboard: .decimalPad)),
            AnyView(ToolValueInput(title: "Deposit", text: $store.leaseDraft.deposit, prefix: "$", keyboard: .decimalPad)),
            AnyView(ToolValueInput(title: "Start date", text: $store.leaseDraft.startDate, placeholder: "YYYY-MM-DD")),
            AnyView(ToolValueInput(title: "End date", text: $store.leaseDraft.endDate, placeholder: "YYYY-MM-DD")),
            AnyView(ToolValueInput(title: "Utilities", text: $store.leaseDraft.utilities)),
            AnyView(ToolValueInput(title: "Pet policy", text: $store.leaseDraft.petPolicy)),
            AnyView(ToolValueInput(title: "Parking", text: $store.leaseDraft.parking))
        ]
    }

    @ViewBuilder
    private func toolQuestion(for tool: ToolKind, step: Int) -> some View {
        switch tool {
        case .homeLoan:
            switch step {
            case 0: currencyPicker
            case 1: ToolValueInput(title: "Monthly Net Income", text: $toolInputs.income, prefix: toolInputs.currency, keyboard: .decimalPad)
            case 2: ToolValueInput(title: "Loan Period", text: $toolInputs.loanYears, helper: "1 to 10 years", suffix: "Years", keyboard: .numberPad)
            default: ToolValueInput(title: "Deposit Available", text: $toolInputs.deposit, prefix: toolInputs.currency, keyboard: .decimalPad)
            }
        case .rentLoan:
            switch step {
            case 0: currencyPicker
            case 1: ToolValueInput(title: "Monthly Rent", text: $toolInputs.monthlyRent, prefix: toolInputs.currency, keyboard: .decimalPad)
            case 2: ToolValueInput(title: "Months Needing Support", text: $toolInputs.supportMonths, suffix: "Months", keyboard: .numberPad)
            default: ToolValueInput(title: "Repayment Period", text: $toolInputs.repaymentMonths, suffix: "Months", keyboard: .numberPad)
            }
        case .householdInsurance:
            switch step {
            case 0: currencyPicker
            case 1: optionPicker(title: "Item to set sum insured", options: insuranceItems, selection: $toolInputs.insuranceItem)
            case 2: ToolValueInput(title: "\(toolInputs.insuranceItem) Insurance", text: $toolInputs.insuranceSumInsured, helper: "Enter amount. Example: 20000", prefix: toolInputs.currency, keyboard: .decimalPad)
            default: optionPicker(title: "Period of Cover", options: insurancePeriods.map { "\($0) Months" }, selection: Binding(
                get: { "\(toolInputs.insuranceMonths) Months" },
                set: { toolInputs.insuranceMonths = $0.replacingOccurrences(of: " Months", with: "") }
            ))
            }
        case .propertyUpgrades:
            switch step {
            case 0: currencyPicker
            case 1: optionPicker(title: "Upgrade Type", options: ["Solar Installation", "Boreholes", "Kitchens", "Roofing", "Tiling", "Security Systems", "Boundary Walls", "Painting", "Extensions"], selection: $toolInputs.upgradeType)
            case 2: ToolValueInput(title: "Property Location", text: $toolInputs.propertyLocation)
            case 3: ToolValueInput(title: "Estimated Budget", text: $toolInputs.upgradeBudget, prefix: toolInputs.currency, keyboard: .decimalPad)
            default: ToolDatePicker(title: "Schedule Site Inspection", date: $toolInputs.siteInspectionDate)
            }
        case .buildingFinancing:
            switch step {
            case 0: currencyPicker
            case 1: optionPicker(title: "Building Stage", options: ["Foundation", "Walls", "Roofing", "Finishing", "Full Build"], selection: $toolInputs.buildingStage)
            case 2: ToolValueInput(title: "Stand Location", text: $toolInputs.standLocation)
            case 3: ToolValueInput(title: "Loan Duration", text: $toolInputs.buildLoanYears, helper: "Enter duration in years", suffix: "Years", keyboard: .numberPad)
            case 4: ToolValueInput(title: "Estimated Budget", text: $toolInputs.buildBudget, prefix: toolInputs.currency, keyboard: .decimalPad)
            default: ToolDatePicker(title: "Schedule Site Inspection", date: $toolInputs.siteInspectionDate)
            }
        case .homeInsurance:
            switch step {
            case 0: currencyPicker
            case 1: optionPicker(title: "Item to set sum insured", options: insuranceItems, selection: $toolInputs.insuranceItem)
            case 2: ToolValueInput(title: "\(toolInputs.insuranceItem) Insurance", text: $toolInputs.insuranceSumInsured, helper: "Enter amount. Example: 20000", prefix: toolInputs.currency, keyboard: .decimalPad)
            default: optionPicker(title: "Period of Cover", options: insurancePeriods.map { "\($0) Months" }, selection: Binding(
                get: { "\(toolInputs.insuranceMonths) Months" },
                set: { toolInputs.insuranceMonths = $0.replacingOccurrences(of: " Months", with: "") }
            ))
            }
        case .leases:
            EmptyView()
        }
    }

    private var currencyPicker: some View {
        optionPicker(title: "Select Currency", options: ["USD", "ZWG"], selection: $toolInputs.currency)
    }

    private func optionPicker(title: String, options: [String], selection: Binding<String>) -> some View {
        VStack(spacing: 14) {
            Text(title)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 135), spacing: 10)], spacing: 10) {
                ForEach(options, id: \.self) { option in
                    Button {
                        selection.wrappedValue = option
                    } label: {
                        HStack {
                            Image(systemName: selection.wrappedValue == option ? "checkmark.circle.fill" : "circle")
                            Text(option)
                                .lineLimit(2)
                                .minimumScaleFactor(0.78)
                        }
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(selection.wrappedValue == option ? .white : Color.hex("#0f766e"))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 46)
                        .padding(.horizontal, 10)
                        .background(selection.wrappedValue == option ? Color.hex("#0f766e") : .white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func questionCount(for tool: ToolKind) -> Int {
        switch tool {
        case .householdInsurance, .homeInsurance: return 4
        case .rentLoan, .homeLoan: return 4
        case .propertyUpgrades: return 5
        case .buildingFinancing: return 6
        case .leases: return leaseFields.count
        }
    }

    private func openTool(_ tool: ToolKind) {
        activeTool = tool
        toolStep = 0
    }

    private func closeTool() {
        activeTool = nil
        toolStep = 0
    }

    private func restartTool() {
        toolInputs = ToolInputs()
        store.leaseDraft = LeaseDraftInput()
        toolStep = 0
    }

    private func goBack() {
        if toolStep > 0 {
            toolStep -= 1
        } else {
            closeTool()
        }
    }

    private func leaseShareText(_ lease: LeaseDraft) -> String {
        [
            "HomeSwipe lease: \(lease.property)",
            "Landlord: \(lease.landlord)",
            "Tenant: \(lease.tenant)",
            "Rent: \(lease.rent)",
            "Deposit: \(lease.deposit)",
            "Term: \(lease.startDate) to \(lease.endDate)",
            "Status: \(lease.status)"
        ].joined(separator: "\n")
    }

    private func primaryActions(for tool: ToolKind) -> [(String, String)] {
        switch tool {
        case .homeLoan: return [("Get Pre-Approved", "checkmark.circle"), ("Compare Mortgages", "arrow.left.arrow.right")]
        case .rentLoan: return [("Apply for Rent Loan", "banknote")]
        case .householdInsurance: return [("Request Quote", "text.bubble")]
        case .propertyUpgrades: return [("Request Site Visit", "calendar"), ("Apply For Upgrade Financing", "hammer")]
        case .buildingFinancing: return [("Request Site Visit", "calendar"), ("Apply For Building Finance", "building.2")]
        case .homeInsurance: return [("Request Home Insurance Quote", "text.bubble")]
        case .leases: return []
        }
    }

    private func reportShareText(_ report: ToolReport) -> String {
        var lines = ["HomeSwipe \(report.title)", "", "Inputs"]
        lines += report.inputs.map { "\($0.0): \($0.1)" }
        lines += ["", "Results"]
        lines += report.results.map { "\($0.0): \($0.1)" }
        if !report.notes.isEmpty {
            lines += ["", "Notes"]
            lines += report.notes
        }
        lines += ["", "Disclaimer: Estimates are indicative and subject to assessment, verification, valuation, fees and final approval."]
        return lines.joined(separator: "\n")
    }

    private func report(for tool: ToolKind) -> ToolReport? {
        let currency = toolInputs.currency
        let interestRate = 0.125
        switch tool {
        case .homeLoan:
            let income = amount(toolInputs.income)
            let years = min(10, max(1, amount(toolInputs.loanYears)))
            let deposit = amount(toolInputs.deposit)
            let monthlyRate = interestRate / 12
            let months = years * 12
            let monthlyRepayment = income * 0.3
            let loanAmount = monthlyRate > 0 ? monthlyRepayment * ((1 - pow(1 + monthlyRate, -months)) / monthlyRate) : monthlyRepayment * months
            let requiredDeposit = max(deposit, loanAmount * 0.1)
            let purchasePrice = loanAmount + requiredDeposit
            let transferCosts = purchasePrice * 0.035
            let registrationCosts = loanAmount * 0.025
            let valuationFees = max(150, purchasePrice * 0.002)
            let applicationFees = max(100, loanAmount * 0.0015)
            return ToolReport(
                title: tool.rawValue,
                inputs: [("Currency", currency), ("Monthly Net Income", money(currency, income)), ("Loan Period", "\(Int(years)) years"), ("Deposit Available", money(currency, deposit))],
                results: [("Estimated Purchase Price", money(currency, purchasePrice)), ("Required Deposit", money(currency, requiredDeposit)), ("Estimated Loan Amount", money(currency, loanAmount)), ("Monthly Repayment", money(currency, monthlyRepayment)), ("Interest Rate", "12.5%"), ("Estimated Upfront Costs", money(currency, transferCosts + registrationCosts + valuationFees + applicationFees)), ("Transfer Costs", money(currency, transferCosts)), ("Registration Costs", money(currency, registrationCosts)), ("Valuation Fees", money(currency, valuationFees)), ("Application Fees", money(currency, applicationFees))]
            )
        case .rentLoan:
            let rent = amount(toolInputs.monthlyRent)
            let supportMonths = max(1, amount(toolInputs.supportMonths))
            let repaymentMonths = max(1, amount(toolInputs.repaymentMonths))
            let principal = rent * supportMonths
            let serviceFee = principal * 0.03
            let total = principal + principal * interestRate * (repaymentMonths / 12) + serviceFee
            return ToolReport(
                title: tool.rawValue,
                inputs: [("Currency", currency), ("Monthly Rent", money(currency, rent)), ("Months Needing Support", "\(Int(supportMonths))"), ("Repayment Period", "\(Int(repaymentMonths)) months")],
                results: [("Total Rent Finance Required", money(currency, principal)), ("Monthly Repayment", money(currency, total / repaymentMonths)), ("Interest Rate", "12.5%"), ("Service Fee", money(currency, serviceFee)), ("Total Repayment", money(currency, total))],
                notes: ["Rent loan estimates exclude security deposits and are based only on rent financing requirements."]
            )
        case .householdInsurance:
            return insuranceReport(title: "Home, Household and Specified Items Insurance", actionTitle: tool.rawValue)
        case .propertyUpgrades:
            let budget = amount(toolInputs.upgradeBudget)
            let total = budget + budget * interestRate * 3
            return ToolReport(title: tool.rawValue, inputs: [("Currency", currency), ("Upgrade Type", toolInputs.upgradeType), ("Property Location", fallback(toolInputs.propertyLocation)), ("Estimated Budget", money(currency, budget)), ("Site Inspection", dateLabel(toolInputs.siteInspectionDate))], results: [("Estimated Project Cost", money(currency, budget)), ("Estimated Monthly Repayment", money(currency, total / 36)), ("Finance Amount", money(currency, budget)), ("Interest Rate", "12.5%"), ("Project Timeline", budget > 20000 ? "8-16 weeks" : "3-8 weeks")], notes: ["HomeSwipe controls the project, suppliers, contractors, payments, inspections and completion process.", "Funds are paid directly to approved suppliers and contractors, not to the customer."])
        case .buildingFinancing:
            let budget = amount(toolInputs.buildBudget)
            let years = max(1, amount(toolInputs.buildLoanYears))
            let total = budget + budget * interestRate * years
            return ToolReport(title: tool.rawValue, inputs: [("Currency", currency), ("Building Stage", toolInputs.buildingStage), ("Stand Location", fallback(toolInputs.standLocation)), ("Loan Duration", "\(Int(years)) years"), ("Estimated Budget", money(currency, budget)), ("Site Inspection", dateLabel(toolInputs.siteInspectionDate))], results: [("Estimated Building Cost", money(currency, budget)), ("Finance Amount", money(currency, budget)), ("Monthly Repayment", money(currency, total / (years * 12))), ("Interest Rate", "12.5%"), ("Project Timeline", toolInputs.buildingStage == "Full Build" ? "6-12 months" : "6-20 weeks")], notes: ["HomeSwipe oversees construction, suppliers, contractors, quality control, inspections and project completion.", "Payments are made directly to suppliers and contractors in approved project stages."])
        case .homeInsurance:
            return insuranceReport(title: "Home, Household and Specified Items Insurance", actionTitle: tool.rawValue)
        case .leases:
            return nil
        }
    }

    private func insuranceReport(title: String, actionTitle: String) -> ToolReport {
        let currency = toolInputs.currency
        let sumInsured = amount(toolInputs.insuranceSumInsured)
        let ratePercent = 0.12
        let months = max(4, amount(toolInputs.insuranceMonths) == 0 ? 12 : amount(toolInputs.insuranceMonths))
        let premium = sumInsured * (ratePercent / 100) * (months / 12)
        let stampDuty = premium * 0.05
        let totalDue = premium + stampDuty
        let rateLabel = ratePercent.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(ratePercent))%" : "\(String(format: "%.2f", ratePercent))%"

        return ToolReport(
            title: title,
            inputs: [
                ("Currency", currency),
                ("Item Insured", toolInputs.insuranceItem),
                ("Sum Insured", money(currency, sumInsured)),
                ("Insurance Rate", rateLabel),
                ("Period of Cover", "\(Int(months)) months")
            ],
            results: [
                ("Item", toolInputs.insuranceItem),
                ("Sum Insured", money(currency, sumInsured)),
                ("Premium", money(currency, premium)),
                ("Stamp Duty", money(currency, stampDuty)),
                ("Total Due", money(currency, totalDue))
            ],
            notes: ["Insurance premium uses the selected rate and period of cover. Stamp duty is calculated at 5% of the premium."]
        )
    }

    private func amount(_ text: String) -> Double {
        let cleaned = text.replacingOccurrences(of: ",", with: "")
        let number = cleaned.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
        return Double(number) ?? 0
    }

    private func money(_ currency: String, _ value: Double) -> String {
        "\(currency) \(Int(value.rounded()).formatted())"
    }

    private func fallback(_ value: String, _ fallback: String = "Not provided") -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallback : value
    }

    private func dateLabel(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .omitted)
    }
}

struct ToolValueInput: View {
    let title: String
    @Binding var text: String
    var helper = ""
    var prefix = ""
    var suffix = ""
    var placeholder = ""
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
                .multilineTextAlignment(.center)
            if !helper.isEmpty {
                Text(helper)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.hex("#64748b"))
            }
            HStack(spacing: 8) {
                if !prefix.isEmpty {
                    Text(prefix)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f766e"))
                }
                TextField(placeholder.isEmpty ? title : placeholder, text: $text)
                    .keyboardType(keyboard)
                    .textFieldStyle(.plain)
                    .multilineTextAlignment(.center)
                    .font(.system(size: 18, weight: .heavy))
                if !suffix.isEmpty {
                    Text(suffix)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f766e"))
                }
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: 360)
            .frame(height: 50)
            .background(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.hex("#99f6e4"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .frame(maxWidth: .infinity)
    }
}

struct ToolDatePicker: View {
    let title: String
    @Binding var date: Date

    var body: some View {
        VStack(spacing: 12) {
            Text(title)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
                .multilineTextAlignment(.center)
            DatePicker("Select a day", selection: $date, displayedComponents: [.date])
                .datePickerStyle(.graphical)
                .padding(10)
                .background(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .frame(maxWidth: .infinity)
    }
}

struct ToolReportView: View {
    let report: ToolReport
    let shareText: String
    let primaryActions: [(String, String)]
    let onPrimaryAction: (String) -> Void
    @Environment(\.openURL) private var openURL

    private var hero: (String, String) {
        report.results.first ?? ("Estimated Result", "Ready")
    }

    private var detailResults: [(String, String)] {
        Array(report.results.dropFirst())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(report.title) Results")
                        .font(.system(size: 22, weight: .heavy))
                    Text("Professional estimate generated today")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.hex("#64748b"))
                }
                Spacer()
                Label("PDF Ready", systemImage: "doc.text")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.hex("#0f766e"))
                    .padding(.horizontal, 10)
                    .frame(height: 34)
                    .background(Color.hex("#ecfeff"))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            VStack(alignment: .leading, spacing: 10) {
                Text(hero.0.uppercased())
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.hex("#99f6e4"))
                Text(hero.1)
                    .font(.system(size: 30, weight: .heavy))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.75)
                HStack(spacing: 10) {
                    ToolMeta(title: "User", value: "Guest")
                    ToolMeta(title: "Status", value: "Estimate")
                    ToolMeta(title: "Date", value: Date.now.formatted(date: .numeric, time: .omitted))
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.hex("#0f172a"))
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 10) {
                Text("Calculation Inputs")
                    .font(.system(size: 16, weight: .heavy))
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 8)], spacing: 8) {
                    ForEach(report.inputs, id: \.0) { input in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(input.0.uppercased())
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundStyle(Color.hex("#64748b"))
                            Text(input.1)
                                .font(.system(size: 14, weight: .heavy))
                                .foregroundStyle(Color.hex("#0f172a"))
                                .lineLimit(2)
                                .minimumScaleFactor(0.78)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 10)
                        .overlay(alignment: .bottom) {
                            Rectangle().fill(Color.hex("#e2e8f0")).frame(height: 1)
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Result Breakdown")
                    .font(.system(size: 16, weight: .heavy))
                ForEach(detailResults, id: \.0) { result in
                    HStack(spacing: 12) {
                        Text(result.0)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.hex("#334155"))
                        Spacer()
                        Text(result.1)
                            .font(.system(size: 15, weight: .heavy))
                            .foregroundStyle(Color.hex("#0f172a"))
                            .multilineTextAlignment(.trailing)
                    }
                    .padding(.vertical, 10)
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(Color.hex("#e2e8f0")).frame(height: 1)
                    }
                }
            }

            ForEach(report.notes, id: \.self) { note in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "info.circle")
                    Text(note)
                }
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.hex("#075985"))
                .padding(12)
                .background(Color.hex("#eff6ff"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            VStack(spacing: 10) {
                ForEach(primaryActions, id: \.0) { action in
                    ToolPrimaryButton(title: action.0, icon: action.1) {
                        onPrimaryAction(action.0)
                        emailReviewTeam(actionTitle: action.0)
                    }
                }
                ShareLink(item: shareText) {
                    Label("Share PDF", systemImage: "square.and.arrow.up")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f766e"))
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                ToolSecondaryButton(title: "Save Results", icon: "bookmark") {}
                ToolSecondaryButton(title: "Download PDF", icon: "arrow.down.doc") {}
                ToolSecondaryButton(title: "Email PDF", icon: "envelope") {}
            }
        }
        .cardStyle()
    }

    private func emailReviewTeam(actionTitle: String) {
        let subject = "HomeSwipe \(actionTitle)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "HomeSwipe%20Application"
        let body = shareText.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        guard let url = URL(string: "mailto:homeswipelistings@gmail.com?subject=\(subject)&body=\(body)") else {
            return
        }
        openURL(url)
    }
}

struct ToolMeta: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(Color.hex("#94a3b8"))
            Text(value)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct LeaseReviewBox: View {
    let leaseDraft: LeaseDraftInput

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(leaseDraft.property.isEmpty ? "Property not added" : leaseDraft.property)
                .font(.system(size: 18, weight: .heavy))
            Text("Landlord: \(leaseDraft.landlord.isEmpty ? "Not added" : leaseDraft.landlord)")
            Text("Tenant: \(leaseDraft.tenant.isEmpty ? "Not added" : leaseDraft.tenant)")
            Text("Rent: \(leaseDraft.rent.isEmpty ? "Not added" : leaseDraft.rent)")
            Text("Deposit: \(leaseDraft.deposit.isEmpty ? "No deposit recorded" : leaseDraft.deposit)")
        }
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(Color.hex("#334155"))
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.hex("#f8fafc"))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ToolPrimaryButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Color.hex("#0f766e"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct ToolSecondaryButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(Color.hex("#0f766e"))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct ToolNavButton: View {
    let title: String
    let icon: String
    var tint = Color.hex("#0f766e")
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(tint)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(tint.opacity(0.28), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct LeaseTextField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.hex("#334155"))
            TextField(title, text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(Color.hex("#f8fafc"))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct MessagesScreen: View {
    @Binding var store: HomeSwipeStore

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "Messages", subtitle: "Direct communication between landlords and tenants.")

                if store.conversations.isEmpty {
                    EmptyProfilePanel(
                        icon: "message",
                        title: "No chats yet",
                        message: "Use Chat now on any home listing to start a real conversation."
                    )
                    Button {
                        store.activeTab = .home
                    } label: {
                        Label("Find homes", systemImage: "house")
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Color.hex("#0f766e"))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                } else {
                    VStack(spacing: 10) {
                        ForEach(store.conversations) { conversation in
                        Button {
                            store.activeConversationID = conversation.id
                            store.showsConversationProfile = false
                        } label: {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Color.hex("#134e4a"))
                                    .frame(width: 48, height: 48)
                                    .overlay(
                                        Text(String(conversation.person.prefix(1)))
                                            .font(.system(size: 18, weight: .heavy))
                                            .foregroundStyle(.white)
                                    )

                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(conversation.person)
                                            .font(.system(size: 16, weight: .heavy))
                                            .foregroundStyle(Color.hex("#0f172a"))
                                        Spacer()
                                        Text(conversation.time)
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundStyle(Color.hex("#94a3b8"))
                                    }
                                    Text(conversation.messages.last ?? "")
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color.hex("#64748b"))
                                        .lineLimit(2)
                                }
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(store.activeConversationID == conversation.id ? Color.hex("#f0fdfa") : .white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(store.activeConversationID == conversation.id ? Color.hex("#0f766e") : Color.hex("#e2e8f0"), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        }
                    }

                    if let activeConversation = store.activeConversation {
                    VStack(alignment: .leading, spacing: 12) {
                        Button {
                            withAnimation(.snappy) {
                                store.showsConversationProfile.toggle()
                            }
                        } label: {
                        HStack {
                            InitialAvatar(name: activeConversation.person)
                                .frame(width: 46, height: 46)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(activeConversation.person)
                                    .font(.system(size: 22, weight: .heavy))
                                    .foregroundStyle(Color.hex("#0f172a"))
                                Text("\(activeConversation.role) · \(activeConversation.listingTitle)")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.hex("#64748b"))
                            }
                            Spacer()
                            Image(systemName: store.showsConversationProfile ? "chevron.up" : "person.crop.circle")
                                .font(.title2)
                                .foregroundStyle(Color.hex("#0f766e"))
                        }
                        }
                        .buttonStyle(.plain)

                        if store.showsConversationProfile {
                            PublicProfileCard(profile: profileSnapshot(for: activeConversation))
                        }

                        ForEach(activeConversation.messages.indices, id: \.self) { index in
                            Text(activeConversation.messages[index])
                                .font(.system(size: 15))
                                .foregroundStyle(Color.hex("#0f172a"))
                                .padding(12)
                                .background(Color.hex("#f1f5f9"))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        HStack(spacing: 8) {
                            TextField("Write a reply", text: $store.replyDraft)
                                .textFieldStyle(.plain)
                                .padding(.horizontal, 12)
                                .frame(height: 44)
                                .background(Color.hex("#f8fafc"))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                            Button {
                                store.sendReply()
                            } label: {
                                Image(systemName: "paperplane.fill")
                                    .foregroundStyle(.white)
                                    .frame(width: 44, height: 44)
                                    .background(Color.hex("#0f766e"))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                    .background(.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.hex("#dbeafe"), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        EmptyProfilePanel(
                            icon: "message",
                            title: "Open a chat",
                            message: "Tap any conversation above to view the full message thread."
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
    }

    private func profileSnapshot(for conversation: Conversation) -> PublicProfileSnapshot {
        conversation.profile ?? PublicProfileSnapshot(
            name: conversation.person,
            role: conversation.role,
            verification: "Listed on HomeSwipe",
            location: conversation.listingTitle,
            primaryLocation: conversation.listingTitle,
            listerType: conversation.role
        )
    }
}

struct PublicProfileCard: View {
    let profile: PublicProfileSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                InitialAvatar(name: profile.name)
                    .frame(width: 54, height: 54)
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile.name.isEmpty ? "HomeSwipe user" : profile.name)
                        .font(.system(size: 18, weight: .heavy))
                    Text(profile.role.isEmpty ? "User" : profile.role)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.hex("#64748b"))
                }
                Spacer()
                Text(profile.verification.isEmpty ? "Not Verified" : profile.verification)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(profile.verification == VerificationState.verified.rawValue ? Color.hex("#2563eb") : Color.hex("#0f766e"))
                    .padding(.horizontal, 10)
                    .frame(height: 30)
                    .background(Color.hex("#ecfeff"))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                if !profile.location.isEmpty {
                    ProfileFact(title: "Location", value: profile.location)
                }
                if !profile.budget.isEmpty {
                    ProfileFact(title: "Budget", value: profile.budget)
                }
                if !profile.employmentStatus.isEmpty {
                    ProfileFact(title: "Employment", value: profile.employmentStatus)
                }
                if !profile.primaryLocation.isEmpty {
                    ProfileFact(title: "Primary Location", value: profile.primaryLocation)
                }
                if !profile.propertyCount.isEmpty {
                    ProfileFact(title: "Properties", value: profile.propertyCount)
                }
                if !profile.listerType.isEmpty {
                    ProfileFact(title: "Lister Type", value: profile.listerType)
                }
            }

            if !profile.propertyTypes.isEmpty {
                FlowRow(items: profile.propertyTypes)
            }
            if !profile.amenities.isEmpty {
                FlowRow(items: profile.amenities)
            }
            if !profile.householdTypes.isEmpty || !profile.leasePreferences.isEmpty {
                FlowRow(items: profile.householdTypes + profile.leasePreferences)
            }
        }
        .padding(14)
        .background(Color.hex("#f8fafc"))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.hex("#ccfbf1"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ProfileScreen: View {
    @Binding var store: HomeSwipeStore
    @State private var documentPendingUpload: VerificationDocument?
    @State private var isDocumentImporterPresented = false
    @State private var showsProfileInformation = false
    @State private var editingListingID: String?
    @State private var listingEditDraft = ListingEditDraft()
    @State private var pendingDeleteListingID: String?

    private func beginEditing(_ listing: Listing) {
        editingListingID = listing.id
        pendingDeleteListingID = nil
        listingEditDraft = ListingEditDraft(
            title: listing.title,
            location: listing.location,
            price: listing.price.replacingOccurrences(of: "[^0-9.]", with: "", options: .regularExpression),
            meta: listing.meta,
            description: listing.description
        )
    }

    private func saveEditedListing(_ listing: Listing) {
        let cleanedPrice = listingEditDraft.price.replacingOccurrences(of: "[^0-9.]", with: "", options: .regularExpression)
        var updatedListing = listing
        updatedListing.title = listingEditDraft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? listing.title : listingEditDraft.title
        updatedListing.location = listingEditDraft.location.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? listing.location : listingEditDraft.location
        updatedListing.price = cleanedPrice.isEmpty ? listing.price : "$\(cleanedPrice)"
        updatedListing.meta = listingEditDraft.meta.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? listing.meta : listingEditDraft.meta
        updatedListing.description = listingEditDraft.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? listing.description : listingEditDraft.description
        store.updateListing(updatedListing)
        editingListingID = nil
    }

    private func requestDelete(_ listing: Listing) {
        if pendingDeleteListingID == listing.id {
            store.deleteListing(listing)
            pendingDeleteListingID = nil
            editingListingID = nil
        } else {
            pendingDeleteListingID = listing.id
            editingListingID = nil
        }
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                if store.activeProfileView != .overview {
                    Button {
                        store.activeProfileView = .overview
                    } label: {
                        Label("Profile", systemImage: "chevron.left")
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundStyle(Color.hex("#0f766e"))
                    }
                    .buttonStyle(.plain)
                }

                HStack(spacing: 14) {
                    InitialAvatar(name: store.profileName)
                        .frame(width: 74, height: 74)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(store.profileName)
                                .font(.system(size: 24, weight: .heavy))
                            if store.verificationState == .verified {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundStyle(Color.hex("#2563eb"))
                            }
                        }
                        Text(store.activeProfileView.title)
                            .font(.system(size: 15))
                            .foregroundStyle(Color.hex("#64748b"))
                    }

                    Spacer()

                    Button {
                        store.activeProfileView = .personal
                    } label: {
                        Image(systemName: "pencil")
                            .foregroundStyle(Color.hex("#0f172a"))
                            .frame(width: 40, height: 40)
                            .background(.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }

                if store.activeProfileView == .overview {
                    HStack(spacing: 10) {
                        Button {
                            store.activeProfileView = .saved
                        } label: {
                            StatBlock(value: "\(store.savedListings.count)", label: "Saved")
                        }
                        .buttonStyle(.plain)

                        Button {
                            store.activeProfileView = .applications
                        } label: {
                            StatBlock(value: "\(store.applications.count)", label: "Applications")
                        }
                        .buttonStyle(.plain)

                        Button {
                            store.activeProfileView = .myHomes
                        } label: {
                            StatBlock(value: "\(store.myListings.count)", label: "My homes")
                        }
                        .buttonStyle(.plain)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Button {
                            withAnimation(.snappy) {
                                showsProfileInformation.toggle()
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "person.text.rectangle")
                                    .foregroundStyle(Color.hex("#0f766e"))
                                    .frame(width: 36, height: 36)
                                    .background(Color.hex("#f0fdfa"))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))

                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Profile Information")
                                        .font(.system(size: 18, weight: .heavy))
                                        .foregroundStyle(Color.hex("#0f172a"))
                                    Text("Tap to view onboarding and verification details")
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color.hex("#64748b"))
                                }

                                Spacer()

                                Image(systemName: showsProfileInformation ? "chevron.up" : "chevron.down")
                                    .foregroundStyle(Color.hex("#64748b"))
                            }
                        }
                        .buttonStyle(.plain)

                        if showsProfileInformation {
                            ProfileFact(title: "Signup", value: store.signUpMethod)
                            ProfileFact(title: "Email", value: store.account.email.isEmpty ? "Not provided" : store.account.email)
                            ProfileFact(title: "Role", value: store.verificationRoleLabel)
                            ProfileFact(title: "Verification", value: store.verificationState.rawValue)
                            if store.onboardingRole == .tenant {
                                ProfileFact(title: "City", value: store.tenantOnboarding.city.isEmpty ? "Not provided" : store.tenantOnboarding.city)
                                ProfileFact(title: "Budget", value: store.tenantOnboarding.budget.isEmpty ? "Not provided" : store.tenantOnboarding.budget)
                                ProfileFact(title: "Property Types", value: store.tenantOnboarding.propertyTypes.isEmpty ? "Not provided" : store.tenantOnboarding.propertyTypes.sorted().joined(separator: ", "))
                                ProfileFact(title: "Amenities", value: store.tenantOnboarding.amenities.isEmpty ? "Not provided" : store.tenantOnboarding.amenities.sorted().joined(separator: ", "))
                                ProfileFact(title: "Employment", value: store.tenantOnboarding.employmentStatus.isEmpty ? "Not provided" : store.tenantOnboarding.employmentStatus)
                                ProfileFact(title: "Household", value: store.tenantOnboarding.householdTypes.isEmpty ? "Not provided" : store.tenantOnboarding.householdTypes.sorted().joined(separator: ", "))
                                ProfileFact(title: "Lease Preference", value: store.tenantOnboarding.leasePreferences.isEmpty ? "Not provided" : store.tenantOnboarding.leasePreferences.sorted().joined(separator: ", "))
                            } else {
                                ProfileFact(title: "Primary Location", value: store.listerOnboarding.primaryLocation.isEmpty ? "Not provided" : store.listerOnboarding.primaryLocation)
                                ProfileFact(title: "Properties", value: store.listerOnboarding.propertyCount.isEmpty ? "Not provided" : store.listerOnboarding.propertyCount)
                                ProfileFact(title: "Lister Type", value: store.listerOnboarding.listerType.isEmpty ? "Not provided" : store.listerOnboarding.listerType)
                            }
                        }
                    }
                    .cardStyle()

                    VStack(spacing: 0) {
                        ProfileMenuRow(title: "Personal information") { store.activeProfileView = .personal }
                        ProfileMenuRow(title: "My homes") { store.activeProfileView = .myHomes }
                        ProfileMenuRow(title: "Verification Center") { store.activeProfileView = .documents }
                        ProfileMenuRow(title: "Support", hidesDivider: true) { store.activeProfileView = .support }
                    }
                    .background(.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                if store.activeProfileView == .myHomes {
                    VStack(alignment: .leading, spacing: 16) {
                        AddListingPanel(store: $store)

                        if store.myListings.isEmpty {
                            EmptyProfilePanel(
                                icon: "house",
                                title: "No homes yet",
                                message: "Add rentals, homes for sale, or stands here. You can edit or delete them from this profile area."
                            )
                        } else {
                            ForEach(store.myListings) { listing in
                                VStack(alignment: .leading, spacing: 12) {
                                    HStack {
                                        Text(listing.tag)
                                            .font(.system(size: 12, weight: .heavy))
                                            .foregroundStyle(Color.hex("#0f766e"))
                                            .padding(.horizontal, 10)
                                            .frame(height: 28)
                                            .background(Color.hex("#f0fdfa"))
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                        Spacer()
                                        Text(listing.kind.rawValue)
                                            .font(.system(size: 12, weight: .heavy))
                                            .foregroundStyle(Color.hex("#64748b"))
                                    }

                                    if editingListingID == listing.id {
                                        FilterInput(title: "Title", text: $listingEditDraft.title)
                                        FilterInput(title: "Location", text: $listingEditDraft.location)
                                        FilterInput(title: "Price", text: $listingEditDraft.price)
                                        FilterInput(title: "Summary", text: $listingEditDraft.meta)
                                        FilterInput(title: "Description", text: $listingEditDraft.description)

                                        HStack(spacing: 10) {
                                            Button {
                                                saveEditedListing(listing)
                                            } label: {
                                                Label("Save", systemImage: "square.and.arrow.down")
                                                    .font(.system(size: 13, weight: .heavy))
                                                    .foregroundStyle(.white)
                                                    .frame(maxWidth: .infinity)
                                                    .frame(height: 42)
                                                    .background(Color.hex("#0f766e"))
                                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                            }
                                            .buttonStyle(.plain)

                                            Button {
                                                editingListingID = nil
                                            } label: {
                                                Text("Cancel")
                                                    .font(.system(size: 13, weight: .heavy))
                                                    .foregroundStyle(Color.hex("#0f766e"))
                                                    .frame(maxWidth: .infinity)
                                                    .frame(height: 42)
                                                    .background(Color.hex("#f0fdfa"))
                                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    } else {
                                        Text(listing.title)
                                            .font(.system(size: 19, weight: .heavy))
                                        Text(listing.location)
                                            .font(.system(size: 14))
                                            .foregroundStyle(Color.hex("#475569"))
                                        Text(listing.price)
                                            .font(.system(size: 18, weight: .heavy))
                                            .foregroundStyle(Color.hex("#0f766e"))
                                        Text(listing.description)
                                            .font(.system(size: 14))
                                            .foregroundStyle(Color.hex("#64748b"))

                                        HStack(spacing: 10) {
                                            Button {
                                                store.selectedListing = listing
                                            } label: {
                                                Label("View", systemImage: "eye")
                                                    .font(.system(size: 13, weight: .heavy))
                                                    .foregroundStyle(Color.hex("#0f766e"))
                                                    .frame(maxWidth: .infinity)
                                                    .frame(height: 42)
                                                    .background(Color.hex("#f0fdfa"))
                                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                            }
                                            .buttonStyle(.plain)

                                            Button {
                                                beginEditing(listing)
                                            } label: {
                                                Label("Edit", systemImage: "pencil")
                                                    .font(.system(size: 13, weight: .heavy))
                                                    .foregroundStyle(.white)
                                                    .frame(maxWidth: .infinity)
                                                    .frame(height: 42)
                                                    .background(Color.hex("#0f766e"))
                                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                            }
                                            .buttonStyle(.plain)

                                            Button {
                                                requestDelete(listing)
                                            } label: {
                                                Image(systemName: pendingDeleteListingID == listing.id ? "exclamationmark.triangle" : "trash")
                                                    .foregroundStyle(Color.hex("#b91c1c"))
                                                    .frame(width: 46, height: 42)
                                                    .background(Color.hex("#fef2f2"))
                                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                            }
                                            .buttonStyle(.plain)
                                        }

                                        if pendingDeleteListingID == listing.id {
                                            Text("Tap delete again to confirm.")
                                                .font(.system(size: 12, weight: .heavy))
                                                .foregroundStyle(Color.hex("#b91c1c"))
                                        }
                                    }
                                }
                                .cardStyle()
                            }
                        }
                    }
                }

                if store.activeProfileView == .personal {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Your Details")
                                    .font(.system(size: 18, weight: .heavy))
                                Text("Only your signed-in Firebase user document stores these profile details.")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.hex("#64748b"))
                            }
                            Spacer()
                            Image(systemName: "lock")
                                .foregroundStyle(Color.hex("#0f766e"))
                        }

                        ProfileTextField(label: "Full name", text: $store.account.fullName)
                        ProfileTextField(label: "Email", text: $store.account.email, keyboard: .emailAddress)
                        ProfileTextField(label: "Phone", text: $store.account.phone, keyboard: .phonePad)
                        ProfileTextField(label: "Employer", text: $store.account.employer)
                        ProfileTextField(label: "Monthly budget", text: $store.account.monthlyBudget, keyboard: .decimalPad)

                        Button {
                            store.saveProfileDetails()
                        } label: {
                            Label("Save profile", systemImage: "square.and.arrow.down")
                                .font(.system(size: 14, weight: .heavy))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(Color.hex("#0f766e"))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                    .cardStyle()
                }

                if store.activeProfileView == .saved {
                    VStack(spacing: 16) {
                        ForEach(store.savedListings) { listing in
                        ListingCard(
                            listing: listing,
                            isSaved: true,
                            onToggleSaved: { store.toggleSaved(listing) },
                            onChat: { store.startChat(for: listing) },
                            onOpen: {
                                store.selectedListing = listing
                            }
                        )
                        }
                    }
                }

                if store.activeProfileView == .applications {
                    VStack(spacing: 12) {
                        if store.applications.isEmpty {
                            EmptyProfilePanel(
                                icon: "doc.text",
                                title: "No applications yet",
                                message: "When you request a viewing or submit an application, it will appear here."
                            )
                        } else {
                            ForEach(store.applications) { application in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Text(application.property)
                                            .font(.system(size: 19, weight: .heavy))
                                        Spacer()
                                        Text(application.status)
                                            .font(.system(size: 12, weight: .heavy))
                                            .foregroundStyle(application.status == "Approved" ? Color.hex("#2563eb") : Color.hex("#0f766e"))
                                            .padding(.horizontal, 10)
                                            .frame(height: 30)
                                            .background(Color.hex("#ecfeff"))
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                    Text("\(application.landlord) · \(application.submitted)")
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color.hex("#475569"))
                                    Text(application.nextStep)
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color.hex("#64748b"))
                                    Link(destination: URL(string: "mailto:homeswipelistings@gmail.com?subject=HomeSwipe%20Application%20\(application.id)")!) {
                                        Label("Email HomeSwipe review team", systemImage: "envelope")
                                            .font(.system(size: 13, weight: .heavy))
                                            .foregroundStyle(Color.hex("#0f766e"))
                                    }
                                }
                                .cardStyle()
                            }
                        }
                    }
                }

                if store.activeProfileView == .documents {
                    VStack(alignment: .leading, spacing: 12) {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("\(store.verificationRoleLabel) Verification")
                                    .font(.system(size: 18, weight: .heavy))
                                Spacer()
                                Text(store.verificationState.rawValue)
                                    .font(.system(size: 13, weight: .heavy))
                                    .foregroundStyle(store.verificationState == .verified ? Color.hex("#2563eb") : Color.hex("#0f766e"))
                                    .padding(.horizontal, 10)
                                    .frame(height: 30)
                                    .background(Color.hex("#ecfeff"))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            Text("Verification is optional. Upload the documents for your selected role whenever you want a verified profile badge.")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.hex("#64748b"))
                            Text("\(store.uploadedDocumentCount) of \(store.documents.count) uploaded")
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundStyle(store.hasUploadedAllRequiredDocuments ? Color.hex("#2563eb") : Color.hex("#0f766e"))
                        }
                        .cardStyle()

                        ForEach(store.documents) { document in
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Color.hex("#ccfbf1"))
                                    .frame(width: 44, height: 44)
                                    .overlay(Image(systemName: "doc.text").foregroundStyle(Color.hex("#0f766e")))

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(document.title)
                                        .font(.system(size: 16, weight: .heavy))
                                    Text(document.standard)
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color.hex("#64748b"))
                                    if !document.fileName.isEmpty {
                                        Text("Uploaded: \(document.fileName)")
                                            .font(.system(size: 12, weight: .heavy))
                                            .foregroundStyle(Color.hex("#2563eb"))
                                    }
                                    Text(document.status)
                                        .font(.system(size: 13, weight: .heavy))
                                        .foregroundStyle(document.status == "Verified" ? Color.hex("#2563eb") : Color.hex("#0f766e"))
                                }

                                Spacer()

                                if document.status == "Verified" {
                                    Image(systemName: "checkmark.seal.fill")
                                        .foregroundStyle(Color.hex("#2563eb"))
                                } else {
                                    Button {
                                        documentPendingUpload = document
                                        isDocumentImporterPresented = true
                                    } label: {
                                        Text("Upload")
                                            .font(.system(size: 12, weight: .heavy))
                                            .foregroundStyle(Color.hex("#0f766e"))
                                            .padding(.horizontal, 10)
                                            .frame(height: 32)
                                            .background(Color.hex("#f0fdfa"))
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(14)
                            .background(.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }

                if store.activeProfileView == .support {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("HomeSwipe Support")
                                        .font(.system(size: 20, weight: .heavy))
                                    Text("Get help with listings, verification, applications, payments, or account access.")
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color.hex("#64748b"))
                                }
                                Spacer()
                                Image(systemName: "lifepreserver")
                                    .font(.title2)
                                    .foregroundStyle(Color.hex("#0f766e"))
                            }
                        }
                        .cardStyle()

                        Link(destination: URL(string: "mailto:homeswipelistings@gmail.com?subject=HomeSwipe%20Support&body=Hi%20HomeSwipe%20Support%2C%0A%0AI%20need%20help%20with%3A%20")!) {
                            SupportActionRow(icon: "envelope", title: "Email support", subtitle: "homeswipelistings@gmail.com")
                        }
                        .buttonStyle(.plain)

                        Link(destination: URL(string: "mailto:homeswipelistings@gmail.com?subject=HomeSwipe%20Listing%20Help&body=Hi%20HomeSwipe%20Support%2C%0A%0AI%20need%20help%20with%20my%20listing.%0A%0AIssue%3A%20")!) {
                            SupportActionRow(icon: "house", title: "Listing help", subtitle: "Get support adding, editing, deleting, or managing homes.")
                        }
                        .buttonStyle(.plain)

                        Link(destination: URL(string: "mailto:homeswipelistings@gmail.com?subject=HomeSwipe%20Verification%20Help&body=Hi%20HomeSwipe%2C%0A%0AI%20need%20help%20with%20verification%20documents.")!) {
                            SupportActionRow(icon: "checkmark.seal", title: "Verification help", subtitle: "Ask about optional verification and uploaded documents.")
                        }
                        .buttonStyle(.plain)
                    }
                }

            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .fileImporter(
            isPresented: $isDocumentImporterPresented,
            allowedContentTypes: [.pdf, .image],
            allowsMultipleSelection: false
        ) { result in
            guard let document = documentPendingUpload else { return }
            if case .success(let urls) = result, let url = urls.first {
                store.markDocumentReady(document, fileName: url.lastPathComponent)
            }
            documentPendingUpload = nil
        }
    }
}

struct HomeHeader: View {
    @Binding var store: HomeSwipeStore

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text("HomeSwipe")
                    .font(.system(size: 32, weight: .heavy))
                    .foregroundStyle(Color.hex("#0f172a"))
                Text("Find rentals, homes, and stands without the runaround.")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.hex("#64748b"))
            }

            Spacer(minLength: 12)

            if store.onboardingRole != .tenant {
                Button {
                    store.showAddListing.toggle()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: store.showAddListing ? "xmark" : "plus")
                        Text(store.showAddListing ? "Close" : "Add home")
                            .font(.system(size: 15, weight: .heavy))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .frame(height: 48)
                    .background(Color.hex("#0f766e"))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct SearchBar: View {
    @Binding var store: HomeSwipeStore

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Color.hex("#64748b"))
                TextField("Search suburb, amenity, or listing type", text: $store.searchText)
                    .textFieldStyle(.plain)

                if !store.searchText.isEmpty {
                    Button {
                        store.searchText = ""
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(Color.hex("#64748b"))
                            .frame(width: 32, height: 32)
                            .background(Color.hex("#f1f5f9"))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 50)
            .background(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))

            Button {
                store.showFilters.toggle()
            } label: {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "slider.horizontal.3")
                        .foregroundStyle(.white)
                        .frame(width: 38, height: 38)
                        .background(Color.hex("#0f766e"))
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    if store.activeHomeFilterCount > 0 {
                        Text("\(store.activeHomeFilterCount)")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(minWidth: 20, minHeight: 20)
                            .background(Color.hex("#e11d48"))
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                            .clipShape(Circle())
                            .offset(x: 7, y: -7)
                    }
                }
            }
            .buttonStyle(.plain)
        }
        }
    }
}

struct FilterPanel: View {
    @Binding var filters: HomeFilters

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Filters")
                .font(.system(size: 18, weight: .heavy))

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                FilterInput(title: "Min price", text: $filters.minPrice)
                FilterInput(title: "Max price", text: $filters.maxPrice)
                FilterInput(title: "Bedrooms", text: $filters.bedrooms)
                FilterInput(title: "Bathrooms", text: $filters.bathrooms)
                FilterInput(title: "Amenity", text: $filters.amenity)
            }

            Toggle("Saved homes only", isOn: $filters.savedOnly)
                .toggleStyle(.switch)
        }
        .padding(16)
        .background(.white)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.hex("#dbeafe"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct AddListingPanel: View {
    @Binding var store: HomeSwipeStore

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Add your place")
                        .font(.system(size: 22, weight: .heavy))
                    Text("A simplified native version of the repo’s add-listing flow.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.hex("#64748b"))
                }
                Spacer()
                Image(systemName: "house")
                    .font(.title2)
                    .foregroundStyle(Color.hex("#0f766e"))
            }

            SegmentedKindControl(activeKind: $store.activeKind)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                FilterInput(title: "Property type", text: $store.listingDraft.propertyType)
                FilterInput(title: "Space type", text: $store.listingDraft.spaceType)
                FilterInput(title: "Street address", text: $store.listingDraft.location)
                FilterInput(title: "Suburb or area", text: $store.listingDraft.area)
                FilterInput(title: "City", text: $store.listingDraft.city)
                FilterInput(title: "Price", text: $store.listingDraft.price)
            }

            Button {
                store.addListing()
            } label: {
                Text("Publish listing")
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.hex("#0f766e"))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(.white)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.hex("#dbeafe"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct SegmentedKindControl: View {
    @Binding var activeKind: ListingKind

    var body: some View {
        HStack(spacing: 8) {
            ForEach(ListingKind.allCases) { kind in
                Button {
                    activeKind = kind
                } label: {
                    Text(kind.rawValue)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(activeKind == kind ? .white : Color.hex("#334155"))
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(activeKind == kind ? Color.hex("#0f766e") : Color.hex("#e2e8f0"))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct ListingCard: View {
    let listing: Listing
    let isSaved: Bool
    let onToggleSaved: () -> Void
    let onChat: () -> Void
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteListingImage(url: listing.imageURL)
                    .frame(height: 118)

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(listing.tag.uppercased())
                            .font(.system(size: 10, weight: .heavy))
                            .foregroundStyle(Color.hex("#0f766e"))
                            .lineLimit(1)
                        Spacer()
                        Button(action: onToggleSaved) {
                            Image(systemName: isSaved ? "heart.fill" : "heart")
                                .foregroundStyle(isSaved ? .red : Color.hex("#64748b"))
                        }
                        .buttonStyle(.plain)
                    }

                    Text(listing.title)
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f172a"))
                        .lineLimit(2)
                        .minimumScaleFactor(0.82)

                    Text(listing.location)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.hex("#475569"))
                        .lineLimit(1)

                    Text(listing.meta)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.hex("#64748b"))
                        .lineLimit(1)

                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(listing.price)
                                .font(.system(size: 14, weight: .heavy))
                                .foregroundStyle(Color.hex("#0f172a"))
                                .lineLimit(1)
                                .minimumScaleFactor(0.78)
                            Text(listing.host)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Color.hex("#64748b"))
                                .lineLimit(1)
                        }
                        Spacer()
                    }
                }
                .padding(10)
            }
            }
            .buttonStyle(.plain)

            Button(action: onChat) {
                Label("Chat now", systemImage: "message")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 36)
                    .background(Color.hex("#0f766e"))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 10)
            .padding(.bottom, 10)
        }
            .background(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ListingDetailView: View {
    let listing: Listing
    let isSaved: Bool
    let affordabilityProfile: AffordabilityProfileContext
    let onToggleSaved: () -> Void
    let onSubmitToolApplication: (String, ToolReport) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var showsAffordabilityAssistant = false
    private var canCheckAffordability: Bool {
        listing.kind == .sales || listing.kind == .stands
    }

    var body: some View {
        if showsAffordabilityAssistant && canCheckAffordability {
            ListingAffordabilityScreen(
                listing: listing,
                profile: affordabilityProfile,
                onBack: { showsAffordabilityAssistant = false }
            )
        } else {
        GeometryReader { proxy in
            let isCompact = proxy.size.width < 390
            let imageHeight = min(max(proxy.size.width * 0.58, 210), 290)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    HStack {
                        Button("Back") {
                            dismiss()
                        }
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f766e"))

                        Spacer()

                        HStack(spacing: 8) {
                            Image(systemName: "square.and.arrow.up")
                                .foregroundStyle(Color.hex("#0f766e"))
                            Button {
                                onToggleSaved()
                            } label: {
                                Image(systemName: isSaved ? "heart.fill" : "heart")
                                    .foregroundStyle(isSaved ? .red : Color.hex("#0f766e"))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    RemoteListingImage(url: listing.imageURL)
                        .frame(height: imageHeight)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    VStack(alignment: .leading, spacing: isCompact ? 8 : 10) {
                        HStack(alignment: .top, spacing: 12) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(listing.title)
                                    .font(.system(size: isCompact ? 24 : 28, weight: .heavy))
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(listing.location)
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.hex("#475569"))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 8)
                            if !isCompact {
                                Text(listing.price)
                                    .font(.system(size: 24, weight: .heavy))
                                    .foregroundStyle(Color.hex("#0f766e"))
                                    .multilineTextAlignment(.trailing)
                                    .layoutPriority(1)
                            }
                        }

                        if isCompact {
                            Text(listing.price)
                                .font(.system(size: 22, weight: .heavy))
                                .foregroundStyle(Color.hex("#0f766e"))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    if canCheckAffordability {
                        Button {
                            withAnimation(.snappy) {
                                showsAffordabilityAssistant.toggle()
                            }
                        } label: {
                            Label("Check Affordability", systemImage: "checkmark.shield")
                                .font(.system(size: 15, weight: .heavy))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(Color.hex("#0f766e"))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }

                    ListingFinancePanel(
                        listing: listing,
                        profile: affordabilityProfile,
                        onSubmitToolApplication: onSubmitToolApplication
                    )

                    FlowRow(items: listing.details)
                    DetailSection(title: "Description", lines: [listing.description])
                    DetailSection(title: "Amenities", lines: listing.amenities)

                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color.hex("#ccfbf1"))
                            .frame(width: 48, height: 48)
                            .overlay(Image(systemName: "person").foregroundStyle(Color.hex("#0f766e")))

                        VStack(alignment: .leading, spacing: 3) {
                            Text(listing.host)
                                .font(.system(size: 16, weight: .heavy))
                            Text("Listed on HomeSwipe")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.hex("#64748b"))
                        }
                    }
                    .cardStyle()
                }
                .padding(16)
            }
            .background(Color(hex: "#f8fafc"))
        }
        }
    }
}

struct ListingAffordabilityScreen: View {
    let listing: Listing
    let profile: AffordabilityProfileContext
    let onBack: () -> Void

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    Button(action: onBack) {
                        Label("Property", systemImage: "chevron.left")
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundStyle(Color.hex("#0f766e"))
                    }
                    .buttonStyle(.plain)

                    Spacer()
                }

                VStack(alignment: .leading, spacing: 5) {
                    Text("Check Affordability")
                        .font(.system(size: 28, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f172a"))
                    Text(listing.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.hex("#64748b"))
                        .lineLimit(2)
                }

                AffordabilityAssistantPanel(listing: listing, profile: profile)
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .background(Color(hex: "#f8fafc"))
    }
}

struct ListingFinancePanel: View {
    let listing: Listing
    let profile: AffordabilityProfileContext
    let onSubmitToolApplication: (String, ToolReport) -> Void
    @State private var deposit = ""
    @State private var upgradeBudget = ""
    @State private var insuranceMonths = "12"
    @State private var selectedMode: ListingFinanceMode = .affordability

    private var availableModes: [ListingFinanceMode] {
        if profile.userType == OnboardingRole.lister.profileLabel {
            return [.upgradeLoan, .insurance]
        }
        if listing.kind == .sales || listing.kind == .stands {
            return [.affordability]
        }
        return []
    }

    var body: some View {
        if !availableModes.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Listing finance")
                            .font(.system(size: 20, weight: .heavy))
                        Text("Prefilled from this listing price and location.")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.hex("#64748b"))
                    }
                    Spacer()
                    Image(systemName: "banknote")
                        .font(.title2)
                        .foregroundStyle(Color.hex("#0f766e"))
                }

                if availableModes.count > 1 {
                    HStack(spacing: 8) {
                        ForEach(availableModes) { mode in
                            Button {
                                selectedMode = mode
                            } label: {
                                Label(mode.title, systemImage: mode.icon)
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(selectedMode == mode ? .white : Color.hex("#0f766e"))
                                    .frame(maxWidth: .infinity)
                                    .frame(minHeight: 38)
                                    .background(selectedMode == mode ? Color.hex("#0f766e") : .white)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                activeModeView
            }
            .onAppear {
                if !availableModes.contains(selectedMode), let first = availableModes.first {
                    selectedMode = first
                }
                if upgradeBudget.isEmpty {
                    upgradeBudget = "\(max(1000, Int(listingPrice * 0.12)))"
                }
            }
            .cardStyle()
        }
    }

    @ViewBuilder
    private var activeModeView: some View {
        switch selectedMode {
        case .affordability:
            affordabilityView
        case .upgradeLoan:
            upgradeView
        case .insurance:
            insuranceView
        }
    }

    private var affordabilityView: some View {
        let report = homeLoanReport
        return VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ProfileFact(title: "Listing price", value: money("USD", listingPrice))
                ProfileFact(title: "Estimated buying power", value: report.results.first(where: { $0.0 == "Estimated Purchase Price" })?.1 ?? "Not ready")
                ProfileFact(title: "Monthly income", value: profile.monthlyIncomeLabel)
                ProfileFact(title: "Property", value: listing.title)
            }
            MoneyInput(title: "Deposit available", text: $deposit)
            ForEach(report.results.prefix(5), id: \.0) { row in
                ResultRow(title: row.0, value: row.1)
            }
            AssistantActionButton(title: "Apply for Loan", icon: "checkmark.seal") {
                onSubmitToolApplication("Apply for Loan", report)
            }
        }
    }

    private var upgradeView: some View {
        let report = upgradeReport
        return VStack(alignment: .leading, spacing: 12) {
            MoneyInput(title: "Upgrade budget", text: $upgradeBudget)
            ForEach(report.results, id: \.0) { row in
                ResultRow(title: row.0, value: row.1)
            }
            AssistantActionButton(title: "Apply For Upgrade Financing", icon: "hammer") {
                onSubmitToolApplication("Apply For Upgrade Financing", report)
            }
        }
    }

    private var insuranceView: some View {
        let report = insuranceReport
        return VStack(alignment: .leading, spacing: 12) {
            ProfileFact(title: "Sum insured", value: money("USD", listingPrice))
            HStack(spacing: 8) {
                ForEach(["4", "8", "12"], id: \.self) { months in
                    ChoiceButton(title: "\(months) months", isSelected: insuranceMonths == months) {
                        insuranceMonths = months
                    }
                }
            }
            ForEach(report.results, id: \.0) { row in
                ResultRow(title: row.0, value: row.1)
            }
            AssistantActionButton(title: "Apply for Loan", icon: "paperplane") {
                onSubmitToolApplication("Request Home Insurance Quote", report)
            }
        }
    }

    private var homeLoanReport: ToolReport {
        let income = profile.monthlyIncome
        let years = 10.0
        let depositAmount = amount(deposit)
        let interestRate = 0.125
        let monthlyRate = interestRate / 12
        let months = years * 12
        let monthlyRepayment = income * 0.3
        let loanAmount = monthlyRate > 0 ? monthlyRepayment * ((1 - pow(1 + monthlyRate, -months)) / monthlyRate) : monthlyRepayment * months
        let requiredDeposit = max(depositAmount, loanAmount * 0.1, listingPrice * 0.1)
        let purchasePrice = loanAmount + requiredDeposit
        let transferCosts = listingPrice * 0.035
        let registrationCosts = loanAmount * 0.025
        let valuationFees = max(150, listingPrice * 0.002)
        let applicationFees = max(100, loanAmount * 0.0015)
        return ToolReport(
            title: "Home Loan Affordability",
            inputs: [("Property", listing.title), ("Location", listing.location), ("Listing Price", money("USD", listingPrice)), ("Monthly Net Income", money("USD", income)), ("Loan Period", "10 years"), ("Deposit Available", money("USD", depositAmount))],
            results: [("Estimated Purchase Price", money("USD", purchasePrice)), ("Listing Price", money("USD", listingPrice)), ("Required Deposit", money("USD", requiredDeposit)), ("Estimated Loan Amount", money("USD", loanAmount)), ("Monthly Repayment", money("USD", monthlyRepayment)), ("Estimated Upfront Costs", money("USD", transferCosts + registrationCosts + valuationFees + applicationFees))]
        )
    }

    private var upgradeReport: ToolReport {
        let budget = max(0, amount(upgradeBudget))
        let total = budget + budget * 0.125 * 3
        return ToolReport(
            title: "Property Upgrades",
            inputs: [("Property", listing.title), ("Property Location", listing.location), ("Estimated Budget", money("USD", budget))],
            results: [("Estimated Project Cost", money("USD", budget)), ("Estimated Monthly Repayment", money("USD", total / 36)), ("Finance Amount", money("USD", budget)), ("Interest Rate", "12.5%"), ("Project Timeline", budget > 20000 ? "8-16 weeks" : "3-8 weeks")],
            notes: ["HomeSwipe controls the project, suppliers, contractors, payments, inspections and completion process.", "Funds are paid directly to approved suppliers and contractors, not to the customer."]
        )
    }

    private var insuranceReport: ToolReport {
        let months = max(4, amount(insuranceMonths))
        let ratePercent = 0.12
        let premium = listingPrice * (ratePercent / 100) * (months / 12)
        let stampDuty = premium * 0.05
        return ToolReport(
            title: "Home, Household and Specified Items Insurance",
            inputs: [("Property", listing.title), ("Location", listing.location), ("Sum Insured", money("USD", listingPrice)), ("Insurance Rate", "0.12%"), ("Period of Cover", "\(Int(months)) months")],
            results: [("Item", "Buildings"), ("Sum Insured", money("USD", listingPrice)), ("Premium", money("USD", premium)), ("Stamp Duty", money("USD", stampDuty)), ("Total Due", money("USD", premium + stampDuty))],
            notes: ["Insurance premium uses the selected rate and period of cover. Stamp duty is calculated at 5% of the premium."]
        )
    }

    private var listingPrice: Double {
        amount(listing.price)
    }

    private func amount(_ text: String) -> Double {
        let cleaned = text.replacingOccurrences(of: ",", with: "")
        let number = cleaned.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
        return Double(number) ?? 0
    }

    private func money(_ currency: String, _ value: Double) -> String {
        "\(currency) \(Int(value.rounded()).formatted())"
    }
}

enum ListingFinanceMode: String, CaseIterable, Identifiable {
    case affordability
    case upgradeLoan
    case insurance

    var id: String { rawValue }

    var title: String {
        switch self {
        case .affordability: return "Affordability"
        case .upgradeLoan: return "Upgrade"
        case .insurance: return "Insurance"
        }
    }

    var icon: String {
        switch self {
        case .affordability: return "house"
        case .upgradeLoan: return "hammer"
        case .insurance: return "shield"
        }
    }
}

struct AffordabilityAssistantPanel: View {
    let listing: Listing
    let profile: AffordabilityProfileContext
    @State private var answers = AffordabilityAnswers()
    @State private var step = 0
    @State private var didCalculate = false

    private let employmentOptions = ["Full-time Employed", "Part-time Employed", "Self-employed", "Business Owner", "Other"]
    private let yearsOptions = ["Less than 1 year", "1-3 years", "3-5 years", "More than 5 years"]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("HomeSwipe Affordability Assistant")
                        .font(.system(size: 20, weight: .heavy))
                    Text("Using profile details already available.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.hex("#64748b"))
                }
                Spacer()
                Image(systemName: "house.lodge")
                    .font(.title2)
                    .foregroundStyle(Color.hex("#0f766e"))
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ProfileFact(title: "Monthly income", value: profile.monthlyIncomeLabel)
                ProfileFact(title: "Verification", value: profile.verificationStatus)
                ProfileFact(title: "Location", value: profile.currentLocation)
                ProfileFact(title: "User type", value: profile.userType)
            }

            if didCalculate {
                affordabilityResults
            } else {
                Text("Question \(step + 1) of 6")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(Color.hex("#0f766e"))
                activeQuestion
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: 260, alignment: .top)
            }
        }
        .cardStyle()
    }

    @ViewBuilder
    private var activeQuestion: some View {
        switch step {
        case 0:
            VStack(alignment: .leading, spacing: 12) {
                assistantQuestion("What is your employment status?")
                ForEach(employmentOptions, id: \.self) { option in
                    ChoiceButton(title: option, isSelected: answers.employmentStatus == option) {
                        answers.employmentStatus = option
                        step = 1
                    }
                }
            }
        case 1:
            VStack(alignment: .leading, spacing: 12) {
                assistantQuestion("Who do you work for?")
                TextField("Employer or business name", text: $answers.employer)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(Color.hex("#f8fafc"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                assistantNextButton(isEnabled: !answers.employer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                    step = 2
                }
            }
        case 2:
            VStack(alignment: .leading, spacing: 12) {
                assistantQuestion("How long have you been working there?")
                ForEach(yearsOptions, id: \.self) { option in
                    ChoiceButton(title: option, isSelected: answers.yearsEmployed == option) {
                        answers.yearsEmployed = option
                        step = 3
                    }
                }
            }
        case 3:
            VStack(alignment: .leading, spacing: 12) {
                assistantQuestion("Do you currently have any loans?")
                HStack(spacing: 10) {
                    ChoiceButton(title: "Yes", isSelected: answers.hasLoans == true) {
                        answers.hasLoans = true
                        step = 4
                    }
                    ChoiceButton(title: "No", isSelected: answers.hasLoans == false) {
                        answers.hasLoans = false
                        answers.loanRepayment = ""
                        step = 5
                    }
                }
            }
        case 4:
            VStack(alignment: .leading, spacing: 12) {
                assistantQuestion("What is your monthly loan repayment amount?")
                MoneyInput(title: "Monthly loan repayment", text: $answers.loanRepayment)
                assistantNextButton(isEnabled: amountValue(answers.loanRepayment) >= 0) {
                    step = 5
                }
            }
        default:
            VStack(alignment: .leading, spacing: 12) {
                assistantQuestion("How much do you currently have saved for a deposit?")
                MoneyInput(title: "Savings / deposit available", text: $answers.deposit)
                assistantNextButton(isEnabled: !answers.deposit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                    didCalculate = true
                }
            }
        }
    }

    private var affordabilityResults: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("HomeSwipe Affordability Score")
                .font(.system(size: 22, weight: .heavy))

            HStack(spacing: 10) {
                ScoreBadge(title: "Rent Ready", isReady: rentReady)
                ScoreBadge(title: "Mortgage Ready", isReady: mortgageReady)
                ScoreBadge(title: "Upgrade Loan Eligible", isReady: upgradeLoanEligible)
            }

            VStack(spacing: 10) {
                ResultRow(title: "Estimated Rent Budget", value: "$\(Int(estimatedRentBudget)) per month")
                ResultRow(title: "Estimated Home Purchase Budget", value: "$\(Int(estimatedHomePurchaseBudget))")
                ResultRow(title: "Available Deposit", value: "$\(Int(depositAmount))")
            }

            VStack(spacing: 10) {
                AssistantActionButton(title: "Get Pre-Approved", icon: "checkmark.seal")
                AssistantActionButton(title: "Compare Mortgages", icon: "building.columns")
                AssistantActionButton(title: "Upgrade Loans", icon: "hammer")
            }
        }
    }

    private var monthlyLoanRepayment: Double {
        answers.hasLoans == true ? amountValue(answers.loanRepayment) : 0
    }

    private var depositAmount: Double {
        amountValue(answers.deposit)
    }

    private var disposableIncome: Double {
        max(0, profile.monthlyIncome - monthlyLoanRepayment)
    }

    private var estimatedRentBudget: Double {
        max(0, disposableIncome * 0.32 * employmentMultiplier * verificationMultiplier)
    }

    private var estimatedHomePurchaseBudget: Double {
        max(0, (disposableIncome * 0.28 * 12 * 18 * employmentMultiplier * verificationMultiplier) + depositAmount)
    }

    private var listingPriceAmount: Double {
        amountValue(listing.price)
    }

    private var rentReady: Bool {
        listing.kind == .rentals ? estimatedRentBudget >= listingPriceAmount : estimatedRentBudget > 0
    }

    private var mortgageReady: Bool {
        depositAmount >= max(1000, estimatedHomePurchaseBudget * 0.05) && estimatedHomePurchaseBudget >= listingPriceAmount
    }

    private var upgradeLoanEligible: Bool {
        disposableIncome >= 500 && monthlyLoanRepayment <= profile.monthlyIncome * 0.25
    }

    private var employmentMultiplier: Double {
        let employmentBoost: Double
        switch answers.employmentStatus {
        case "Full-time Employed", "Business Owner":
            employmentBoost = 1.0
        case "Part-time Employed", "Self-employed":
            employmentBoost = 0.92
        default:
            employmentBoost = 0.84
        }

        let yearsBoost: Double
        switch answers.yearsEmployed {
        case "More than 5 years":
            yearsBoost = 1.1
        case "3-5 years":
            yearsBoost = 1.04
        case "1-3 years":
            yearsBoost = 0.98
        default:
            yearsBoost = 0.9
        }

        return employmentBoost * yearsBoost
    }

    private var verificationMultiplier: Double {
        switch profile.verificationStatus {
        case VerificationState.verified.rawValue:
            return 1.08
        case VerificationState.pendingReview.rawValue:
            return 1.0
        default:
            return 0.92
        }
    }

    private func assistantQuestion(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 18, weight: .heavy))
            .foregroundStyle(Color.hex("#0f172a"))
    }

    private func assistantNextButton(isEnabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text("Continue")
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(isEnabled ? Color.hex("#0f766e") : Color.hex("#94a3b8"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }

    private func amountValue(_ text: String) -> Double {
        let cleaned = text.replacingOccurrences(of: ",", with: "")
        let number = cleaned.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
        return Double(number) ?? 0
    }
}

struct ProfileFact: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Color.hex("#64748b"))
            Text(value)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
                .lineLimit(2)
                .minimumScaleFactor(0.82)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.hex("#f8fafc"))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ProfileTextField: View {
    let label: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(Color.hex("#64748b"))
            TextField(label, text: $text)
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
                .autocorrectionDisabled(keyboard == .emailAddress)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(Color.hex("#f8fafc"))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct MoneyInput: View {
    let title: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 8) {
            Text("$")
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(Color.hex("#0f766e"))
            TextField(title, text: $text)
                .keyboardType(.decimalPad)
                .textFieldStyle(.plain)
        }
        .padding(.horizontal, 12)
        .frame(height: 44)
        .background(Color.hex("#f8fafc"))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ScoreBadge: View {
    let title: String
    let isReady: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isReady ? "checkmark.circle.fill" : "clock")
            Text(title)
                .lineLimit(2)
                .minimumScaleFactor(0.75)
        }
        .font(.system(size: 12, weight: .heavy))
        .foregroundStyle(isReady ? Color.hex("#047857") : Color.hex("#92400e"))
        .frame(maxWidth: .infinity)
        .frame(minHeight: 44)
        .padding(.horizontal, 8)
        .background(isReady ? Color.hex("#ecfdf5") : Color.hex("#fffbeb"))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ResultRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.hex("#475569"))
            Spacer()
            Text(value)
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
        }
        .padding(12)
        .background(Color.hex("#f8fafc"))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct AssistantActionButton: View {
    let title: String
    let icon: String
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(Color.hex("#0f766e"))
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .background(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct EmptyProfilePanel: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(Color.hex("#0f766e"))
            Text(title)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
            Text(message)
                .font(.system(size: 14))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.hex("#64748b"))
        }
        .frame(maxWidth: .infinity)
        .padding(18)
        .background(.white)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct BottomTabBar: View {
    @Binding var activeTab: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                Button {
                    activeTab = tab
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 20, weight: .semibold))
                        Text(tab.rawValue)
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(activeTab == tab ? Color.hex("#0f766e") : Color.hex("#64748b"))
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(activeTab == tab ? Color.hex("#ecfeff") : .white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
        .padding(.bottom, 14)
        .background(.white)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.hex("#e2e8f0"))
                .frame(height: 1)
        }
    }
}

struct SignatureButton: View {
    let title: String
    @Binding var isDone: Bool

    var body: some View {
        Button {
            isDone.toggle()
        } label: {
            HStack(spacing: 7) {
                Image(systemName: isDone ? "checkmark.circle.fill" : "pencil")
                Text(title)
            }
            .font(.system(size: 14, weight: .heavy))
            .foregroundStyle(isDone ? .white : Color.hex("#0f766e"))
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(isDone ? Color.hex("#0f766e") : .white)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.hex("#0f766e"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

struct PageTitle: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 30, weight: .heavy))
                .foregroundStyle(Color.hex("#0f172a"))
            Text(subtitle)
                .font(.system(size: 15))
                .foregroundStyle(Color.hex("#64748b"))
        }
    }
}

struct StatBlock: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(Color.hex("#0f766e"))
            Text(label)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.hex("#64748b"))
        }
        .frame(maxWidth: .infinity)
        .padding(14)
        .background(.white)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ProfileMenuRow: View {
    let title: String
    var hidesDivider = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack {
                    Text(title)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.hex("#0f172a"))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundStyle(Color.hex("#94a3b8"))
                }
                .padding(.horizontal, 16)
                .frame(height: 56)

                if !hidesDivider {
                    Rectangle()
                        .fill(Color.hex("#e2e8f0"))
                        .frame(height: 1)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct SupportActionRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.hex("#0f766e"))
                .frame(width: 42, height: 42)
                .background(Color.hex("#f0fdfa"))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(Color.hex("#0f172a"))
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.hex("#64748b"))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(Color.hex("#94a3b8"))
        }
        .padding(14)
        .background(.white)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct FilterInput: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.hex("#334155"))
            TextField(title, text: $text)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(Color(hex: "#f8fafc"))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#cbd5e1"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

struct FlowRow: View {
    let items: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
            ForEach(items, id: \.self) { item in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.hex("#0f766e"))
                    Text(item)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.hex("#334155"))
                    Spacer()
                }
                .padding(.horizontal, 12)
                .frame(height: 42)
                .background(.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

struct DetailSection: View {
    let title: String
    let lines: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Divider()
            Text(title)
                .font(.system(size: 20, weight: .heavy))
            ForEach(lines, id: \.self) { line in
                Text(line)
                    .font(.system(size: 16))
                    .foregroundStyle(Color.hex("#475569"))
            }
        }
    }
}

struct RemoteListingImage: View {
    let url: String

    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            default:
                Rectangle()
                    .fill(Color.hex("#cbd5e1"))
                    .overlay(
                        Image(systemName: "house")
                            .font(.largeTitle)
                            .foregroundStyle(Color.white.opacity(0.85))
                    )
            }
        }
        .clipped()
    }
}

struct InitialAvatar: View {
    let name: String

    var body: some View {
        Circle()
            .fill(Color.hex("#0f766e"))
            .overlay(
                Text(String(name.trimmingCharacters(in: .whitespacesAndNewlines).first ?? "G").uppercased())
                    .font(.system(size: 30, weight: .heavy))
                    .foregroundStyle(.white)
            )
    }
}

extension View {
    func cardStyle() -> some View {
        self
            .padding(16)
            .background(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64

        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    static func hex(_ value: String) -> Color {
        Color(hex: value)
    }
}

#Preview {
    ContentView()
}

private struct ToolsPreviewHost: View {
    @State private var store = HomeSwipeStore()

    var body: some View {
        ToolsScreen(store: $store)
    }
}

private struct ToolsLeasePreviewHost: View {
    @State private var store = HomeSwipeStore()

    var body: some View {
        ToolsScreen(store: $store, initialActiveTool: .leases, initialToolStep: 10)
            .task {
                store.leaseDraft.property = "Borrowdale Apartment"
                store.leaseDraft.landlord = "Moyo Properties"
                store.leaseDraft.tenant = "Rudo M."
                store.leaseDraft.rent = "850"
                store.leaseDraft.deposit = "850"
                store.leaseDraft.startDate = "2026-07-01"
                store.leaseDraft.endDate = "2027-06-30"
                store.leaseDraft.utilities = "Water included"
                store.leaseDraft.petPolicy = "No pets"
                store.leaseDraft.parking = "Covered parking"
                store.createLease()
            }
    }
}

#Preview("Tools Tab") {
    ToolsPreviewHost()
}

#Preview("Tools Calculator") {
    ToolsScreen(
        store: .constant(HomeSwipeStore()),
        initialActiveTool: .homeLoan,
        initialToolStep: 0,
        initialToolInputs: ToolInputs(currency: "USD", income: "1500", loanYears: "10", deposit: "8000")
    )
}

#Preview("Tools Lease Flow") {
    ToolsLeasePreviewHost()
}
