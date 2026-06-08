import SwiftUI
import Observation

struct ContentView: View {
    @State private var store = HomeSwipeStore()

    var body: some View {
        ZStack(alignment: .bottom) {
            Color(hex: "#f8fafc")
                .ignoresSafeArea()

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
        .sheet(item: $store.selectedListing) { listing in
            ListingDetailView(
                listing: listing,
                isSaved: store.savedListingIDs.contains(listing.id),
                onToggleSaved: { store.toggleSaved(listing) }
            )
        }
        .task {
            await store.startFirebase()
        }
    }
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
    case saved
    case applications
    case documents
    case searches

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview:
            return "Profile"
        case .saved:
            return "Saved homes"
        case .applications:
            return "Applications"
        case .documents:
            return "Verification documents"
        case .searches:
            return "Saved searches"
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
    let time: String
    var messages: [String]
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
}

struct VerificationSignal: Identifiable, Hashable {
    let id = UUID()
    let source: String
    let label: String
    let status: String
    let detail: String
}

struct ListingDraft {
    var propertyType = ""
    var spaceType = ""
    var location = ""
    var area = ""
    var city = ""
    var price = ""
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

    var activeTab: AppTab = .home
    var activeKind: ListingKind = .rentals
    var activeProfileView: ProfileView = .overview
    var searchText = ""
    var filters = HomeFilters()
    var showFilters = false
    var showAddListing = false
    var listingDraft = ListingDraft()
    var firebaseStatus = "Not configured"
    var selectedListing: Listing?
    var savedListingIDs: Set<String> = ["1", "4"]
    var activeConversationID = "moyo-properties"
    var replyDraft = ""
    var savedSearches = ["Borrowdale gated 2 bed", "Avondale furnished cottage", "Ruwa serviced stand"]
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

    var conversations: [Conversation] = [
        Conversation(id: "moyo-properties", person: "Moyo Properties", role: "Landlord", listingTitle: "Sunny 2 bed apartment", time: "12:45", messages: ["The Borrowdale apartment is open for viewing at 4 PM."]),
        Conversation(id: "tari-m", person: "Tari M.", role: "Landlord", listingTitle: "Modern garden cottage", time: "10:12", messages: ["Please send your proof of income for screening."]),
        Conversation(id: "prime-estates", person: "Prime Estates", role: "Agent", listingTitle: "Family home with pool", time: "Mon", messages: ["We can share the title deed docs after registration."])
    ]

    var applications: [RentalApplication] = [
        RentalApplication(id: "application-1", listingID: "1", property: "Sunny 2 bed apartment", landlord: "Moyo Properties", status: "Viewing booked", submitted: "May 3, 2026", nextStep: "Attend viewing and confirm proof of income."),
        RentalApplication(id: "application-2", listingID: "2", property: "Modern garden cottage", landlord: "Tari Homes", status: "Docs requested", submitted: "May 1, 2026", nextStep: "Upload ID, employment letter, and latest payslip."),
        RentalApplication(id: "application-3", listingID: "4", property: "Townhouse near schools", landlord: "Kudu Realty", status: "Submitted", submitted: "April 28, 2026", nextStep: "Waiting for landlord response.")
    ]

    var leases: [LeaseDraft] = [
        LeaseDraft(
            id: "lease-1",
            property: "Modern garden cottage, Avondale",
            landlord: "Tari Homes",
            tenant: "Rudo M.",
            rent: "$520",
            deposit: "$520",
            startDate: "2026-05-15",
            endDate: "2027-05-14",
            utilities: "Prepaid electricity. Water included.",
            petPolicy: "No pets without written consent.",
            parking: "Open parking for one vehicle.",
            status: "Sent for signing",
            landlordSigned: true,
            tenantSigned: false
        )
    ]

    var documents: [VerificationDocument] = [
        VerificationDocument(id: "national-id", title: "Government ID and selfie match", status: "Verified", standard: "Name, ID number, expiry, face match, and tamper check.", risk: "Low"),
        VerificationDocument(id: "proof-income", title: "Proof of income", status: "Needs update", standard: "Latest 3 payslips or employer-confirmed income.", risk: "High"),
        VerificationDocument(id: "bank-statements", title: "6 months bank statements", status: "Missing", standard: "Salary deposits, cashflow, undisclosed debt, and affordability.", risk: "High"),
        VerificationDocument(id: "employment-letter", title: "Employment confirmation", status: "Ready for review", standard: "Employer, role, tenure, contract type, and contact validation.", risk: "Medium")
    ]

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
            let searchBlob = "\(listing.title) \(listing.location) \(listing.meta) \(listing.description) \(listing.amenities.joined(separator: " ")) \(listing.details.joined(separator: " "))".lowercased()
            let matchesSearch = searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || searchBlob.contains(searchText.lowercased())
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
    }

    var savedListings: [Listing] {
        listings.filter { savedListingIDs.contains($0.id) }
    }

    var activeConversation: Conversation? {
        conversations.first(where: { $0.id == activeConversationID }) ?? conversations.first
    }

    private var currentUserData: HomeSwipeUserData {
        HomeSwipeUserData(
            applications: applications,
            conversations: conversations,
            leases: leases,
            savedListingIDs: Array(savedListingIDs),
            savedSearches: savedSearches
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
                applications = userData.applications
                conversations = userData.conversations
                leases = userData.leases
                savedListingIDs = Set(userData.savedListingIDs)
                savedSearches = userData.savedSearches
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
            host: "HomeSwipe User",
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

    func sendReply() {
        let trimmed = replyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = conversations.firstIndex(where: { $0.id == activeConversationID }) else {
            return
        }

        conversations[index].messages.append(trimmed)
        replyDraft = ""
        syncUserData()
    }

    func markDocumentReady(_ document: VerificationDocument) {
        guard let index = documents.firstIndex(of: document) else { return }
        documents[index].status = "Ready for review"
    }

    func runVerification() {
        let missingHighRisk = documents.filter { $0.risk == "High" && $0.status == "Missing" }.count

        verificationSignals = [
            VerificationSignal(
                source: "OpenAI",
                label: missingHighRisk > 0 ? "Document reasoning needs review" : "Document reasoning looks consistent",
                status: missingHighRisk > 0 ? "Review" : "Pass",
                detail: missingHighRisk > 0 ? "High-risk evidence is missing, so affordability and ownership claims need manual review." : "Extracted names, dates, and property references are consistent enough for underwriter review."
            ),
            VerificationSignal(
                source: "Truth AI",
                label: missingHighRisk > 0 ? "Fraud and identity screen pending" : "Fraud and identity screen clear",
                status: missingHighRisk > 0 ? "Review" : "Pass",
                detail: missingHighRisk > 0 ? "Truth AI checks should run after every high-risk document is uploaded." : "No duplicate identity, tamper, or title authority flags are visible in the current packet."
            )
        ]
    }

    private func syncUserData() {
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

    private func mergeListings(local: [Listing], remote: [Listing]) -> [Listing] {
        var merged = Dictionary(uniqueKeysWithValues: local.map { ($0.id, $0) })
        for listing in remote {
            merged[listing.id] = listing
        }
        return Array(merged.values)
    }

    private func numberValue(in text: String) -> Double {
        let cleaned = text.replacingOccurrences(of: ",", with: "")
        let number = cleaned.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).joined()
        return Double(number) ?? 0
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
                    AddListingPanel(store: $store)
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

                LazyVStack(spacing: 16) {
                    ForEach(store.filteredListings) { listing in
                        ListingCard(
                            listing: listing,
                            isSaved: store.savedListingIDs.contains(listing.id),
                            onToggleSaved: { store.toggleSaved(listing) },
                            onOpen: { store.selectedListing = listing }
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

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "Tools", subtitle: "Lease drafting, document verification, and signing workflows.")

                VStack(spacing: 12) {
                    ToolCard(
                        title: "Lease workspace",
                        description: "Draft lease terms, track signatures, and manage status changes.",
                        isActive: true,
                        icon: "doc.text"
                    )
                    ToolCard(
                        title: "Mortgage verification",
                        description: "Review income, identity, and ownership evidence before underwriting.",
                        isActive: false,
                        icon: "checkmark.shield"
                    )
                }

                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Lease workspace")
                                .font(.system(size: 22, weight: .heavy))
                            Text("Direct communication between landlord and tenant with signing status.")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.hex("#64748b"))
                        }
                        Spacer()
                        Image(systemName: "doc.text")
                            .font(.title2)
                            .foregroundStyle(Color.hex("#0f766e"))
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

                            Button {
                                lease.status = "Sent for signing"
                            } label: {
                                Label("Send for online signing", systemImage: "paperplane")
                                    .font(.system(size: 14, weight: .heavy))
                                    .foregroundStyle(Color.hex("#0f766e"))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 42)
                                    .background(Color.hex("#f0fdfa"))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                        .cardStyle()
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Verification documents")
                            .font(.system(size: 22, weight: .heavy))
                        Spacer()
                        Button("Run check") {
                            store.runVerification()
                        }
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .frame(height: 42)
                        .background(Color.hex("#0f766e"))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .buttonStyle(.plain)
                    }

                    ForEach(store.documents) { document in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(document.title)
                                        .font(.system(size: 16, weight: .heavy))
                                    Text(document.status)
                                        .font(.system(size: 13, weight: .heavy))
                                        .foregroundStyle(Color.hex("#0f766e"))
                                }
                                Spacer()
                                Text(document.risk.uppercased())
                                    .font(.system(size: 11, weight: .heavy))
                                    .foregroundStyle(document.risk == "High" ? Color.hex("#b91c1c") : Color.hex("#475569"))
                            }

                            Text(document.standard)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.hex("#475569"))

                            Button("Mark ready") {
                                store.markDocumentReady(document)
                            }
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundStyle(Color.hex("#0f766e"))
                            .buttonStyle(.plain)
                        }
                        .cardStyle()
                    }

                    ForEach(store.verificationSignals) { signal in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(signal.source)
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(Color.hex("#0f766e"))
                                Spacer()
                                Text(signal.status.uppercased())
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(signal.status == "Pass" ? Color.hex("#047857") : Color.hex("#92400e"))
                            }
                            Text(signal.label)
                                .font(.system(size: 18, weight: .heavy))
                            Text(signal.detail)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.hex("#64748b"))
                        }
                        .cardStyle()
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
    }
}

struct MessagesScreen: View {
    @Binding var store: HomeSwipeStore

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "Messages", subtitle: "Direct communication between landlords and tenants.")

                VStack(spacing: 10) {
                    ForEach(store.conversations) { conversation in
                        Button {
                            store.activeConversationID = conversation.id
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
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(activeConversation.person)
                                    .font(.system(size: 22, weight: .heavy))
                                Text("\(activeConversation.role) · \(activeConversation.listingTitle)")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.hex("#64748b"))
                            }
                            Spacer()
                            Image(systemName: "message")
                                .font(.title2)
                                .foregroundStyle(Color.hex("#0f766e"))
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
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
    }
}

struct ProfileScreen: View {
    @Binding var store: HomeSwipeStore

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
                    RemoteAvatarImage(url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80")
                        .frame(width: 74, height: 74)
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.activeProfileView.title)
                            .font(.system(size: 24, weight: .heavy))
                        Text("Tenant · verified profile")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.hex("#64748b"))
                    }

                    Spacer()

                    Button {
                        store.activeProfileView = .documents
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
                        StatBlock(value: "\(store.savedListings.count)", label: "Saved")
                        StatBlock(value: "\(store.applications.count)", label: "Applications")
                        StatBlock(value: "4.8", label: "Rating")
                    }

                    VStack(spacing: 0) {
                        ProfileMenuRow(title: "Saved homes") { store.activeProfileView = .saved }
                        ProfileMenuRow(title: "Applications") { store.activeProfileView = .applications }
                        ProfileMenuRow(title: "Verification documents") { store.activeProfileView = .documents }
                        ProfileMenuRow(title: "Saved searches", hidesDivider: true) { store.activeProfileView = .searches }
                    }
                    .background(.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.hex("#e2e8f0"), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                if store.activeProfileView == .saved {
                    VStack(spacing: 16) {
                        ForEach(store.savedListings) { listing in
                            ListingCard(
                                listing: listing,
                                isSaved: true,
                                onToggleSaved: { store.toggleSaved(listing) },
                                onOpen: { store.selectedListing = listing }
                            )
                        }
                    }
                }

                if store.activeProfileView == .applications {
                    VStack(spacing: 12) {
                        ForEach(store.applications) { application in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(application.property)
                                    .font(.system(size: 19, weight: .heavy))
                                Text(application.landlord)
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.hex("#475569"))
                                Text(application.status)
                                    .font(.system(size: 14, weight: .heavy))
                                    .foregroundStyle(Color.hex("#0f766e"))
                                Text(application.nextStep)
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.hex("#64748b"))
                            }
                            .cardStyle()
                        }
                    }
                }

                if store.activeProfileView == .documents {
                    VStack(spacing: 12) {
                        ForEach(store.documents) { document in
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Color.hex("#ccfbf1"))
                                    .frame(width: 44, height: 44)
                                    .overlay(Image(systemName: "doc.text").foregroundStyle(Color.hex("#0f766e")))

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(document.title)
                                        .font(.system(size: 16, weight: .heavy))
                                    Text(document.status)
                                        .font(.system(size: 13, weight: .heavy))
                                        .foregroundStyle(Color.hex("#0f766e"))
                                }

                                Spacer()

                                Text(document.risk.uppercased())
                                    .font(.system(size: 11, weight: .heavy))
                                    .foregroundStyle(document.risk == "High" ? Color.hex("#b91c1c") : Color.hex("#475569"))
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

                if store.activeProfileView == .searches {
                    VStack(spacing: 12) {
                        ForEach(store.savedSearches, id: \.self) { search in
                            HStack {
                                Text(search)
                                    .font(.system(size: 16, weight: .semibold))
                                Spacer()
                                Button {
                                    store.searchText = search
                                    store.activeTab = .home
                                } label: {
                                    Image(systemName: "arrow.up.left")
                                        .foregroundStyle(Color.hex("#0f766e"))
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 14)
                            .frame(height: 56)
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
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 120)
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

                HStack(spacing: 6) {
                    Image(systemName: "icloud")
                        .font(.system(size: 13, weight: .bold))
                    Text("Firebase: \(store.firebaseStatus)")
                        .font(.system(size: 12, weight: .heavy))
                }
                .foregroundStyle(Color.hex("#0f766e"))
                .padding(.horizontal, 10)
                .frame(height: 28)
                .background(Color.hex("#ecfeff"))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.hex("#99f6e4"), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            Spacer(minLength: 12)

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

struct SearchBar: View {
    @Binding var store: HomeSwipeStore

    var body: some View {
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
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteListingImage(url: listing.imageURL)
                    .frame(height: 220)

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text(listing.tag.uppercased())
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(Color.hex("#0f766e"))
                        Spacer()
                        Button(action: onToggleSaved) {
                            Image(systemName: isSaved ? "heart.fill" : "heart")
                                .foregroundStyle(isSaved ? .red : Color.hex("#64748b"))
                        }
                        .buttonStyle(.plain)
                    }

                    Text(listing.title)
                        .font(.system(size: 19, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f172a"))

                    Text(listing.location)
                        .font(.system(size: 15))
                        .foregroundStyle(Color.hex("#475569"))

                    Text(listing.meta)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.hex("#64748b"))

                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(listing.price)
                                .font(.system(size: 18, weight: .heavy))
                                .foregroundStyle(Color.hex("#0f172a"))
                            Text(listing.host)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(Color.hex("#64748b"))
                        }
                        Spacer()
                    }
                }
                .padding(14)
            }
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

struct ListingDetailView: View {
    let listing: Listing
    let isSaved: Bool
    let onToggleSaved: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
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
                    .frame(height: 290)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(listing.title)
                            .font(.system(size: 28, weight: .heavy))
                        Text(listing.location)
                            .font(.system(size: 16))
                            .foregroundStyle(Color.hex("#475569"))
                    }
                    Spacer()
                    Text(listing.price)
                        .font(.system(size: 24, weight: .heavy))
                        .foregroundStyle(Color.hex("#0f766e"))
                }

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

struct ToolCard: View {
    let title: String
    let description: String
    let isActive: Bool
    let icon: String

    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.hex("#ccfbf1"))
                .frame(width: 48, height: 48)
                .overlay(Image(systemName: icon).foregroundStyle(Color.hex("#0f766e")))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 18, weight: .heavy))
                Text(description)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.hex("#64748b"))
            }

            Spacer()
        }
        .padding(16)
        .background(isActive ? Color.hex("#f0fdfa") : .white)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isActive ? Color.hex("#0f766e") : Color.hex("#e2e8f0"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
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

struct RemoteAvatarImage: View {
    let url: String

    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            default:
                Circle()
                    .fill(Color.hex("#cbd5e1"))
                    .overlay(Image(systemName: "person.fill").foregroundStyle(.white))
            }
        }
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
