import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageStyle,
  KeyboardTypeOptions,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleProp,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image as CompressorImage } from 'react-native-compressor';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  query as firestoreQuery,
  QueryDocumentSnapshot,
  setDoc,
  startAfter,
  where
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, db, isFirebaseConfigured, storage } from './firebase';

const welcomeHomeImage = require('../assets/welcome-home.jpeg');

type TabKey = 'home' | 'tools' | 'messages' | 'profile';
type ListingKind = 'rentals' | 'sales' | 'stands';

type Listing = {
  id: string;
  kind: ListingKind;
  title: string;
  location: string;
  price: string;
  meta: string;
  host: string;
  image: string;
  photos: string[];
  storagePaths?: string[];
  tag: string;
  description: string;
  amenities: string[];
  details: string[];
  propertyType?: string;
  spaceType?: string;
  streetAddress?: string;
  area?: string;
  city?: string;
  mapPin?: string;
  features?: string[];
  rules?: string[];
  standSize?: string;
  standServicing?: string;
  standTitle?: string;
  standRoadAccess?: string;
  standZoning?: string;
  ownerId?: string;
  ownerName?: string;
  createdAt?: number;
  updatedAt?: number;
  sortOrder?: number;
};

type ListingForm = {
  kind: ListingKind;
  propertyType: string;
  spaceType: string;
  title: string;
  location: string;
  area: string;
  city: string;
  mapPin: string;
  price: string;
  meta: string;
  host: string;
  image: string;
  photos: string;
  localPhotos: string[];
  description: string;
  amenities: string;
  features: string[];
  guests: string;
  bedrooms: string;
  bathrooms: string;
  standSize: string;
  standServicing: string;
  standTitle: string;
  standRoadAccess: string;
  standZoning: string;
  houseRuleDraft: string;
  houseRules: string[];
};

type LeaseDraft = {
  id: string;
  property: string;
  landlord: string;
  tenant: string;
  rent: string;
  deposit: string;
  startDate: string;
  endDate: string;
  utilities: string;
  petPolicy: string;
  parking: string;
  status: 'Draft' | 'Sent for signing' | 'Completed';
  landlordSigned: boolean;
  tenantSigned: boolean;
};

type Conversation = {
  id: string;
  person: string;
  role: string;
  listingTitle: string;
  profile?: PublicProfileSnapshot;
  time: string;
  messages: string[];
};

type PublicProfileSnapshot = {
  name: string;
  role: string;
  verification: string;
  location: string;
  budget?: string;
  propertyTypes?: string[];
  amenities?: string[];
  employmentStatus?: string;
  householdTypes?: string[];
  leasePreferences?: string[];
  primaryLocation?: string;
  propertyCount?: string;
  listerType?: string;
};

type ApplicationStatus = 'Submitted' | 'Viewing booked' | 'Docs requested' | 'In Review' | 'Approved';

type RentalApplication = {
  id: string;
  listingId: string;
  property: string;
  landlord: string;
  status: ApplicationStatus;
  submitted: string;
  nextStep: string;
};

type ProfileView = 'overview' | 'landlordListings' | 'saved' | 'applications' | 'rating' | 'personal' | 'documents' | 'support' | 'payments';

type HomeFilters = {
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  bathrooms: string;
  amenity: string;
  savedOnly: boolean;
};

type FirebaseStatus = 'Not configured' | 'Connecting' | 'Synced' | 'Saving' | 'Offline';
type AuthMode = 'signin' | 'signup';
type AuthPrompt = {
  reason: string;
};

type UserProfile = {
  id: string;
  displayName: string;
  email?: string;
};

type HomeSwipeData = {
  accountProfile?: AccountProfileInput;
  signUpMethod?: string;
  onboardingRole?: OnboardingRole | null;
  tenantOnboarding?: TenantOnboardingInput;
  listerOnboarding?: ListerOnboardingInput;
  publicProfile?: PublicProfileSnapshot;
  verificationRole?: VerificationRole;
  verificationDocuments?: VerificationDocument[];
  applications: RentalApplication[];
  conversations: Conversation[];
  leases: LeaseDraft[];
  savedListingIds: string[];
};

type VerificationDocumentStatus = 'Verified' | 'Ready for review' | 'Needs update' | 'Missing';

type VerificationDocument = {
  id: string;
  title: string;
  status: VerificationDocumentStatus;
  standard: string;
  risk: 'Low' | 'Medium' | 'High';
  fileName?: string;
};

type VerificationRole = 'Tenant' | 'Landlord / Property Owner' | 'Property Manager' | 'Real Estate Agent' | 'Property Developer' | 'Estate Agency';
type OnboardingRole = 'tenant' | 'lister';

type TenantOnboardingInput = {
  city: string;
  budget: string;
  propertyTypes: string[];
  amenities: string[];
  employmentStatus: string;
  householdTypes: string[];
  leasePreferences: string[];
};

type ListerOnboardingInput = {
  listerType: VerificationRole | '';
  primaryLocation: string;
  propertyCount: string;
};

type AccountProfileInput = {
  fullName: string;
  email: string;
  phone: string;
  employer: string;
  monthlyBudget: string;
  password: string;
  forgotPasswordMessage: string;
};

const verificationRoles: VerificationRole[] = [
  'Tenant',
  'Landlord / Property Owner',
  'Property Manager',
  'Real Estate Agent',
  'Property Developer',
  'Estate Agency'
];

const listerVerificationRoles: VerificationRole[] = verificationRoles.filter((role) => role !== 'Tenant');
const onboardingCities = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Other'];
const onboardingBudgets = ['Under $200', '$200-$500', '$500-$1000', '$1000+'];
const onboardingPropertyTypes = ['Apartment', 'House', 'Cottage', 'Room', 'Townhouse'];
const onboardingAmenities = ['Wi-Fi', 'Parking', 'Borehole', 'Solar', 'Security', 'Furnished'];
const onboardingEmploymentStatuses = ['Employed', 'Self-Employed', 'Student', 'Other'];
const onboardingHouseholdTypes = ['Living Alone', 'Couple', 'Family', 'Shared Accommodation', 'Student Housing'];
const onboardingLeasePreferences = ['Month-to-Month', '6 Months', '12 Months', 'Long-Term'];
const onboardingPropertyCounts = ['1-5', '6-20', '20+'];

const emptyTenantOnboarding: TenantOnboardingInput = {
  city: '',
  budget: '',
  propertyTypes: [],
  amenities: [],
  employmentStatus: '',
  householdTypes: [],
  leasePreferences: []
};

const emptyListerOnboarding: ListerOnboardingInput = {
  listerType: '',
  primaryLocation: '',
  propertyCount: ''
};

const emptyAccountProfile: AccountProfileInput = {
  fullName: '',
  email: '',
  phone: '',
  employer: '',
  monthlyBudget: '',
  password: '',
  forgotPasswordMessage: ''
};

const createVerificationDocument = (id: string, title: string, standard: string): VerificationDocument => ({
  id,
  title,
  status: 'Missing',
  standard,
  risk: 'High'
});

const getVerificationDocumentsForRole = (role: VerificationRole): VerificationDocument[] => {
  switch (role) {
    case 'Landlord / Property Owner':
      return [
        createVerificationDocument('national-id-passport', 'National ID / Passport', 'Upload a valid national ID or passport.'),
        createVerificationDocument('title-deed-ownership', 'Title Deed or Proof of Property Ownership', 'Upload a title deed or accepted proof that you own the property.')
      ];
    case 'Property Manager':
      return [
        createVerificationDocument('national-id-passport', 'National ID / Passport', 'Upload a valid national ID or passport.'),
        createVerificationDocument('company-registration', 'Company Registration Documents', 'Upload company registration documents for the managing business.'),
        createVerificationDocument('management-authority', 'Property Management Agreement or Letter of Authority', 'Upload the agreement or authority letter proving you can manage the property.')
      ];
    case 'Real Estate Agent':
      return [createVerificationDocument('national-id-passport', 'National ID / Passport', 'Upload a valid national ID or passport.')];
    case 'Property Developer':
      return [
        createVerificationDocument('national-id-passport', 'National ID / Passport', 'Upload a valid national ID or passport.'),
        createVerificationDocument('company-registration', 'Company Registration Documents', 'Upload company registration documents for the development company.'),
        createVerificationDocument('development-permit', 'Development Permit / Project Approval Documents', 'Upload the development permit or approved project documents.')
      ];
    case 'Estate Agency':
      return [createVerificationDocument('agency-licence', 'Real Estate Agency Licence', 'Upload the real estate agency licence.')];
    case 'Tenant':
    default:
      return [
        createVerificationDocument('national-id-passport', 'National ID / Passport', 'Upload a valid national ID or passport.'),
        createVerificationDocument('proof-of-income', 'Proof of Income', 'Upload a payslip, employment letter, or bank statement.'),
        createVerificationDocument('police-clearance', 'Police Clearance Certificate', 'Upload a police clearance certificate.')
      ];
  }
};

const emptyListingForm: ListingForm = {
  kind: 'rentals',
  propertyType: '',
  spaceType: '',
  title: '',
  location: '',
  area: '',
  city: '',
  mapPin: '',
  price: '',
  meta: '',
  host: '',
  image: '',
  photos: '',
  localPhotos: [],
  description: '',
  amenities: '',
  features: [],
  guests: '',
  bedrooms: '',
  bathrooms: '',
  standSize: '',
  standServicing: '',
  standTitle: '',
  standRoadAccess: '',
  standZoning: '',
  houseRuleDraft: '',
  houseRules: []
};

const initialConversations: Conversation[] = [];
const demoConversationIds = new Set(['moyo-properties', 'tari-m', 'prime-estates']);

const removeDemoConversations = (conversations: Conversation[] = []) => {
  return conversations.filter((conversation) => !demoConversationIds.has(conversation.id));
};

const initialApplications: RentalApplication[] = [];
const demoApplicationIds = new Set(['application-1', 'application-2', 'application-3']);

const removeDemoApplications = (applications: RentalApplication[] = []) => {
  return applications.filter((application) => !demoApplicationIds.has(application.id));
};

const initialLeases: LeaseDraft[] = [];
const demoLeaseIds = new Set(['lease-1']);
const emptyLeaseForm: Omit<LeaseDraft, 'id' | 'status' | 'landlordSigned' | 'tenantSigned'> = {
  property: '',
  landlord: '',
  tenant: '',
  rent: '',
  deposit: '',
  startDate: '',
  endDate: '',
  utilities: '',
  petPolicy: '',
  parking: ''
};

const removeDemoLeases = (leases: LeaseDraft[] = []) => {
  return leases.filter((lease) => !demoLeaseIds.has(lease.id));
};

const initialListings: Listing[] = [
  {
    id: '1',
    kind: 'rentals',
    title: 'Sunny 2 bed apartment',
    location: 'Borrowdale, Harare',
    price: '$850/mo',
    meta: '2 beds · 2 baths · gated',
    host: 'Moyo Properties',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
    photos: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448075-bb485b067938?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448205-4d9b3e6bb6db?auto=format&fit=crop&w=1200&q=80'
    ],
    tag: 'Available now',
    description: 'A bright apartment with open-plan living, secure access, and quick access to Borrowdale shops and schools.',
    amenities: ['Gated security', 'Backup water', 'Fitted kitchen', 'Balcony'],
    details: ['2 bedrooms', '2 bathrooms', 'Covered parking', 'Available immediately']
  },
  {
    id: '2',
    kind: 'rentals',
    title: 'Modern garden cottage',
    location: 'Avondale, Harare',
    price: '$520/mo',
    meta: '1 bed · furnished · Wi-Fi',
    host: 'Tari Homes',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    photos: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560184897-ae75f418493e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
    ],
    tag: 'Verified landlord',
    description: 'A compact furnished cottage with a private garden, ideal for a single professional or couple.',
    amenities: ['Furnished', 'Wi-Fi ready', 'Private garden', 'Solar backup'],
    details: ['1 bedroom', '1 bathroom', 'Shared gate', 'Month-to-month accepted']
  },
  {
    id: '3',
    kind: 'sales',
    title: 'Family home with pool',
    location: 'Greendale, Harare',
    price: '$180,000',
    meta: '4 beds · 3 baths · title deed',
    host: 'Prime Estates',
    image: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80',
    photos: [
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80'
    ],
    tag: 'For sale',
    description: 'A spacious family home with mature trees, generous entertainment space, and a clean title deed.',
    amenities: ['Swimming pool', 'Title deed', 'Staff quarters', 'Borehole'],
    details: ['4 bedrooms', '3 bathrooms', 'Double garage', '1,800 sqm stand']
  },
  {
    id: '4',
    kind: 'sales',
    title: 'Townhouse near schools',
    location: 'Newlands, Harare',
    price: '$130,000',
    meta: '3 beds · garage · solar',
    host: 'Kudu Realty',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1200&q=80'
    ],
    tag: 'Viewing today',
    description: 'Low-maintenance townhouse near schools and shops, with modern finishes and reliable solar power.',
    amenities: ['Solar system', 'Garage', 'Modern kitchen', 'Secure complex'],
    details: ['3 bedrooms', '2.5 bathrooms', 'Sectional title', 'Viewing slots open']
  },
  {
    id: '5',
    kind: 'stands',
    title: 'Ready-to-build stand',
    location: 'Ruwa, Mashonaland East',
    price: '$28,000',
    meta: '600 sqm · serviced · cession',
    host: 'Stand Market',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    photos: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80'
    ],
    tag: 'Stands',
    description: 'Serviced residential stand in a growing suburb with road access and paperwork ready for transfer.',
    amenities: ['Serviced land', 'Road access', 'Council approved', 'Ready to build'],
    details: ['600 sqm', 'Cession', 'Flat terrain', 'Marked boundaries']
  },
  {
    id: '6',
    kind: 'stands',
    title: 'Corner stand in new suburb',
    location: 'Norton, Mashonaland West',
    price: '$18,500',
    meta: '900 sqm · road access · council',
    host: 'Green Acre Land',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    photos: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'
    ],
    tag: 'Popular',
    description: 'A corner stand with generous frontage in a developing area suited for a family home or investment build.',
    amenities: ['Corner stand', 'Road frontage', 'Council paperwork', 'Investment area'],
    details: ['900 sqm', 'Council stand', 'Road access', 'Flexible payment terms']
  }
];

const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Search', icon: 'search-outline' },
  { key: 'tools', label: 'Tools', icon: 'construct-outline' },
  { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-circle-outline' }
];

const listingFilters: { key: ListingKind; label: string }[] = [
  { key: 'rentals', label: 'Rentals' },
  { key: 'sales', label: 'For sale' },
  { key: 'stands', label: 'Stands' }
];

const localUserProfile: UserProfile = {
  id: 'local-user',
  displayName: 'Guest'
};

const listingFeatureOptions = ['Gated', 'Solar backup', 'Borehole', 'Parking', 'Furnished', 'Wi-Fi ready'];
const zimbabweSearchTerms = [
  'Harare',
  'Bulawayo',
  'Mutare',
  'Gweru',
  'Masvingo',
  'Chitungwiza',
  'Victoria Falls',
  'Kadoma',
  'Kwekwe',
  'Marondera',
  'Ruwa',
  'Norton',
  'Borrowdale',
  'Avondale',
  'Mount Pleasant',
  'Greendale',
  'Highlands',
  'Marlborough',
  'Eastlea',
  'Newlands',
  'Mabelreign',
  'Waterfalls',
  'Hatfield',
  'Famona',
  'Khumalo',
  'Burnside',
  'Hillside',
  'Suburbs',
  'Cottage',
  'Apartment',
  'House',
  'Townhouse',
  'Stand',
  'Serviced stand',
  'Borehole',
  'Solar backup',
  'Gated',
  'Furnished',
  'Parking',
  'Pool',
  'Garden',
  'Road access',
  'Council stand'
];
const insuranceItems = ['Buildings', 'Contents', 'Clothing and Personal effects', 'Spectacles', 'Cellphones', 'Jewellery', 'Wedding Rings'];
const insurancePeriods = [
  { label: '4 Months', value: '4' },
  { label: '8 Months', value: '8' },
  { label: '12 Months', value: '12' }
];

const emptyHomeFilters: HomeFilters = {
  minPrice: '',
  maxPrice: '',
  bedrooms: '',
  bathrooms: '',
  amenity: '',
  savedOnly: false
};

const listingsPageSize = 20;
const compressedImageMaxSize = 1280;

const getNumberFromText = (value: string) => {
  const match = value.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const normalizeSearchValue = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const getSearchTokens = (value: string) => {
  return normalizeSearchValue(value)
    .split(/[^a-z0-9$]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
};

const getListingSearchText = (listing: Listing) => {
  return normalizeSearchValue(
    `${listing.title} ${listing.location} ${listing.meta} ${listing.price} ${listing.description} ${listing.amenities.join(' ')} ${listing.details.join(' ')} ${listing.propertyType || ''} ${listing.spaceType || ''} ${listing.area || ''} ${listing.city || ''}`
  );
};

const getListingSearchScore = (listing: Listing, search: string) => {
  const normalizedSearch = normalizeSearchValue(search);
  if (!normalizedSearch) {
    return 0;
  }

  const tokens = getSearchTokens(normalizedSearch);
  const title = normalizeSearchValue(listing.title);
  const location = normalizeSearchValue(listing.location);
  const price = normalizeSearchValue(listing.price);
  const meta = normalizeSearchValue(listing.meta);
  const amenities = normalizeSearchValue(listing.amenities.join(' '));
  const details = normalizeSearchValue(listing.details.join(' '));
  const description = normalizeSearchValue(listing.description);
  const searchable = getListingSearchText(listing);

  let score = searchable.includes(normalizedSearch) ? 12 : 0;

  tokens.forEach((token) => {
    if (title.includes(token)) score += 9;
    if (location.includes(token)) score += 8;
    if (amenities.includes(token)) score += 6;
    if (meta.includes(token) || details.includes(token)) score += 5;
    if (price.includes(token)) score += 4;
    if (description.includes(token)) score += 2;
  });

  return score;
};

const getListingMatchSummary = (listing: Listing, search: string) => {
  const tokens = getSearchTokens(search);
  if (tokens.length === 0) {
    return '';
  }

  const matchParts = [
    listing.location,
    listing.meta,
    listing.price,
    ...listing.amenities,
    ...listing.details
  ].filter((part) => tokens.some((token) => normalizeSearchValue(part).includes(token)));

  return matchParts.slice(0, 3).join(' · ');
};

const getListingSuggestionParts = (listing: Listing) => {
  return [
    listing.city,
    listing.area,
    listing.location,
    listing.propertyType,
    listing.spaceType,
    listing.title,
    listing.meta,
    listing.price,
    ...listing.amenities,
    ...listing.details
  ].filter(Boolean) as string[];
};

const getSearchSuggestions = (query: string, listings: Listing[], activeKind: ListingKind) => {
  const normalizedQuery = normalizeSearchValue(query);
  const candidateParts = [
    ...zimbabweSearchTerms,
    ...listings.filter((listing) => listing.kind === activeKind).flatMap(getListingSuggestionParts)
  ];
  const unique = Array.from(new Set(candidateParts.map((part) => part.trim()).filter((part) => part.length > 1)));

  if (!normalizedQuery) {
    return unique.slice(0, 10);
  }

  return unique
    .map((part) => {
      const normalized = normalizeSearchValue(part);
      const startsWith = normalized.startsWith(normalizedQuery);
      const includes = normalized.includes(normalizedQuery);
      return { part, score: startsWith ? 2 : includes ? 1 : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score || first.part.length - second.part.length)
    .slice(0, 10)
    .map((item) => item.part);
};

const getUserDisplayName = (user: User | null) => {
  const displayName = user?.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const emailName = user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  if (emailName) {
    return emailName.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return 'Guest';
};

const getInitial = (value: string) => {
  return (value.trim()[0] || 'G').toUpperCase();
};

const getListingLink = (listing: Listing) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('listing', listing.id);
    url.searchParams.delete('lease');
    return url.toString();
  }

  return `https://homeswipe.app/listings/${encodeURIComponent(listing.id)}`;
};

const getLeaseLink = (lease: LeaseDraft) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.delete('listing');
    url.searchParams.set('lease', lease.id);
    return url.toString();
  }

  return `https://homeswipe.app/leases/${encodeURIComponent(lease.id)}`;
};

const getLeaseShareMessage = (lease: LeaseDraft) => {
  return [
    `HomeSwipe lease: ${lease.property}`,
    `Landlord: ${lease.landlord}`,
    `Tenant: ${lease.tenant}`,
    `Rent: ${lease.rent}`,
    `Deposit: ${lease.deposit}`,
    `Term: ${lease.startDate} to ${lease.endDate}`,
    `Status: ${lease.status}`,
    `Open lease: ${getLeaseLink(lease)}`
  ].join('\n');
};

type ReportPayload = {
  title: string;
  userName: string;
  userEmail?: string;
  inputs: Record<string, string>;
  results: Record<string, string>;
  notes?: string[];
};

type SavedToolReport = {
  id: string;
  title: string;
  createdAt: string;
  payload: ReportPayload;
};

const formatMoney = (currency: string, value: number) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${currency} ${Math.round(safeValue).toLocaleString()}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getEstimatedMonthlyIncomeFromBudget = (budget: string) => {
  if (budget === 'Under $200') return 600;
  if (budget === '$200-$500') return 1200;
  if (budget === '$500-$1000') return 2500;
  if (budget === '$1000+') return 4000;
  return 0;
};

const getListingHomeLoanReport = (listing: Listing, userName: string, userEmail: string, monthlyIncome: number, depositText = ''): ReportPayload => {
  const currency = 'USD';
  const listingPrice = getNumberFromText(listing.price);
  const years = 10;
  const deposit = getNumberFromText(depositText);
  const maxMonthly = monthlyIncome * 0.3;
  const months = years * 12;
  const loanAmount = monthlyRate > 0 ? maxMonthly * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate) : maxMonthly * months;
  const requiredDeposit = Math.max(deposit, loanAmount * 0.1, listingPrice * 0.1);
  const purchasePrice = loanAmount + requiredDeposit;
  const transferCosts = listingPrice * 0.035;
  const registrationCosts = loanAmount * 0.025;
  const valuationFees = Math.max(150, listingPrice * 0.002);
  const applicationFees = Math.max(100, loanAmount * 0.0015);
  return {
    title: 'Home Loan Affordability',
    userName,
    userEmail,
    inputs: {
      Property: listing.title,
      Location: listing.location,
      'Listing Price': formatMoney(currency, listingPrice),
      'Monthly Net Income': formatMoney(currency, monthlyIncome),
      'Loan Period': `${years} years`,
      'Deposit Available': formatMoney(currency, deposit)
    },
    results: {
      'Estimated Purchase Price': formatMoney(currency, purchasePrice),
      'Listing Price': formatMoney(currency, listingPrice),
      'Required Deposit': formatMoney(currency, requiredDeposit),
      'Estimated Loan Amount': formatMoney(currency, loanAmount),
      'Monthly Repayment': formatMoney(currency, maxMonthly),
      'Estimated Upfront Costs': formatMoney(currency, transferCosts + registrationCosts + valuationFees + applicationFees)
    }
  };
};

const getListingUpgradeReport = (listing: Listing, userName: string, userEmail: string, budgetText: string): ReportPayload => {
  const currency = 'USD';
  const budget = getNumberFromText(budgetText);
  const total = budget + budget * interestRate * 3;
  return {
    title: 'Property Upgrades',
    userName,
    userEmail,
    inputs: {
      Property: listing.title,
      'Property Location': listing.location,
      'Estimated Budget': formatMoney(currency, budget)
    },
    results: {
      'Estimated Project Cost': formatMoney(currency, budget),
      'Estimated Monthly Repayment': formatMoney(currency, total / 36),
      'Finance Amount': formatMoney(currency, budget),
      'Interest Rate': formatPercent(12.5),
      'Project Timeline': budget > 20000 ? '8-16 weeks' : '3-8 weeks'
    },
    notes: ['HomeSwipe controls the project, suppliers, contractors, payments, inspections and completion process.', 'Funds are paid directly to approved suppliers and contractors, not to the customer.']
  };
};

const getListingInsuranceReport = (listing: Listing, userName: string, userEmail: string, monthsText: string): ReportPayload => {
  const currency = 'USD';
  const sumInsured = getNumberFromText(listing.price);
  const ratePercent = 0.12;
  const months = Math.max(4, getNumberFromText(monthsText) || 12);
  const premium = sumInsured * (ratePercent / 100) * (months / 12);
  const stampDuty = premium * 0.05;
  return {
    title: 'Home, Household and Specified Items Insurance',
    userName,
    userEmail,
    inputs: {
      Property: listing.title,
      Location: listing.location,
      'Item Insured': 'Buildings',
      'Sum Insured': formatMoney(currency, sumInsured),
      'Insurance Rate': `${ratePercent}%`,
      'Period of Cover': `${months} months`
    },
    results: {
      Item: 'Buildings',
      'Sum Insured': formatMoney(currency, sumInsured),
      Premium: formatMoney(currency, premium),
      'Stamp Duty': formatMoney(currency, stampDuty),
      'Total Due': formatMoney(currency, premium + stampDuty)
    },
    notes: ['Insurance premium uses the selected rate and period of cover. Stamp duty is calculated at 5% of the premium.']
  };
};

const sanitizePdfText = (value: string) => value.replace(/[()\\]/g, (character) => `\\${character}`).replace(/[^\x20-\x7E]/g, '-');

const buildPdfBlob = (payload: ReportPayload) => {
  const lines = [
    'HomeSwipe',
    payload.title,
    `User: ${payload.userName || 'Guest'}`,
    payload.userEmail ? `Email: ${payload.userEmail}` : '',
    `Date generated: ${new Date().toLocaleDateString()}`,
    '',
    'Calculation inputs',
    ...Object.entries(payload.inputs).map(([key, value]) => `${key}: ${value}`),
    '',
    'Results summary',
    ...Object.entries(payload.results).map(([key, value]) => `${key}: ${value}`),
    '',
    ...(payload.notes?.length ? ['Notes', ...payload.notes] : []),
    '',
    'Disclaimer',
    'These estimates are indicative only and subject to provider assessment, verification, affordability checks, valuation, fees, and final approval.'
  ].filter(Boolean);
  const pageCommands = lines
    .slice(0, 54)
    .map((line, index) => `BT /F1 10 Tf 50 ${790 - index * 14} Td (${sanitizePdfText(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${pageCommands.length} >> stream\n${pageCommands}\nendstream endobj`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
};

const downloadReportPdf = (payload: ReportPayload) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    Share.share({
      title: payload.title,
      message: `${payload.title}\n${Object.entries(payload.results).map(([key, value]) => `${key}: ${value}`).join('\n')}`
    });
    return;
  }

  const blob = buildPdfBlob(payload);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'homeswipe-report'}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

const shareReport = async (payload: ReportPayload) => {
  const message = `${payload.title}\n${Object.entries(payload.results).map(([key, value]) => `${key}: ${value}`).join('\n')}`;
  await Share.share({ title: payload.title, message });
};

const emailReport = (payload: ReportPayload) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    shareReport(payload);
    return;
  }

  const body = [
    payload.title,
    '',
    'Inputs',
    ...Object.entries(payload.inputs).map(([key, value]) => `${key}: ${value}`),
    '',
    'Results',
    ...Object.entries(payload.results).map(([key, value]) => `${key}: ${value}`),
    '',
    'Disclaimer: estimates are indicative and subject to final approval.'
  ].join('\n');
  window.location.href = `mailto:?subject=${encodeURIComponent(`HomeSwipe ${payload.title}`)}&body=${encodeURIComponent(body)}`;
};

const uniqueListings = (listings: Listing[]) => {
  return listings.filter((listing, index, allListings) => allListings.findIndex((item) => item.id === listing.id) === index);
};

const mapListingDocument = (listingDoc: QueryDocumentSnapshot<DocumentData>): Listing => {
  return {
    ...(listingDoc.data() as Listing),
    id: listingDoc.id
  };
};

const getListingFormSummary = (form: ListingForm) => {
  const roomDetails =
    form.kind === 'stands'
      ? [
          form.standSize ? `${form.standSize} stand` : '',
          form.standServicing,
          form.standTitle,
          form.standRoadAccess,
          form.standZoning
        ]
      : [form.bedrooms ? `${form.bedrooms} beds` : '', form.bathrooms ? `${form.bathrooms} baths` : '', form.guests ? `${form.guests} guests` : ''];
  const summaryParts = [form.propertyType, form.spaceType, ...roomDetails, ...form.features].map((item) => item.trim()).filter(Boolean);
  return summaryParts.length > 0 ? summaryParts.join(' · ') : 'Details available on request';
};

const compressImageUri = async (uri: string) => {
  if (Platform.OS === 'web') {
    return compressImageForWeb(uri, compressedImageMaxSize);
  }

  return CompressorImage.compress(uri, {
    compressionMethod: 'auto',
    maxHeight: compressedImageMaxSize,
    maxWidth: compressedImageMaxSize,
    quality: 0.78
  });
};

const isLocalImageUri = (uri: string) => {
  return uri.startsWith('data:') || uri.startsWith('file:') || uri.startsWith('blob:') || uri.startsWith('content:');
};

const getImageExtension = (contentType: string) => {
  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('webp')) {
    return 'webp';
  }

  return 'jpg';
};

const sanitizeStorageSegment = (value: string) => {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'listing';
};

const uploadListingPhoto = async (uri: string, ownerId: string, listingId: string, index: number) => {
  const firebaseStorage = storage;

  if (!firebaseStorage) {
    throw new Error('Firebase Storage is not configured.');
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const extension = getImageExtension(contentType);
  const path = `homeswipeUsers/${ownerId}/listings/${listingId}/photos/${Date.now()}-${index}.${extension}`;
  const photoRef = storageRef(firebaseStorage, path);

  await uploadBytes(photoRef, blob, {
    contentType,
    customMetadata: {
      ownerId,
      listingId
    }
  });

  return {
    url: await getDownloadURL(photoRef),
    path
  };
};

const uploadListingPhotos = async (uris: string[], ownerId: string, listingId: string) => {
  const localUris = uris.filter(isLocalImageUri);

  if (localUris.length === 0) {
    return {
      urlsByUri: new Map<string, string>(),
      storagePaths: [] as string[]
    };
  }

  const uploads = await Promise.all(localUris.map((uri, index) => uploadListingPhoto(uri, ownerId, sanitizeStorageSegment(listingId), index)));

  return {
    urlsByUri: new Map(localUris.map((uri, index) => [uri, uploads[index].url])),
    storagePaths: uploads.map((upload) => upload.path)
  };
};

const deleteListingStoragePaths = async (paths: string[] = []) => {
  const firebaseStorage = storage;

  if (!firebaseStorage || paths.length === 0) {
    return;
  }

  await Promise.all(paths.map((path) => deleteObject(storageRef(firebaseStorage, path)).catch(() => undefined)));
};

const compressImageForWeb = (uri: string, maxSize: number) => {
  if (typeof document === 'undefined') {
    return Promise.resolve(uri);
  }

  return new Promise<string>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(uri);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.onerror = () => resolve(uri);
    image.src = uri;
  });
};

const CachedImage = ({ source, style }: { source: { uri: string }; style: StyleProp<ImageStyle> }) => {
  return <Image source={{ uri: source.uri, cache: 'force-cache' }} style={style} />;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [activeKind, setActiveKind] = useState<ListingKind>('rentals');
  const [query, setQuery] = useState('');
  const [didCompleteOnboarding, setDidCompleteOnboarding] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.localStorage.getItem('homeswipe.web.onboarding.complete') === 'true'
      : false
  );
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingRole, setOnboardingRole] = useState<OnboardingRole | null>(null);
  const [signUpMethod, setSignUpMethod] = useState('Email');
  const [accountProfile, setAccountProfile] = useState<AccountProfileInput>(emptyAccountProfile);
  const [tenantOnboarding, setTenantOnboarding] = useState<TenantOnboardingInput>(emptyTenantOnboarding);
  const [listerOnboarding, setListerOnboarding] = useState<ListerOnboardingInput>(emptyListerOnboarding);
  const [verificationRole, setVerificationRole] = useState<VerificationRole>('Tenant');
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocument[]>(() => getVerificationDocumentsForRole('Tenant'));
  const [currentLandlordProfile, setCurrentLandlordProfile] = useState<UserProfile>(localUserProfile);
  const [availableListings, setAvailableListings] = useState<Listing[]>(initialListings);
  const [showListingForm, setShowListingForm] = useState(false);
  const [showHomeFilters, setShowHomeFilters] = useState(false);
  const [homeFilters, setHomeFilters] = useState<HomeFilters>(emptyHomeFilters);
  const [listingForm, setListingForm] = useState<ListingForm>(emptyListingForm);
  const [listingStep, setListingStep] = useState(0);
  const [listingPublishError, setListingPublishError] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [applications, setApplications] = useState<RentalApplication[]>(initialApplications);
  const [leases, setLeases] = useState<LeaseDraft[]>(initialLeases);
  const [savedToolReports, setSavedToolReports] = useState<SavedToolReport[]>([]);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus>(isFirebaseConfigured ? 'Connecting' : 'Not configured');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authPrompt, setAuthPrompt] = useState<AuthPrompt | null>(null);
  const [isPublishingListing, setIsPublishingListing] = useState(false);
  const hasLoadedFirebaseData = useRef(!isFirebaseConfigured);
  const isApplyingRemoteUserData = useRef(false);
  const firebaseSaveId = useRef(0);
  const firebaseSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedLinkedListingId = useRef<string | null>(null);
  const openedLinkedLeaseId = useRef<string | null>(null);
  const [landlordListings, setLandlordListings] = useState<Listing[]>([]);
  const [optimisticListings, setOptimisticListings] = useState<Listing[]>([]);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const isFirebaseUserReady = !auth || Boolean(firebaseUser);
  const userDataDocId = currentLandlordProfile.id;
  const isSignedIn = Boolean(firebaseUser);
  const verificationRoleLabel = onboardingRole === 'lister' ? listerOnboarding.listerType || 'Lister' : 'Tenant';
  const isListerOnboardingComplete = Boolean(listerOnboarding.listerType && listerOnboarding.primaryLocation && listerOnboarding.propertyCount);
  const onboardingFinalStep = onboardingRole === 'tenant' ? 10 : 6;
  const onboardingVerificationStep = onboardingRole === 'tenant' ? 9 : 5;
  const publicProfile: PublicProfileSnapshot = {
    name: currentLandlordProfile.displayName,
    role: verificationRoleLabel,
    verification: verificationDocuments.every((document) => document.status === 'Verified') ? 'Verified' : 'Not Verified',
    location: onboardingRole === 'tenant' ? tenantOnboarding.city : listerOnboarding.primaryLocation,
    budget: tenantOnboarding.budget,
    propertyTypes: tenantOnboarding.propertyTypes,
    amenities: tenantOnboarding.amenities,
    employmentStatus: tenantOnboarding.employmentStatus,
    householdTypes: tenantOnboarding.householdTypes,
    leasePreferences: tenantOnboarding.leasePreferences,
    primaryLocation: listerOnboarding.primaryLocation,
    propertyCount: listerOnboarding.propertyCount,
    listerType: listerOnboarding.listerType
  };

  const applySignedInProfile = (user: User) => {
    setFirebaseUser(user);
    setCurrentLandlordProfile({
      id: user.uid,
      displayName: getUserDisplayName(user),
      email: user.email || undefined
    });
  };

  const getPublicAccountProfile = (profile: AccountProfileInput) => ({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    employer: profile.employer,
    monthlyBudget: profile.monthlyBudget
  });

  const saveAccountProfile = async (nextProfile: AccountProfileInput) => {
    if (!requireAuth('Sign in to update your private HomeSwipe profile.')) {
      return;
    }

    setAccountProfile((current) => ({ ...current, ...nextProfile, password: '', forgotPasswordMessage: '' }));
    setCurrentLandlordProfile((current) => ({
      ...current,
      displayName: nextProfile.fullName.trim() || current.displayName,
      email: nextProfile.email.trim() || current.email
    }));

    if (firebaseUser && nextProfile.fullName.trim() && nextProfile.fullName.trim() !== firebaseUser.displayName) {
      try {
        await updateProfile(firebaseUser, { displayName: nextProfile.fullName.trim() });
      } catch {
        setFirebaseStatus('Offline');
      }
    }
  };

  const requireAuth = (reason: string) => {
    if (isSignedIn) {
      return true;
    }

    setAuthPrompt({ reason });
    return false;
  };

  useEffect(() => {
    setVerificationDocuments((currentDocuments) => {
      const currentById = new Map(currentDocuments.map((document) => [document.id, document]));
      return getVerificationDocumentsForRole(verificationRole).map((document) => ({
        ...document,
        status: currentById.get(document.id)?.status || document.status,
        fileName: currentById.get(document.id)?.fileName
      }));
    });
  }, [verificationRole]);

  const finishOnboarding = () => {
    setDidCompleteOnboarding(true);
    setOnboardingStep(0);
    if (accountProfile.fullName.trim()) {
      setCurrentLandlordProfile((current) => ({
        ...current,
        displayName: accountProfile.fullName.trim(),
        email: accountProfile.email.trim() || current.email
      }));
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem('homeswipe.web.onboarding.complete', 'true');
    }

    if (onboardingRole === 'tenant') {
      setActiveTab('home');
      setActiveKind('rentals');
      setQuery('');
      setHomeFilters((current) => ({
        ...current,
        amenity: tenantOnboarding.amenities[0] || ''
      }));
      return;
    }

    setActiveTab('profile');
  };

  const advanceOnboarding = () => {
    if (onboardingStep === 0) {
      setOnboardingStep(1);
      return;
    }

    const nextStep = onboardingStep + 1;
    if (nextStep === onboardingVerificationStep) {
      setVerificationRole(onboardingRole === 'lister' ? listerOnboarding.listerType || 'Landlord / Property Owner' : 'Tenant');
    }

    if (nextStep > onboardingFinalStep) {
      finishOnboarding();
      return;
    }

    setOnboardingStep(nextStep);
  };

  const continueFromOnboardingSignup = () => {
    if (signUpMethod !== 'Email') {
      setAccountProfile((current) => {
        const fullName = current.fullName.trim() || `${signUpMethod} User`;
        setCurrentLandlordProfile((profile) => ({
          ...profile,
          displayName: fullName,
          email: current.email.trim() || profile.email
        }));
        return { ...current, fullName, forgotPasswordMessage: '' };
      });
      setOnboardingStep(1);
      return;
    }

    setCurrentLandlordProfile((profile) => ({
      ...profile,
      displayName: accountProfile.fullName.trim() || profile.displayName,
      email: accountProfile.email.trim() || profile.email
    }));
    setAccountProfile((current) => ({ ...current, forgotPasswordMessage: '' }));
    setOnboardingStep(1);
  };

  const requestOnboardingPasswordReset = () => {
    setAccountProfile((current) => ({
      ...current,
      forgotPasswordMessage: current.email.trim()
        ? `Password reset request prepared for ${current.email.trim()}.`
        : 'Enter your email first, then request a reset link.'
    }));
  };

  const skipOnboardingVerification = () => {
    setVerificationDocuments(getVerificationDocumentsForRole(verificationRole));
    advanceOnboarding();
  };

  const chooseVerificationDocumentFile = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return new Promise<string | undefined>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          resolve(file?.name);
        };
        input.click();
      });
    }

    return ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9
    }).then((result) => {
      if (result.canceled) {
        return undefined;
      }

      const asset = result.assets[0];
      return asset.fileName || asset.uri.split('/').pop() || 'Uploaded document';
    });
  };

  const uploadVerificationDocument = async (id: string) => {
    if (!onRequireAuthForVerification()) {
      return;
    }

    const fileName = await chooseVerificationDocumentFile();
    if (!fileName) {
      return;
    }

    setVerificationDocuments((currentDocuments) =>
      currentDocuments.map((document) => (document.id === id ? { ...document, status: 'Verified', fileName } : document))
    );
  };

  const onRequireAuthForVerification = () => requireAuth('Sign in to upload and manage verification documents.');

  const filteredListings = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    return availableListings
      .map((listing, index) => ({
        listing,
        index,
        searchScore: getListingSearchScore(listing, normalizedQuery)
      }))
      .filter(({ listing, searchScore }) => {
      const matchesKind = listing.kind === activeKind;
      const searchable = getListingSearchText(listing);
      const matchesQuery = !normalizedQuery || searchScore > 0 || searchable.includes(normalizedQuery);
      const price = getNumberFromText(listing.price);
      const minPrice = getNumberFromText(homeFilters.minPrice);
      const maxPrice = getNumberFromText(homeFilters.maxPrice);
      const bedrooms = getNumberFromText(homeFilters.bedrooms);
      const bathrooms = getNumberFromText(homeFilters.bathrooms);
      const listingBedrooms = getNumberFromText(`${listing.meta} ${listing.details.join(' ')}`.match(/\d+(\.\d+)?\s*(bed|bedroom)/i)?.[0] || '');
      const listingBathrooms = getNumberFromText(`${listing.meta} ${listing.details.join(' ')}`.match(/\d+(\.\d+)?\s*(bath|bathroom)/i)?.[0] || '');
      const matchesMinPrice = !minPrice || price >= minPrice;
      const matchesMaxPrice = !maxPrice || price <= maxPrice;
      const matchesBedrooms = !bedrooms || listingBedrooms >= bedrooms;
      const matchesBathrooms = !bathrooms || listingBathrooms >= bathrooms;
      const matchesAmenity = searchable.includes(homeFilters.amenity.trim().toLowerCase());
      const matchesSaved = !homeFilters.savedOnly || savedListingIds.includes(listing.id);

      return matchesKind && matchesQuery && matchesMinPrice && matchesMaxPrice && matchesBedrooms && matchesBathrooms && matchesAmenity && matchesSaved;
    })
      .sort((first, second) => {
        if (second.searchScore !== first.searchScore) {
          return second.searchScore - first.searchScore;
        }

        return first.index - second.index;
      })
      .map(({ listing }) => listing);
  }, [activeKind, availableListings, homeFilters, query, savedListingIds]);

  const savedListings = useMemo(() => {
    const knownListings = uniqueListings([...availableListings, ...optimisticListings, ...landlordListings, ...initialListings]);
    return knownListings.filter((listing) => savedListingIds.includes(listing.id));
  }, [availableListings, optimisticListings, landlordListings, savedListingIds]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const linkedListingId = new URL(window.location.href).searchParams.get('listing');
    if (!linkedListingId || openedLinkedListingId.current === linkedListingId) {
      return;
    }

    const knownListings = uniqueListings([...availableListings, ...optimisticListings, ...landlordListings, ...initialListings]);
    const linkedListing = knownListings.find((listing) => listing.id === linkedListingId);
    if (!linkedListing) {
      return;
    }

    openedLinkedListingId.current = linkedListingId;
    setActiveKind(linkedListing.kind);
    setSelectedListing(linkedListing);
  }, [availableListings, optimisticListings, landlordListings]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const linkedLeaseId = new URL(window.location.href).searchParams.get('lease');
    if (!linkedLeaseId || openedLinkedLeaseId.current === linkedLeaseId) {
      return;
    }

    const linkedLease = leases.find((lease) => lease.id === linkedLeaseId);
    if (!linkedLease) {
      return;
    }

    openedLinkedLeaseId.current = linkedLeaseId;
    setSelectedListing(null);
    setActiveTab('tools');
  }, [leases]);

  const activeHomeFilterCount = useMemo(() => {
    return [
      homeFilters.minPrice,
      homeFilters.maxPrice,
      homeFilters.bedrooms,
      homeFilters.bathrooms,
      homeFilters.amenity,
      homeFilters.savedOnly ? 'saved' : ''
    ].filter(Boolean).length;
  }, [homeFilters]);

  const beginFirebaseSave = () => {
    const saveId = firebaseSaveId.current + 1;
    firebaseSaveId.current = saveId;
    setFirebaseStatus('Saving');

    if (firebaseSaveTimer.current) {
      clearTimeout(firebaseSaveTimer.current);
    }

    firebaseSaveTimer.current = setTimeout(() => {
      if (firebaseSaveId.current === saveId) {
        setFirebaseStatus('Offline');
      }
    }, 8000);

    return (status: FirebaseStatus) => {
      if (firebaseSaveId.current !== saveId) {
        return;
      }

      if (firebaseSaveTimer.current) {
        clearTimeout(firebaseSaveTimer.current);
        firebaseSaveTimer.current = null;
      }

      setFirebaseStatus(status);
    };
  };

  const saveConversationsToFirebase = (nextConversations: Conversation[]) => {
    const firestore = db;
    if (!firestore || !isFirebaseUserReady || !userDataDocId) {
      return;
    }

    const completeSave = beginFirebaseSave();
    setDoc(
      doc(firestore, 'homeswipeUsers', userDataDocId),
      { conversations: removeDemoConversations(nextConversations) },
      { merge: true }
    )
      .then(() => completeSave('Synced'))
      .catch(() => completeSave('Offline'));
  };

  useEffect(() => {
    if (!db) {
      setFirebaseStatus('Not configured');
      return;
    }

    const timer = setTimeout(() => {
      setFirebaseStatus((currentStatus) => (currentStatus === 'Connecting' ? 'Offline' : currentStatus));
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const firebaseAuth = auth;
    if (!firebaseAuth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        applySignedInProfile(user);
        setAuthPrompt(null);
        return;
      }

      setFirebaseUser(null);
      setCurrentLandlordProfile(localUserProfile);
      hasLoadedFirebaseData.current = false;
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      if (firebaseSaveTimer.current) {
        clearTimeout(firebaseSaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const firestore = db;
    if (!firestore || !isFirebaseUserReady) {
      return;
    }

    const unsubscribe = onSnapshot(
      doc(firestore, 'homeswipeUsers', userDataDocId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<HomeSwipeData>;
          isApplyingRemoteUserData.current = true;
          setSignUpMethod(data.signUpMethod || 'Email');
          setAccountProfile((current) => ({ ...current, ...(data.accountProfile || {}), password: '', forgotPasswordMessage: '' }));
          setOnboardingRole(data.onboardingRole ?? null);
          setTenantOnboarding(data.tenantOnboarding || emptyTenantOnboarding);
          setListerOnboarding(data.listerOnboarding || emptyListerOnboarding);
          setVerificationRole(data.verificationRole || 'Tenant');
          setVerificationDocuments(data.verificationDocuments || getVerificationDocumentsForRole(data.verificationRole || 'Tenant'));
          setSavedListingIds(data.savedListingIds || []);
          setConversations(removeDemoConversations(data.conversations || initialConversations));
          setApplications(removeDemoApplications(data.applications || initialApplications));
          setLeases(removeDemoLeases(data.leases || initialLeases));
        } else {
          const completeSave = beginFirebaseSave();
          setDoc(doc(firestore, 'homeswipeUsers', userDataDocId), {
            accountProfile: getPublicAccountProfile(accountProfile),
            signUpMethod,
            onboardingRole,
            tenantOnboarding,
            listerOnboarding,
            publicProfile,
            verificationRole,
            verificationDocuments,
            applications,
            conversations,
            leases,
            savedListingIds
          })
            .then(() => completeSave('Synced'))
            .catch(() => completeSave('Offline'));
        }

        hasLoadedFirebaseData.current = true;
        setFirebaseStatus('Synced');
      },
      () => {
        hasLoadedFirebaseData.current = true;
        setFirebaseStatus('Offline');
      }
    );

    return unsubscribe;
  }, [isFirebaseUserReady, userDataDocId]);

  useEffect(() => {
    const firestore = db;
    if (!firestore || !isFirebaseUserReady) {
      return;
    }

    return onSnapshot(
      firestoreQuery(collection(firestore, 'homeswipeListings'), where('ownerId', '==', currentLandlordProfile.id)),
      (snapshot) => {
        const remoteListings = snapshot.docs.map(mapListingDocument);
        setLandlordListings(uniqueListings(remoteListings));
        setOptimisticListings((currentListings) =>
          currentListings.filter((localListing) => !remoteListings.some((remoteListing) => remoteListing.id === localListing.id))
        );
      },
      () => setFirebaseStatus('Offline')
    );
  }, [currentLandlordProfile.id, isFirebaseUserReady]);

  const loadListingsPage = async (mode: 'reset' | 'more') => {
    const firestore = db;
    const localLandlordListings = uniqueListings([...optimisticListings, ...landlordListings]).filter((listing) => listing.kind === activeKind);

    if (!firestore) {
      const localListings = uniqueListings([...localLandlordListings, ...initialListings.filter((listing) => listing.kind === activeKind)]);
      setAvailableListings(mode === 'reset' ? localListings.slice(0, listingsPageSize) : localListings);
      setHasMoreListings(localListings.length > listingsPageSize);
      return;
    }

    if (isLoadingListings || (mode === 'more' && !hasMoreListings)) {
      return;
    }

    setIsLoadingListings(true);

    try {
      const listingQuery =
        mode === 'more' && lastListingDoc
          ? firestoreQuery(
              collection(firestore, 'homeswipeListings'),
              where('kind', '==', activeKind),
              startAfter(lastListingDoc),
              firestoreLimit(listingsPageSize)
            )
          : firestoreQuery(collection(firestore, 'homeswipeListings'), where('kind', '==', activeKind), firestoreLimit(listingsPageSize));
      const snapshot = await getDocs(listingQuery);
      const listings = snapshot.docs.map(mapListingDocument);

      if (mode === 'reset' && snapshot.empty) {
        const fallbackListings = uniqueListings([...localLandlordListings, ...initialListings.filter((listing) => listing.kind === activeKind)]);
        setAvailableListings(fallbackListings.slice(0, listingsPageSize));
        setLastListingDoc(null);
        setHasMoreListings(false);
        setFirebaseStatus('Synced');
        return;
      }

      setAvailableListings((currentListings) => {
        const nextListings = mode === 'more' ? [...currentListings, ...listings] : [...localLandlordListings, ...listings];
        return uniqueListings(nextListings);
      });
      setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreListings(snapshot.docs.length === listingsPageSize);
      setFirebaseStatus('Synced');
    } catch {
      const fallbackListings = uniqueListings([...localLandlordListings, ...initialListings.filter((listing) => listing.kind === activeKind)]);
      setAvailableListings(mode === 'more' ? fallbackListings : fallbackListings.slice(0, listingsPageSize));
      setHasMoreListings(fallbackListings.length > listingsPageSize);
      setFirebaseStatus('Offline');
    } finally {
      setIsLoadingListings(false);
    }
  };

  useEffect(() => {
    setSelectedListing(null);
    setLastListingDoc(null);
    setHasMoreListings(true);
    loadListingsPage('reset');
  }, [activeKind]);

  useEffect(() => {
    const activeLandlordListings = uniqueListings([...optimisticListings, ...landlordListings]).filter((listing) => listing.kind === activeKind);
    if (activeLandlordListings.length === 0) {
      return;
    }

    setAvailableListings((currentListings) => uniqueListings([...activeLandlordListings, ...currentListings]));
  }, [activeKind, optimisticListings, landlordListings]);

  useEffect(() => {
    const firestore = db;
    if (!firestore || !isFirebaseUserReady || !hasLoadedFirebaseData.current) {
      return;
    }

    if (isApplyingRemoteUserData.current) {
      isApplyingRemoteUserData.current = false;
      return;
    }

    const completeSave = beginFirebaseSave();
    setDoc(
      doc(firestore, 'homeswipeUsers', userDataDocId),
      {
        applications,
        accountProfile: getPublicAccountProfile(accountProfile),
        conversations,
        signUpMethod,
        onboardingRole,
        tenantOnboarding,
        listerOnboarding,
        publicProfile,
        verificationRole,
        verificationDocuments,
        leases,
        savedListingIds
      },
      { merge: true }
    )
      .then(() => completeSave('Synced'))
      .catch(() => completeSave('Offline'));
  }, [accountProfile.email, accountProfile.employer, accountProfile.fullName, accountProfile.monthlyBudget, accountProfile.phone, applications, conversations, leases, isFirebaseUserReady, listerOnboarding, onboardingRole, savedListingIds, signUpMethod, tenantOnboarding, userDataDocId, verificationDocuments, verificationRole]);

  const addListing = async () => {
    if (!requireAuth('Sign up to publish your listing and manage enquiries from tenants or buyers.')) {
      return;
    }

    if (isPublishingListing) {
      return;
    }

    if (!db || !firebaseUser) {
      setListingPublishError('Sign in with Firebase before publishing a listing.');
      return;
    }

    const streetAddress = listingForm.location.trim();
    const area = listingForm.area.trim();
    const city = listingForm.city.trim();
    const mapPin = listingForm.mapPin.trim();
    const location = [streetAddress, area, city].filter(Boolean).join(', ');
    const priceNumber = listingForm.price.replace(/[^0-9.]/g, '').trim();
    const price = `$${priceNumber}`;
    const ownerId = firebaseUser.uid;
    const host = currentLandlordProfile.displayName;
    const createdAt = Date.now();
    const listingId = `${createdAt}`;

    const missingFields = [
      !streetAddress ? 'street address or stand number' : '',
      !area ? 'suburb or area' : '',
      !city ? 'city or town' : '',
      !priceNumber ? 'price' : ''
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setListingPublishError(`Add ${missingFields.join(', ')} before publishing.`);
      setListingStep(missingFields.includes('price') ? (listingForm.kind === 'stands' ? 2 : 3) : 0);
      return;
    }

    setListingPublishError('');
    setIsPublishingListing(true);

    const fallbackImage =
      listingForm.kind === 'stands'
        ? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
        : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80';

    const galleryPhotos = listingForm.photos
      .split('\n')
      .map((photo) => photo.trim())
      .filter(Boolean);
    const uploadedPhotos = listingForm.localPhotos;
    const amenities = listingForm.amenities
      .split(',')
      .map((amenity) => amenity.trim())
      .filter(Boolean);
    const listingAmenities = [...amenities, ...listingForm.features].filter((amenity, index, allAmenities) => allAmenities.indexOf(amenity) === index);
    const derivedSummary = getListingFormSummary(listingForm);
    const houseRules = [...listingForm.houseRules, listingForm.houseRuleDraft]
      .map((rule) => rule.trim())
      .filter(Boolean);
    const title =
      listingForm.title.trim() ||
      [listingForm.propertyType.trim() || (listingForm.kind === 'stands' ? 'Stand' : 'Home'), area, city].filter(Boolean).join(' in ');
    const details = [
      listingForm.propertyType || 'Home',
      listingForm.spaceType || 'Entire place',
      listingForm.guests ? `${listingForm.guests} guests` : '',
      listingForm.bedrooms ? `${listingForm.bedrooms} bedrooms` : '',
      listingForm.bathrooms ? `${listingForm.bathrooms} bathrooms` : '',
      listingForm.standSize ? `Stand size: ${listingForm.standSize}` : '',
      listingForm.standServicing ? `Servicing: ${listingForm.standServicing}` : '',
      listingForm.standTitle ? `Title: ${listingForm.standTitle}` : '',
      listingForm.standRoadAccess ? `Access: ${listingForm.standRoadAccess}` : '',
      listingForm.standZoning ? `Zoning: ${listingForm.standZoning}` : '',
      mapPin ? `Map pin: ${mapPin}` : '',
      ...houseRules.map((rule) => `Rule: ${rule}`),
      derivedSummary
    ].filter(Boolean);

    let uploadedStoragePaths: string[] = [];

    try {
      const uploadedPhotoResult = await uploadListingPhotos(uploadedPhotos, ownerId, listingId);
      uploadedStoragePaths = uploadedPhotoResult.storagePaths;
      const uploadedPhotoUrls = uploadedPhotos.map((photo) => uploadedPhotoResult.urlsByUri.get(photo) || photo);
      const coverImage = uploadedPhotoUrls[0] || listingForm.image.trim() || fallbackImage;
      const photos = [coverImage, ...uploadedPhotoUrls.slice(1), ...galleryPhotos, fallbackImage].filter(
        (photo, index, allPhotos) => allPhotos.indexOf(photo) === index
      );

      const newListing: Listing = {
        id: listingId,
        kind: listingForm.kind,
        title,
        location,
        price,
        meta: derivedSummary,
        host,
        image: coverImage,
        photos,
        storagePaths: uploadedPhotoResult.storagePaths,
        tag: listingForm.kind === 'rentals' ? 'New rental' : listingForm.kind === 'sales' ? 'New sale' : 'New stand',
        description: listingForm.description.trim() || `${title} is listed by ${host}. Contact the landlord to confirm viewing times, documents, and availability.`,
        amenities: listingAmenities.length > 0 ? listingAmenities : ['Direct landlord contact', 'Viewing available', 'Saved listing', 'Verified details pending'],
        details: details.length > 0 ? details : [location, price, host],
        propertyType: listingForm.propertyType.trim(),
        spaceType: listingForm.spaceType.trim(),
        streetAddress,
        area,
        city,
        mapPin,
        features: listingForm.features,
        rules: houseRules,
        standSize: listingForm.standSize.trim(),
        standServicing: listingForm.standServicing.trim(),
        standTitle: listingForm.standTitle.trim(),
        standRoadAccess: listingForm.standRoadAccess.trim(),
        standZoning: listingForm.standZoning.trim(),
        ownerId,
        ownerName: currentLandlordProfile.displayName,
        createdAt,
        updatedAt: createdAt,
        sortOrder: createdAt
      };

      const completeSave = beginFirebaseSave();
      try {
        await setDoc(doc(db, 'homeswipeListings', newListing.id), newListing);
        completeSave('Synced');
      } catch (error) {
        completeSave('Offline');
        throw error;
      }

      setLandlordListings((currentListings) => uniqueListings([newListing, ...currentListings]));
      setOptimisticListings((currentListings) => uniqueListings([newListing, ...currentListings]));
      setAvailableListings((currentListings) => uniqueListings([newListing, ...currentListings]));
      setActiveKind(newListing.kind);
      setActiveTab('home');
      setQuery('');
      setHomeFilters(emptyHomeFilters);
      setListingForm(emptyListingForm);
      setListingStep(0);
      setShowListingForm(false);
    } catch (error) {
      await deleteListingStoragePaths(uploadedStoragePaths);
      setFirebaseStatus('Offline');
      setListingPublishError(error instanceof Error ? error.message : 'Could not upload photos or publish this listing.');
    } finally {
      setIsPublishingListing(false);
    }
  };

  const updateListing = (updatedListing: Listing) => {
    if (!requireAuth('Sign in to edit and manage your published listings.')) {
      return;
    }

    const storedListing: Listing = {
      ...updatedListing,
      ownerId: updatedListing.ownerId || currentLandlordProfile.id,
      ownerName: updatedListing.ownerName || currentLandlordProfile.displayName,
      updatedAt: Date.now()
    };

    setLandlordListings((currentListings) => uniqueListings(currentListings.map((listing) => (listing.id === storedListing.id ? storedListing : listing))));
    setOptimisticListings((currentListings) => uniqueListings(currentListings.map((listing) => (listing.id === storedListing.id ? storedListing : listing))));
    setAvailableListings((currentListings) => uniqueListings(currentListings.map((listing) => (listing.id === storedListing.id ? storedListing : listing))));
    setSelectedListing((currentListing) => (currentListing?.id === storedListing.id ? storedListing : currentListing));

    if (db) {
      const completeSave = beginFirebaseSave();
      setDoc(doc(db, 'homeswipeListings', storedListing.id), storedListing, { merge: true })
        .then(() => completeSave('Synced'))
        .catch(() => completeSave('Offline'));
    }
  };

  const deleteListing = (listingId: string) => {
    if (!requireAuth('Sign in to delete listings from your landlord dashboard.')) {
      return;
    }

    const knownListings = uniqueListings([...availableListings, ...optimisticListings, ...landlordListings]);
    const listingToDelete = knownListings.find((listing) => listing.id === listingId);

    setLandlordListings((currentListings) => currentListings.filter((listing) => listing.id !== listingId));
    setOptimisticListings((currentListings) => currentListings.filter((listing) => listing.id !== listingId));
    setAvailableListings((currentListings) => currentListings.filter((listing) => listing.id !== listingId));
    setSavedListingIds((currentIds) => currentIds.filter((id) => id !== listingId));
    setSelectedListing((currentListing) => (currentListing?.id === listingId ? null : currentListing));

    if (db) {
      const completeSave = beginFirebaseSave();
      deleteDoc(doc(db, 'homeswipeListings', listingId))
        .then(() => deleteListingStoragePaths(listingToDelete?.storagePaths))
        .then(() => completeSave('Synced'))
        .catch(() => completeSave('Offline'));
    }
  };

  const openAddListingForm = () => {
    if (!requireAuth('Sign up to add a home, stand, or rental listing.')) {
      return;
    }

    setSelectedListing(null);
    setShowHomeFilters(false);
    setListingStep(0);
    setShowListingForm(true);
    setActiveTab('home');
  };

  const pickListingImages = async () => {
    if (Platform.OS !== 'web') {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 8
      });

      if (result.didCancel || !result.assets?.length) {
        return;
      }

      const pickedPhotos = result.assets.map((asset) => asset.uri).filter((uri): uri is string => Boolean(uri));
      const compressedPhotos = await Promise.all(pickedPhotos.map(compressImageUri));

      setListingForm((current) => ({
        ...current,
        image: current.image || compressedPhotos[0] || '',
        localPhotos: [...current.localPhotos, ...compressedPhotos]
      }));
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 0.9
    });

    if (result.canceled) {
      return;
    }

    const pickedPhotos = result.assets.map((asset) => asset.uri);
    const compressedPhotos = await Promise.all(pickedPhotos.map(compressImageUri));
    setListingForm((current) => ({
      ...current,
      image: current.image || compressedPhotos[0] || '',
      localPhotos: [...current.localPhotos, ...compressedPhotos]
    }));
  };

  const addDroppedListingImages = async (uris: string[]) => {
    if (uris.length === 0) {
      return;
    }

    const compressedPhotos = await Promise.all(uris.map(compressImageUri));
    setListingForm((current) => ({
      ...current,
      image: current.image || compressedPhotos[0],
      localPhotos: [...current.localPhotos, ...compressedPhotos]
    }));
  };

  const openListingConversation = (listing: Listing, openingMessage?: string) => {
    if (!requireAuth('Sign up to start a chat with the landlord or agent.')) {
      return;
    }

    const conversationId = listing.host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || listing.id;

    setConversations((currentConversations) => {
      const existingConversation = currentConversations.find((conversation) => conversation.id === conversationId);
      if (existingConversation) {
        const nextConversations = currentConversations.map((conversation) =>
          conversation.id === conversationId && openingMessage
            ? { ...conversation, time: 'Now', messages: [...conversation.messages, openingMessage] }
            : conversation
        );
        saveConversationsToFirebase(nextConversations);
        return nextConversations;
      }

      const nextConversations = [
        {
          id: conversationId,
          person: listing.host,
          role: listing.kind === 'sales' || listing.kind === 'stands' ? 'Agent' : 'Landlord',
          listingTitle: listing.title,
          profile: {
            name: listing.host,
            role: listing.kind === 'sales' || listing.kind === 'stands' ? 'Agent' : 'Landlord',
            verification: listing.tag === 'Verified landlord' ? 'Verified' : 'Listed on HomeSwipe',
            location: listing.location,
            primaryLocation: listing.location,
            propertyCount: '1+',
            listerType: listing.kind === 'sales' || listing.kind === 'stands' ? 'Real Estate Agent' : 'Landlord / Property Owner'
          },
          time: 'Now',
          messages: [openingMessage || `Hi, I am interested in ${listing.title}. Is it still available?`]
        },
        ...currentConversations
      ];
      saveConversationsToFirebase(nextConversations);
      return nextConversations;
    });

    setActiveConversationId(conversationId);
    setActiveTab('messages');
  };

  const requestViewing = (listing: Listing, date: string, time: string) => {
    openListingConversation(listing, `Viewing request for ${listing.title}: ${date} at ${time}.`);
  };

  const toggleSavedListing = (listingId: string) => {
    if (!requireAuth('Sign up to save homes and keep them in your profile.')) {
      return;
    }

    setSavedListingIds((currentIds) =>
      currentIds.includes(listingId) ? currentIds.filter((id) => id !== listingId) : [...currentIds, listingId]
    );
  };

  const shareListing = async (listing: Listing) => {
    const listingLink = getListingLink(listing);
    const message = `${listing.title} in ${listing.location} for ${listing.price}. Contact ${listing.host} on HomeSwipe.\n${listingLink}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(listingLink).catch(() => undefined);
    }

    await Share.share({
      title: listing.title,
      message,
      url: listingLink
    });
  };

  const submitListingToolApplication = (label: string, payload: ReportPayload) => {
    if (!requireAuth('Sign in to apply and track your HomeSwipe application review.')) {
      return;
    }

    const summary = Object.entries(payload.results)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');
    const application: RentalApplication = {
      id: `listing-tool-${Date.now()}`,
      listingId: `tool-${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      property: label,
      landlord: 'HomeSwipe Finance',
      status: 'In Review',
      submitted: new Date().toLocaleDateString(),
      nextStep: `${summary}. Sent for HomeSwipe review at homeswipelistings@gmail.com.`
    };
    setApplications((currentApplications) => [application, ...currentApplications]);
    setActiveTab('profile');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const body = [
        `Application: ${label}`,
        `User: ${currentLandlordProfile.displayName}`,
        currentLandlordProfile.email ? `Email: ${currentLandlordProfile.email}` : '',
        '',
        'Inputs',
        ...Object.entries(payload.inputs).map(([key, value]) => `${key}: ${value}`),
        '',
        'Results',
        ...Object.entries(payload.results).map(([key, value]) => `${key}: ${value}`),
        '',
        `Application ID: ${application.id}`
      ].filter(Boolean).join('\n');
      window.location.href = `mailto:homeswipelistings@gmail.com?subject=${encodeURIComponent(`HomeSwipe ${label}`)}&body=${encodeURIComponent(body)}`;
    }
  };

  const sendMessage = (conversationId: string, message: string) => {
    if (!requireAuth('Sign in to reply to your HomeSwipe messages.')) {
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setConversations((currentConversations) => {
      const nextConversations = currentConversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, time: 'Now', messages: [...conversation.messages, trimmedMessage] }
          : conversation
      );
      saveConversationsToFirebase(nextConversations);
      return nextConversations;
    });
  };

  const openListingFromProfile = (listing: Listing) => {
    setSelectedListing(listing);
    setActiveKind(listing.kind);
    setActiveTab('home');
  };

  const closeAuthPrompt = () => setAuthPrompt(null);

  const signOutCurrentUser = () => {
    if (!auth) {
      return;
    }

    signOut(auth).catch(() => setFirebaseStatus('Offline'));
  };

  const appContent = (
    <>
      <View style={styles.appShell}>
        {activeTab === 'home' && (
          <HomeScreen
            activeKind={activeKind}
            activeHomeFilterCount={activeHomeFilterCount}
            availableListings={availableListings}
            filteredListings={filteredListings}
            hasMoreListings={hasMoreListings}
            homeFilters={homeFilters}
            isLoadingListings={isLoadingListings}
            isPublishingListing={isPublishingListing}
            query={query}
            listingForm={listingForm}
            listingPublishError={listingPublishError}
            showListingForm={showListingForm}
            showHomeFilters={showHomeFilters}
            addListing={addListing}
            listingStep={listingStep}
            selectedListing={selectedListing}
            savedListingIds={savedListingIds}
            currentUserEmail={currentLandlordProfile.email || ''}
            currentUserName={currentLandlordProfile.displayName}
            monthlyIncomeEstimate={getEstimatedMonthlyIncomeFromBudget(tenantOnboarding.budget)}
            onboardingRole={onboardingRole}
            onMessageListing={openListingConversation}
            onPickListingImages={pickListingImages}
            onRequestViewing={requestViewing}
            onDropListingImages={addDroppedListingImages}
            onLoadMoreListings={() => loadListingsPage('more')}
            onRequireAuth={requireAuth}
            onShareListing={shareListing}
            onToggleSavedListing={toggleSavedListing}
            onSubmitListingToolApplication={submitListingToolApplication}
            setActiveKind={setActiveKind}
            setHomeFilters={setHomeFilters}
            setListingForm={setListingForm}
            setListingStep={setListingStep}
            setListingPublishError={setListingPublishError}
            setQuery={setQuery}
            setSelectedListing={setSelectedListing}
            setShowHomeFilters={setShowHomeFilters}
            setShowListingForm={setShowListingForm}
          />
        )}
        {activeTab === 'tools' && (
          <ToolsScreen
            currentUserEmail={currentLandlordProfile.email || ''}
            currentUserName={currentLandlordProfile.displayName}
            leases={leases}
            onRequireAuth={requireAuth}
            savedReports={savedToolReports}
            setActiveTab={setActiveTab}
            setApplications={setApplications}
            setSavedReports={setSavedToolReports}
            setLeases={setLeases}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesScreen
            activeConversationId={activeConversationId}
            conversations={conversations}
            onGoHome={() => setActiveTab('home')}
            onSendMessage={sendMessage}
            setActiveConversationId={setActiveConversationId}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            applications={applications}
            listings={availableListings}
            landlordListings={landlordListings}
            currentUserEmail={currentLandlordProfile.email || ''}
            currentUserName={currentLandlordProfile.displayName}
            accountProfile={accountProfile}
            documents={verificationDocuments}
            listerOnboarding={listerOnboarding}
            isSignedIn={isSignedIn}
            onboardingRole={onboardingRole}
            savedToolReports={savedToolReports}
            savedListings={savedListings}
            signUpMethod={signUpMethod}
            tenantOnboarding={tenantOnboarding}
            verificationRole={verificationRole}
            onMessageListing={openListingConversation}
            onAddListing={openAddListingForm}
            onOpenListing={openListingFromProfile}
            onToggleSavedListing={toggleSavedListing}
            onDeleteListing={deleteListing}
            onSubmitListingToolApplication={submitListingToolApplication}
            onRequireAuth={requireAuth}
            onSetVerificationRole={setVerificationRole}
            onUploadVerificationDocument={uploadVerificationDocument}
            onSignOut={signOutCurrentUser}
            onUpdateAccountProfile={saveAccountProfile}
            onUpdateListing={updateListing}
          />
        )}
      </View>
      {authPrompt && (
        <AuthModal
          reason={authPrompt.reason}
          onClose={closeAuthPrompt}
          onAuthed={closeAuthPrompt}
          onNewAccountCreated={() => {
            setDidCompleteOnboarding(false);
            setOnboardingStep(0);
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.localStorage.removeItem('homeswipe.web.onboarding.complete');
            }
          }}
          onProfileUpdated={applySignedInProfile}
        />
      )}
      <View style={styles.bottomTabs}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={tab.key}
              onPress={() => {
                if (tab.key !== 'home' && !requireAuth(`Sign up to use ${tab.label.toLowerCase()} and keep your HomeSwipe activity synced.`)) {
                  return;
                }

                setActiveTab(tab.key);
              }}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
            >
              <Ionicons name={tab.icon} size={22} color={selected ? '#0f766e' : '#64748b'} />
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {!didCompleteOnboarding ? (
        <OnboardingScreen
          accountProfile={accountProfile}
          listerOnboarding={listerOnboarding}
          onboardingFinalStep={onboardingFinalStep}
          onboardingRole={onboardingRole}
          onboardingStep={onboardingStep}
          signUpMethod={signUpMethod}
          tenantOnboarding={tenantOnboarding}
          verificationDocuments={verificationDocuments}
          verificationRoleLabel={verificationRoleLabel}
          isListerOnboardingComplete={isListerOnboardingComplete}
          onAdvance={advanceOnboarding}
          onContinueSignup={continueFromOnboardingSignup}
          onFinish={finishOnboarding}
          onRequestPasswordReset={requestOnboardingPasswordReset}
          onSetAccountProfile={setAccountProfile}
          onSetListerOnboarding={setListerOnboarding}
          onSetOnboardingRole={(role) => {
            setOnboardingRole(role);
            setVerificationRole(role === 'tenant' ? 'Tenant' : listerOnboarding.listerType || 'Landlord / Property Owner');
          }}
          onSetSignUpMethod={setSignUpMethod}
          onSetTenantOnboarding={setTenantOnboarding}
          onSkipVerification={skipOnboardingVerification}
          onUploadVerificationDocument={uploadVerificationDocument}
        />
      ) : appContent}
    </SafeAreaView>
  );
}

function OnboardingScreen({
  accountProfile,
  isListerOnboardingComplete,
  listerOnboarding,
  onboardingFinalStep,
  onboardingRole,
  onboardingStep,
  signUpMethod,
  tenantOnboarding,
  verificationDocuments,
  verificationRoleLabel,
  onAdvance,
  onContinueSignup,
  onFinish,
  onRequestPasswordReset,
  onSetAccountProfile,
  onSetListerOnboarding,
  onSetOnboardingRole,
  onSetSignUpMethod,
  onSetTenantOnboarding,
  onSkipVerification,
  onUploadVerificationDocument
}: {
  accountProfile: AccountProfileInput;
  isListerOnboardingComplete: boolean;
  listerOnboarding: ListerOnboardingInput;
  onboardingFinalStep: number;
  onboardingRole: OnboardingRole | null;
  onboardingStep: number;
  signUpMethod: string;
  tenantOnboarding: TenantOnboardingInput;
  verificationDocuments: VerificationDocument[];
  verificationRoleLabel: string;
  onAdvance: () => void;
  onContinueSignup: () => void;
  onFinish: () => void;
  onRequestPasswordReset: () => void;
  onSetAccountProfile: React.Dispatch<React.SetStateAction<AccountProfileInput>>;
  onSetListerOnboarding: React.Dispatch<React.SetStateAction<ListerOnboardingInput>>;
  onSetOnboardingRole: (role: OnboardingRole) => void;
  onSetSignUpMethod: (method: string) => void;
  onSetTenantOnboarding: React.Dispatch<React.SetStateAction<TenantOnboardingInput>>;
  onSkipVerification: () => void;
  onUploadVerificationDocument: (id: string) => void;
}) {
  const isTenantBasicsComplete = Boolean(tenantOnboarding.city && tenantOnboarding.budget && tenantOnboarding.propertyTypes.length > 0);
  const hasUploadedAllVerificationDocuments = verificationDocuments.every((document) => document.status === 'Verified');
  const toggleTenantArray = (key: keyof Pick<TenantOnboardingInput, 'propertyTypes' | 'amenities' | 'householdTypes' | 'leasePreferences'>, value: string) => {
    onSetTenantOnboarding((current) => {
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
      };
    });
  };

  const renderChoice = (title: string, selected: boolean, onPress: () => void) => (
    <Pressable key={title} style={[styles.onboardingChoice, selected && styles.onboardingChoiceSelected]} onPress={onPress}>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selected ? '#ffffff' : '#0f766e'} />
      <Text style={[styles.onboardingChoiceText, selected && styles.onboardingChoiceTextSelected]}>{title}</Text>
    </Pressable>
  );

  const renderSingleChoice = (title: string, options: string[], selected: string, onSelect: (value: string) => void) => (
    <View style={styles.onboardingCard}>
      <Text style={styles.formTitle}>{title}</Text>
      <View style={styles.onboardingChoiceGrid}>{options.map((option) => renderChoice(option, selected === option, () => onSelect(option)))}</View>
    </View>
  );

  const renderMultiChoice = (title: string, options: string[], selected: string[], onToggle: (value: string) => void) => (
    <View style={styles.onboardingCard}>
      <Text style={styles.formTitle}>{title}</Text>
      <View style={styles.onboardingChoiceGrid}>{options.map((option) => renderChoice(option, selected.includes(option), () => onToggle(option)))}</View>
    </View>
  );

  const renderVerificationStep = (title: string, subtitle: string) => (
    <>
      <View>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.onboardingCard}>
        {[
          `Only required documents for ${verificationRoleLabel}`,
          'Verification is optional during onboarding',
          'Finish or update uploads from Profile'
        ].map((item) => (
          <View key={item} style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={18} color="#0f766e" />
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={styles.onboardingCard}>
        <Text style={styles.formTitle}>Required uploads</Text>
        {verificationDocuments.map((document) => (
          <View key={document.id} style={styles.onboardingDocumentRow}>
            <Ionicons name={document.status === 'Verified' ? 'shield-checkmark-outline' : 'document-attach-outline'} size={20} color="#0f766e" />
            <View style={styles.messageCopy}>
              <Text style={styles.messageName}>{document.title}</Text>
              <Text style={styles.messageText}>{document.standard}</Text>
              {document.fileName && <Text style={styles.documentStatus}>Uploaded: {document.fileName}</Text>}
            </View>
            {document.status === 'Verified' ? (
              <Text style={[styles.riskBadge, styles.riskBadgeVerified]}>Uploaded</Text>
            ) : (
              <Pressable style={styles.secondaryButton} onPress={() => onUploadVerificationDocument(document.id)}>
                <Ionicons name="cloud-upload-outline" size={16} color="#0f766e" />
                <Text style={styles.secondaryButtonText}>Upload</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <View style={styles.formNavRow}>
        <Pressable style={styles.primaryButton} onPress={onAdvance}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>{hasUploadedAllVerificationDocuments ? 'Continue Verified' : 'Finish Without Verification'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onSkipVerification}>
          <Text style={styles.secondaryButtonText}>Open Verification Later In Profile</Text>
        </Pressable>
      </View>
    </>
  );

  const isEmailSignupComplete = Boolean(accountProfile.fullName.trim() && accountProfile.email.includes('@') && accountProfile.password.length >= 6);
  const renderContinue = (enabled: boolean, onPress: () => void = onAdvance, title = 'Continue') => (
    <Pressable style={[styles.primaryButton, !enabled && styles.disabledButton]} disabled={!enabled} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
  const renderAccountField = (label: string, value: string, onChangeText: (value: string) => void, secureTextEntry = false) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        autoCapitalize={label === 'Email' ? 'none' : 'words'}
        keyboardType={label === 'Email' ? 'email-address' : 'default'}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        secureTextEntry={secureTextEntry}
        style={styles.formInput}
        value={value}
      />
    </View>
  );
  const renderSignupButton = (method: string, icon: keyof typeof Ionicons.glyphMap, label: string) => (
    <Pressable key={method} style={[styles.onboardingActionButton, signUpMethod === method && styles.onboardingActionButtonSelected]} onPress={() => onSetSignUpMethod(method)}>
      <Ionicons name={icon} size={22} color={signUpMethod === method ? '#ffffff' : '#0f172a'} />
      <Text style={[styles.onboardingActionText, signUpMethod === method && styles.onboardingActionTextSelected]}>{label}</Text>
    </Pressable>
  );

  let wizardContent: React.ReactNode;
  if (onboardingStep === 0) {
    wizardContent = (
      <>
        <WelcomeHero />
        <View style={styles.onboardingCard}>
          {renderSignupButton('Google', 'logo-google', 'Sign up with Google')}
          {renderSignupButton('Apple', 'logo-apple', 'Sign up with Apple')}
          {renderSignupButton('Email', 'mail-outline', 'Sign up with Email')}
        </View>
        {signUpMethod === 'Email' && (
          <View style={styles.onboardingCard}>
            {renderAccountField('Full name', accountProfile.fullName, (fullName) => onSetAccountProfile((current) => ({ ...current, fullName })))}
            {renderAccountField('Email', accountProfile.email, (email) => onSetAccountProfile((current) => ({ ...current, email })))}
            {renderAccountField('Password', accountProfile.password, (password) => onSetAccountProfile((current) => ({ ...current, password })), true)}
            <Pressable style={styles.secondaryButton} onPress={onRequestPasswordReset}>
              <Text style={styles.secondaryButtonText}>Forgot password?</Text>
            </Pressable>
            {accountProfile.forgotPasswordMessage ? <Text style={styles.panelHint}>{accountProfile.forgotPasswordMessage}</Text> : null}
          </View>
        )}
        {renderContinue(signUpMethod !== 'Email' || isEmailSignupComplete, onContinueSignup)}
      </>
    );
  } else if (onboardingStep === 1) {
    wizardContent = (
      <>
        <View>
          <Text style={styles.pageTitle}>How will you use HomeSwipe?</Text>
          <Text style={styles.subtitle}>Choose one role so we only ask for relevant details.</Text>
        </View>
        <View style={styles.onboardingCard}>
          {renderChoice('Looking for a Home', onboardingRole === 'tenant', () => onSetOnboardingRole('tenant'))}
          {renderChoice('Listing Property', onboardingRole === 'lister', () => onSetOnboardingRole('lister'))}
        </View>
        {renderContinue(Boolean(onboardingRole))}
      </>
    );
  } else if (onboardingRole === 'tenant') {
    if (onboardingStep === 2) {
      wizardContent = <>{renderSingleChoice('Which city are you searching in?', onboardingCities, tenantOnboarding.city, (city) => onSetTenantOnboarding((current) => ({ ...current, city })))}{renderContinue(Boolean(tenantOnboarding.city))}</>;
    } else if (onboardingStep === 3) {
      wizardContent = <>{renderSingleChoice('Monthly Budget', onboardingBudgets, tenantOnboarding.budget, (budget) => onSetTenantOnboarding((current) => ({ ...current, budget })))}{renderContinue(Boolean(tenantOnboarding.budget))}</>;
    } else if (onboardingStep === 4) {
      wizardContent = <>{renderMultiChoice('Property Types', onboardingPropertyTypes, tenantOnboarding.propertyTypes, (value) => toggleTenantArray('propertyTypes', value))}{renderContinue(tenantOnboarding.propertyTypes.length > 0)}</>;
    } else if (onboardingStep === 5) {
      wizardContent = <>{renderMultiChoice('Amenities', onboardingAmenities, tenantOnboarding.amenities, (value) => toggleTenantArray('amenities', value))}{renderContinue(true)}</>;
    } else if (onboardingStep === 6) {
      wizardContent = <>{renderSingleChoice('Employment Status', onboardingEmploymentStatuses, tenantOnboarding.employmentStatus, (employmentStatus) => onSetTenantOnboarding((current) => ({ ...current, employmentStatus })))}{renderContinue(Boolean(tenantOnboarding.employmentStatus))}</>;
    } else if (onboardingStep === 7) {
      wizardContent = <>{renderMultiChoice('Household Type', onboardingHouseholdTypes, tenantOnboarding.householdTypes, (value) => toggleTenantArray('householdTypes', value))}{renderContinue(tenantOnboarding.householdTypes.length > 0)}</>;
    } else if (onboardingStep === 8) {
      wizardContent = <>{renderMultiChoice('Lease Preference', onboardingLeasePreferences, tenantOnboarding.leasePreferences, (value) => toggleTenantArray('leasePreferences', value))}{renderContinue(tenantOnboarding.leasePreferences.length > 0)}</>;
    } else if (onboardingStep === 9) {
      wizardContent = renderVerificationStep('Verification Optional', 'Upload tenant documents now or finish them later from your Profile tab.');
    } else {
      wizardContent = (
        <View style={styles.onboardingReady}>
          <Ionicons name="checkmark-circle" size={58} color="#0f766e" />
          <Text style={styles.pageTitle}>You're All Set</Text>
          <Text style={styles.subtitle}>Start discovering homes that match your preferences.</Text>
          <Pressable style={styles.primaryButton} onPress={onFinish}><Text style={styles.primaryButtonText}>Start Browsing</Text></Pressable>
        </View>
      );
    }
  } else if (onboardingStep === 2) {
    wizardContent = <>{renderSingleChoice('I am a:', listerVerificationRoles, listerOnboarding.listerType, (listerType) => onSetListerOnboarding((current) => ({ ...current, listerType: listerType as VerificationRole })))}{renderContinue(Boolean(listerOnboarding.listerType))}</>;
  } else if (onboardingStep === 3) {
    wizardContent = <>{renderSingleChoice('Primary Location', onboardingCities, listerOnboarding.primaryLocation, (primaryLocation) => onSetListerOnboarding((current) => ({ ...current, primaryLocation })))}{renderContinue(Boolean(listerOnboarding.primaryLocation))}</>;
  } else if (onboardingStep === 4) {
    wizardContent = <>{renderSingleChoice('Number of Properties', onboardingPropertyCounts, listerOnboarding.propertyCount, (propertyCount) => onSetListerOnboarding((current) => ({ ...current, propertyCount })))}{renderContinue(Boolean(listerOnboarding.propertyCount))}</>;
  } else if (onboardingStep === 5) {
    wizardContent = renderVerificationStep('Verification Optional', `Upload only the documents required for ${verificationRoleLabel}, or finish later from Profile.`);
  } else {
    wizardContent = (
      <View style={styles.onboardingReady}>
        <Ionicons name="checkmark-circle" size={58} color="#0f766e" />
        <Text style={styles.pageTitle}>You're All Set</Text>
        <Text style={styles.subtitle}>Start managing listings, messages, and verification from your dashboard.</Text>
        <Pressable style={styles.primaryButton} onPress={onFinish}><Text style={styles.primaryButtonText}>Go to Dashboard</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
      <View style={styles.onboardingProgress}>
        {Array.from({ length: onboardingFinalStep + 1 }).map((_, step) => (
          <View key={step} style={[styles.onboardingProgressBar, step <= onboardingStep && styles.onboardingProgressBarActive]} />
        ))}
      </View>
      {wizardContent}
    </ScrollView>
  );

  let content: React.ReactNode;

  if (onboardingStep === 0) {
    content = (
      <>
        <View>
          <Text style={styles.pageTitle}>Welcome to HomeSwipe</Text>
          <Text style={styles.subtitle}>Find homes or list properties with confidence.</Text>
        </View>
        <View style={styles.onboardingCard}>
          {['Google', 'Apple', 'Email'].map((method) => (
            <Pressable key={method} style={[styles.onboardingActionButton, signUpMethod === method && styles.onboardingActionButtonSelected]} onPress={() => onSetSignUpMethod(method)}>
              <Ionicons name={method === 'Google' ? 'logo-google' : method === 'Apple' ? 'logo-apple' : 'mail-outline'} size={18} color={signUpMethod === method ? '#ffffff' : '#0f766e'} />
              <Text style={[styles.onboardingActionText, signUpMethod === method && styles.onboardingActionTextSelected]}>Continue with {method}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.onboardingCard}>
          <Text style={styles.formTitle}>How will you use HomeSwipe?</Text>
          {renderChoice('Looking for a Home', onboardingRole === 'tenant', () => onSetOnboardingRole('tenant'))}
          {renderChoice('Listing Property', onboardingRole === 'lister', () => onSetOnboardingRole('lister'))}
        </View>
        <Pressable style={[styles.primaryButton, !onboardingRole && styles.disabledButton]} disabled={!onboardingRole} onPress={onAdvance}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </>
    );
  } else if (onboardingRole === 'tenant') {
    if (onboardingStep === 1) {
      content = (
        <>
          <View>
            <Text style={styles.pageTitle}>What are you looking for?</Text>
            <Text style={styles.subtitle}>Set your search basics so HomeSwipe can prioritize better matches.</Text>
          </View>
          {renderSingleChoice('Which city are you searching in?', onboardingCities, tenantOnboarding.city, (city) => onSetTenantOnboarding((current) => ({ ...current, city })))}
          {renderSingleChoice('Monthly Budget', onboardingBudgets, tenantOnboarding.budget, (budget) => onSetTenantOnboarding((current) => ({ ...current, budget })))}
          {renderMultiChoice('Property Types', onboardingPropertyTypes, tenantOnboarding.propertyTypes, (value) => toggleTenantArray('propertyTypes', value))}
          {renderMultiChoice('Amenities', onboardingAmenities, tenantOnboarding.amenities, (value) => toggleTenantArray('amenities', value))}
          <Pressable style={[styles.primaryButton, !isTenantBasicsComplete && styles.disabledButton]} disabled={!isTenantBasicsComplete} onPress={onAdvance}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </>
      );
    } else if (onboardingStep === 2) {
      content = (
        <>
          <View>
            <Text style={styles.pageTitle}>Tell Landlords More About You</Text>
            <Text style={styles.subtitle}>A stronger profile helps landlords understand fit before they reply.</Text>
          </View>
          {renderSingleChoice('Employment Status', onboardingEmploymentStatuses, tenantOnboarding.employmentStatus, (employmentStatus) => onSetTenantOnboarding((current) => ({ ...current, employmentStatus })))}
          {renderMultiChoice('Household Type', onboardingHouseholdTypes, tenantOnboarding.householdTypes, (value) => toggleTenantArray('householdTypes', value))}
          {renderMultiChoice('Lease Preference', onboardingLeasePreferences, tenantOnboarding.leasePreferences, (value) => toggleTenantArray('leasePreferences', value))}
          <Pressable style={[styles.primaryButton, !tenantOnboarding.employmentStatus && styles.disabledButton]} disabled={!tenantOnboarding.employmentStatus} onPress={onAdvance}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </>
      );
    } else if (onboardingStep === 3) {
      content = renderVerificationStep('Get Verified', 'Upload the required tenant documents to unlock your verified profile badge.');
    } else {
      content = (
        <View style={styles.onboardingReady}>
          <Ionicons name="checkmark-circle" size={58} color="#0f766e" />
          <Text style={styles.pageTitle}>You're All Set</Text>
          <Text style={styles.subtitle}>Start discovering homes that match your preferences.</Text>
          <Pressable style={styles.primaryButton} onPress={onFinish}>
            <Text style={styles.primaryButtonText}>Start Browsing</Text>
          </Pressable>
        </View>
      );
    }
  } else if (onboardingStep === 1) {
    content = (
      <>
        <View>
          <Text style={styles.pageTitle}>Tell Us About Your Properties</Text>
          <Text style={styles.subtitle}>Set up your lister profile before publishing your first home.</Text>
        </View>
        {renderSingleChoice('I am a:', listerVerificationRoles, listerOnboarding.listerType, (listerType) => onSetListerOnboarding((current) => ({ ...current, listerType: listerType as VerificationRole })))}
        {renderSingleChoice('Primary Location', onboardingCities, listerOnboarding.primaryLocation, (primaryLocation) => onSetListerOnboarding((current) => ({ ...current, primaryLocation })))}
        {renderSingleChoice('Number of Properties', onboardingPropertyCounts, listerOnboarding.propertyCount, (propertyCount) => onSetListerOnboarding((current) => ({ ...current, propertyCount })))}
        <Pressable style={[styles.primaryButton, !isListerOnboardingComplete && styles.disabledButton]} disabled={!isListerOnboardingComplete} onPress={onAdvance}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </>
    );
  } else if (onboardingStep === 2) {
    content = (
      <>
        <View>
          <Text style={styles.pageTitle}>Create Your First Listing</Text>
          <Text style={styles.subtitle}>You can skip this step and add properties later from your dashboard.</Text>
        </View>
        <View style={styles.onboardingCard}>
          <Ionicons name="home-outline" size={30} color="#0f766e" />
          <Text style={styles.formTitle}>Listing tools are ready</Text>
          <Text style={styles.panelHint}>After onboarding, use Add home to publish rentals, homes for sale, or stands.</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={onAdvance}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </>
    );
  } else if (onboardingStep === 3) {
    content = renderVerificationStep(`Become a Verified ${verificationRoleLabel}`, `Upload only the documents required for ${verificationRoleLabel}.`);
  } else {
    content = (
      <View style={styles.onboardingReady}>
        <Ionicons name="checkmark-circle" size={58} color="#0f766e" />
        <Text style={styles.pageTitle}>You're All Set</Text>
        <Text style={styles.subtitle}>Start managing listings, messages, and verification from your dashboard.</Text>
        <Pressable style={styles.primaryButton} onPress={onFinish}>
          <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
      <View style={styles.onboardingProgress}>
        {[0, 1, 2, 3, 4].map((step) => (
          <View key={step} style={[styles.onboardingProgressBar, step <= onboardingStep && styles.onboardingProgressBarActive]} />
        ))}
      </View>
      {content}
    </ScrollView>
  );
}

function WelcomeHero() {
  return (
    <View style={styles.welcomeHero}>
      <Image source={welcomeHomeImage} style={styles.welcomeHeroImage} />
      <View style={styles.welcomeHeroOverlay} />
      <View style={styles.welcomeHeroCopy}>
        <View style={styles.welcomeBrandRow}>
          <Ionicons name="home" size={20} color="#ffffff" />
          <Text style={styles.welcomeBrandText}>HomeSwipe</Text>
        </View>
        <Text style={styles.welcomeHeroTitle}>Discover Your Dream Home</Text>
      </View>
    </View>
  );
}

function AuthModal({
  onAuthed,
  onClose,
  onNewAccountCreated,
  onProfileUpdated,
  reason
}: {
  onAuthed: () => void;
  onClose: () => void;
  onNewAccountCreated: () => void;
  onProfileUpdated: (user: User) => void;
  reason: string;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailActionLabel = authMode === 'signup' ? 'Create account' : 'Sign in';

  const submitEmailAuth = async () => {
    if (!auth) {
      setAuthError('Firebase is not configured yet. Add the web app config values before enabling signup.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6) {
      setAuthError('Enter an email and a password with at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setAuthError('');

    try {
      const credential =
        authMode === 'signup'
          ? await createUserWithEmailAndPassword(auth, trimmedEmail, password)
          : await signInWithEmailAndPassword(auth, trimmedEmail, password);

      if (authMode === 'signup' && displayName.trim()) {
        await updateProfile(credential.user, { displayName: displayName.trim() });
      }

      onProfileUpdated(credential.user);
      if (authMode === 'signup' || getAdditionalUserInfo(credential)?.isNewUser) {
        onNewAccountCreated();
      }
      onAuthed();
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Firebase:\s*/i, '') : 'Authentication failed.';
      setAuthError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitGoogleAuth = async () => {
    if (!auth) {
      setAuthError('Firebase is not configured yet. Add the web app config values before enabling Google signup.');
      return;
    }

    if (Platform.OS !== 'web') {
      setAuthError('Google signup is ready for the web app. Native Google login needs the iOS/Android provider setup.');
      return;
    }

    setIsSubmitting(true);
    setAuthError('');

    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      if (getAdditionalUserInfo(credential)?.isNewUser) {
        onNewAccountCreated();
      }
      onAuthed();
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Firebase:\s*/i, '') : 'Google signup failed.';
      setAuthError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.authOverlay}>
      <View style={styles.authPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderCopy}>
            <Text style={styles.formTitle}>Sign up to continue</Text>
            <Text style={styles.panelHint}>{reason}</Text>
          </View>
          <Pressable style={styles.iconButton} accessibilityLabel="Close signup" onPress={onClose}>
            <Ionicons name="close-outline" size={20} color="#0f172a" />
          </Pressable>
        </View>

        <View style={styles.authModeRow}>
          {(['signup', 'signin'] as AuthMode[]).map((mode) => {
            const selected = authMode === mode;
            return (
              <Pressable key={mode} style={[styles.authModeButton, selected && styles.authModeButtonActive]} onPress={() => setAuthMode(mode)}>
                <Text style={[styles.authModeText, selected && styles.authModeTextActive]}>{mode === 'signup' ? 'New account' : 'I have one'}</Text>
              </Pressable>
            );
          })}
        </View>

        {authMode === 'signup' && (
          <TextInput
            placeholder="Full name"
            placeholderTextColor="#94a3b8"
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.formInput}
          />
        )}
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          style={styles.formInput}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.formInput}
        />

        {authError ? (
          <View style={styles.publishError}>
            <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" />
            <Text style={styles.publishErrorText}>{authError}</Text>
          </View>
        ) : null}

        <Pressable style={[styles.primaryButton, isSubmitting && styles.disabledButton]} disabled={isSubmitting} onPress={submitEmailAuth}>
          <Ionicons name="mail-outline" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>{isSubmitting ? 'Working...' : emailActionLabel}</Text>
        </Pressable>
        <Pressable style={styles.googleButton} disabled={isSubmitting} onPress={submitGoogleAuth}>
          <Ionicons name="logo-google" size={18} color="#0f172a" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HomeScreen({
  activeKind,
  activeHomeFilterCount,
  availableListings,
  filteredListings,
  hasMoreListings,
  homeFilters,
  isLoadingListings,
  isPublishingListing,
  listingForm,
  listingPublishError,
  query,
  showHomeFilters,
  showListingForm,
  addListing,
  listingStep,
  selectedListing,
  currentUserEmail,
  currentUserName,
  monthlyIncomeEstimate,
  onboardingRole,
  savedListingIds,
  onMessageListing,
  onPickListingImages,
  onRequestViewing,
  onDropListingImages,
  onLoadMoreListings,
  onRequireAuth,
  onShareListing,
  onToggleSavedListing,
  onSubmitListingToolApplication,
  setActiveKind,
  setHomeFilters,
  setListingForm,
  setListingStep,
  setListingPublishError,
  setQuery,
  setSelectedListing,
  setShowHomeFilters,
  setShowListingForm
}: {
  activeKind: ListingKind;
  activeHomeFilterCount: number;
  availableListings: Listing[];
  filteredListings: Listing[];
  hasMoreListings: boolean;
  homeFilters: HomeFilters;
  isLoadingListings: boolean;
  isPublishingListing: boolean;
  listingForm: ListingForm;
  listingPublishError: string;
  query: string;
  showHomeFilters: boolean;
  showListingForm: boolean;
  addListing: () => void | Promise<void>;
  listingStep: number;
  selectedListing: Listing | null;
  currentUserEmail: string;
  currentUserName: string;
  monthlyIncomeEstimate: number;
  onboardingRole: OnboardingRole | null;
  savedListingIds: string[];
  onMessageListing: (listing: Listing) => void;
  onPickListingImages: () => void;
  onRequestViewing: (listing: Listing, date: string, time: string) => void;
  onDropListingImages: (uris: string[]) => void;
  onLoadMoreListings: () => void;
  onRequireAuth: (reason: string) => boolean;
  onShareListing: (listing: Listing) => void;
  onToggleSavedListing: (listingId: string) => void;
  onSubmitListingToolApplication: (label: string, payload: ReportPayload) => void;
  setActiveKind: (kind: ListingKind) => void;
  setHomeFilters: React.Dispatch<React.SetStateAction<HomeFilters>>;
  setListingForm: React.Dispatch<React.SetStateAction<ListingForm>>;
  setListingStep: (step: number) => void;
  setListingPublishError: (message: string) => void;
  setQuery: (value: string) => void;
  setSelectedListing: (listing: Listing | null) => void;
  setShowHomeFilters: (value: boolean) => void;
  setShowListingForm: (value: boolean) => void;
}) {
  if (selectedListing) {
    return (
      <ListingDetails
        listing={selectedListing}
        onBack={() => setSelectedListing(null)}
        isSaved={savedListingIds.includes(selectedListing.id)}
        onMessage={() => onMessageListing(selectedListing)}
        onRequestViewing={(date, time) => onRequestViewing(selectedListing, date, time)}
        onRequireAuth={onRequireAuth}
        onShare={() => onShareListing(selectedListing)}
        currentUserEmail={currentUserEmail}
        currentUserName={currentUserName}
        monthlyIncomeEstimate={monthlyIncomeEstimate}
        onboardingRole={onboardingRole}
        onSubmitListingToolApplication={onSubmitListingToolApplication}
        onToggleSaved={() => onToggleSavedListing(selectedListing.id)}
      />
    );
  }

  const loadMoreWhenNearBottom = ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    if (showListingForm) {
      return;
    }

    const distanceFromBottom = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
    if (distanceFromBottom < 240 && hasMoreListings && !isLoadingListings) {
      onLoadMoreListings();
    }
  };
  const listingSteps = listingForm.kind === 'stands' ? ['Basics', 'Photos', 'Price'] : ['Basics', 'Space', 'Photos', 'Price'];
  const activeListingStep = listingSteps[Math.min(listingStep, listingSteps.length - 1)];
  const derivedListingSummary = getListingFormSummary(listingForm);
  const trimmedQuery = query.trim();

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      onScroll={loadMoreWhenNearBottom}
      scrollEventThrottle={400}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>HomeSwipe</Text>
          <Text style={styles.subtitle}>Find rentals, homes, and stands without the runaround.</Text>
        </View>
        {onboardingRole !== 'tenant' && (
          <Pressable
            style={styles.addHomeButton}
            accessibilityLabel="Add a house listing"
            onPress={() => {
              if (!onRequireAuth('Sign up to add a home, stand, or rental listing.')) {
                return;
              }

              setListingPublishError('');
              setShowListingForm(!showListingForm);
            }}
          >
            <Ionicons name={showListingForm ? 'close-outline' : 'add-outline'} size={22} color="#ffffff" />
            <Text style={styles.addHomeText}>{showListingForm ? 'Close' : 'Add home'}</Text>
          </Pressable>
        )}
      </View>

      {showListingForm && (
        <View style={styles.listingFormScreen}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.formTitle}>Add your place</Text>
              <Text style={styles.panelHint}>Step {Math.min(listingStep + 1, listingSteps.length)} of {listingSteps.length}</Text>
            </View>
            <Ionicons name="home-outline" size={28} color="#0f766e" />
          </View>
          <View style={styles.stepRail}>
            {listingSteps.map((step, index) => (
              <Pressable key={step} style={[styles.stepPill, listingStep === index && styles.stepPillActive]} onPress={() => setListingStep(index)}>
                <Text style={[styles.stepText, listingStep === index && styles.stepTextActive]}>{step}</Text>
              </Pressable>
            ))}
          </View>
          {listingPublishError ? (
            <View style={styles.publishError}>
              <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" />
              <Text style={styles.publishErrorText}>{listingPublishError}</Text>
            </View>
          ) : null}

          {activeListingStep === 'Basics' && (
            <>
              <View style={styles.segmentedControl}>
                {listingFilters.map((filter) => {
                  const selected = listingForm.kind === filter.key;
                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => {
                        setListingPublishError('');
                        setListingForm((current) => ({ ...current, kind: filter.key }));
                        setListingStep(0);
                      }}
                      style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{filter.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.formGrid}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Property type</Text>
                <TextInput
                  placeholder={listingForm.kind === 'stands' ? 'Residential stand, commercial stand' : 'Apartment, house, cottage'}
                  placeholderTextColor="#94a3b8"
                  value={listingForm.propertyType}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, propertyType: value }))}
                  style={styles.formInput}
                />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Space type</Text>
                <TextInput
                  placeholder={listingForm.kind === 'stands' ? 'Serviced stand, infill stand, corner stand' : 'Entire place or room'}
                  placeholderTextColor="#94a3b8"
                  value={listingForm.spaceType}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, spaceType: value }))}
                  style={styles.formInput}
                />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Street address or stand number</Text>
                <TextInput
                  placeholder="Street address or stand number"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.location}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, location: value }))}
                  style={styles.formInput}
                />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Suburb or area</Text>
                <TextInput
                  placeholder="Suburb or area"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.area}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, area: value }))}
                  style={styles.formInput}
                />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>City or town</Text>
                <TextInput
                  placeholder="City or town"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.city}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, city: value }))}
                  style={styles.formInput}
                />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Map pin, Plus Code, or coordinates</Text>
                <TextInput
                  placeholder="Map pin, Plus Code, or coordinates"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.mapPin}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, mapPin: value }))}
                  style={styles.formInput}
                />
                </View>
                {listingForm.kind === 'stands' && (
                  <>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Stand size</Text>
                      <TextInput
                        placeholder="500 sqm, 1 acre, 2000 m2"
                        placeholderTextColor="#94a3b8"
                        value={listingForm.standSize}
                        onChangeText={(value) => setListingForm((current) => ({ ...current, standSize: value }))}
                        style={styles.formInput}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Servicing</Text>
                      <TextInput
                        placeholder="Serviced, partially serviced, unserviced"
                        placeholderTextColor="#94a3b8"
                        value={listingForm.standServicing}
                        onChangeText={(value) => setListingForm((current) => ({ ...current, standServicing: value }))}
                        style={styles.formInput}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Title or paperwork</Text>
                      <TextInput
                        placeholder="Title deed, cession, subdivision permit"
                        placeholderTextColor="#94a3b8"
                        value={listingForm.standTitle}
                        onChangeText={(value) => setListingForm((current) => ({ ...current, standTitle: value }))}
                        style={styles.formInput}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Road access</Text>
                      <TextInput
                        placeholder="Tarred road, gravel road, corner frontage"
                        placeholderTextColor="#94a3b8"
                        value={listingForm.standRoadAccess}
                        onChangeText={(value) => setListingForm((current) => ({ ...current, standRoadAccess: value }))}
                        style={styles.formInput}
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Zoning or use</Text>
                      <TextInput
                        placeholder="Residential, commercial, agro-residential"
                        placeholderTextColor="#94a3b8"
                        value={listingForm.standZoning}
                        onChangeText={(value) => setListingForm((current) => ({ ...current, standZoning: value }))}
                        style={styles.formInput}
                      />
                    </View>
                  </>
                )}
              </View>
            </>
          )}

          {activeListingStep === 'Space' && (
            <>
              <View style={styles.formGrid}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Guests</Text>
                  <TextInput placeholder="Guests" placeholderTextColor="#94a3b8" value={listingForm.guests} onChangeText={(value) => setListingForm((current) => ({ ...current, guests: value }))} style={styles.formInput} />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Bedrooms</Text>
                  <TextInput placeholder="Bedrooms" placeholderTextColor="#94a3b8" value={listingForm.bedrooms} onChangeText={(value) => setListingForm((current) => ({ ...current, bedrooms: value }))} style={styles.formInput} />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Bathrooms</Text>
                  <TextInput placeholder="Bathrooms" placeholderTextColor="#94a3b8" value={listingForm.bathrooms} onChangeText={(value) => setListingForm((current) => ({ ...current, bathrooms: value }))} style={styles.formInput} />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Other amenities</Text>
                  <TextInput placeholder="Garden, pool, staff quarters" placeholderTextColor="#94a3b8" value={listingForm.amenities} onChangeText={(value) => setListingForm((current) => ({ ...current, amenities: value }))} style={styles.formInput} />
                </View>
              </View>
              <View style={styles.featureGrid}>
                {listingFeatureOptions.map((feature) => {
                  const selected = listingForm.features.includes(feature);
                  return (
                    <Pressable
                      key={feature}
                      style={[styles.featureOption, selected && styles.featureOptionActive]}
                      onPress={() =>
                        setListingForm((current) => ({
                          ...current,
                          features: current.features.includes(feature)
                            ? current.features.filter((item) => item !== feature)
                            : [...current.features, feature]
                        }))
                      }
                    >
                      <Ionicons name={selected ? 'checkbox-outline' : 'square-outline'} size={20} color={selected ? '#ffffff' : '#0f766e'} />
                      <Text style={[styles.featureText, selected && styles.featureTextActive]}>{feature}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.ruleBuilder}>
                <View style={styles.formGrid}>
                  <TextInput
                    placeholder="Add one rule, e.g. No smoking"
                    placeholderTextColor="#94a3b8"
                    value={listingForm.houseRuleDraft}
                    onChangeText={(value) => setListingForm((current) => ({ ...current, houseRuleDraft: value }))}
                    style={styles.formInput}
                  />
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() =>
                      setListingForm((current) => {
                        const rule = current.houseRuleDraft.trim();
                        if (!rule) {
                          return current;
                        }

                        return {
                          ...current,
                          houseRuleDraft: '',
                          houseRules: current.houseRules.includes(rule) ? current.houseRules : [...current.houseRules, rule]
                        };
                      })
                    }
                  >
                    <Ionicons name="add-outline" size={18} color="#0f766e" />
                    <Text style={styles.secondaryButtonText}>Add rule</Text>
                  </Pressable>
                </View>
                {listingForm.houseRules.length > 0 && (
                  <View style={styles.ruleList}>
                    {listingForm.houseRules.map((rule) => (
                      <View key={rule} style={styles.ruleRow}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#0f766e" />
                        <Text style={styles.ruleText}>{rule}</Text>
                        <Pressable
                          accessibilityLabel="Remove rule"
                          onPress={() => setListingForm((current) => ({ ...current, houseRules: current.houseRules.filter((item) => item !== rule) }))}
                        >
                          <Ionicons name="close-circle-outline" size={22} color="#64748b" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          {activeListingStep === 'Photos' && (
            <>
              <View style={styles.formFieldFull}>
                <Text style={styles.formLabel}>Listing title</Text>
                <TextInput placeholder="Listing title" placeholderTextColor="#94a3b8" value={listingForm.title} onChangeText={(value) => setListingForm((current) => ({ ...current, title: value }))} style={styles.formInput} />
              </View>
              <ImageDropZone onDropImages={onDropListingImages} onPickImages={onPickListingImages} />
              {listingForm.localPhotos.length > 0 && (
                <View style={styles.uploadPreviewGrid}>
                  {listingForm.localPhotos.map((photo) => (
                    <View key={photo} style={styles.uploadPreviewItem}>
                      <CachedImage source={{ uri: photo }} style={styles.uploadPreviewImage} />
                      <Pressable
                        accessibilityLabel="Remove photo"
                        style={styles.removePhotoButton}
                        onPress={() =>
                          setListingForm((current) => ({
                            ...current,
                            image: current.image === photo ? current.localPhotos.find((item) => item !== photo) || '' : current.image,
                            localPhotos: current.localPhotos.filter((item) => item !== photo)
                          }))
                        }
                      >
                        <Ionicons name="close-outline" size={16} color="#ffffff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.formFieldFull}>
                <Text style={styles.formLabel}>Cover image URL</Text>
                <TextInput placeholder="Optional" placeholderTextColor="#94a3b8" value={listingForm.image} onChangeText={(value) => setListingForm((current) => ({ ...current, image: value }))} style={styles.formInput} />
              </View>
              <View style={styles.formFieldFull}>
                <Text style={styles.formLabel}>More photo URLs</Text>
                <TextInput placeholder="One per line" placeholderTextColor="#94a3b8" value={listingForm.photos} onChangeText={(value) => setListingForm((current) => ({ ...current, photos: value }))} style={[styles.formInput, styles.multilineInput]} multiline />
              </View>
              <View style={styles.formFieldFull}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput placeholder="Describe your place" placeholderTextColor="#94a3b8" value={listingForm.description} onChangeText={(value) => setListingForm((current) => ({ ...current, description: value }))} style={[styles.formInput, styles.multilineInput]} multiline />
              </View>
            </>
          )}

          {activeListingStep === 'Price' && (
            <>
              <View style={styles.formGrid}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Price</Text>
                <View style={styles.priceInputShell}>
                  <Text style={styles.pricePrefix}>$</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="850"
                    placeholderTextColor="#94a3b8"
                    value={listingForm.price}
                    onChangeText={(value) => setListingForm((current) => ({ ...current, price: value.replace(/[^0-9.]/g, '') }))}
                    style={styles.priceInput}
                  />
                </View>
                </View>
              </View>
              <View style={styles.generatedSummary}>
                <Text style={styles.formLabel}>Listing summary</Text>
                <Text style={styles.generatedSummaryText}>{derivedListingSummary}</Text>
              </View>
              <View style={styles.detailFactGrid}>
                {[listingForm.propertyType, listingForm.spaceType, [listingForm.location, listingForm.area, listingForm.city].filter(Boolean).join(', '), listingForm.price ? `$${listingForm.price}` : '', ...listingForm.features].filter(Boolean).map((detail) => (
                  <View key={detail} style={styles.detailFact}>
                    <Ionicons name="checkmark-circle-outline" size={19} color="#0f766e" />
                    <Text style={styles.detailFactText}>{detail}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.formNavRow}>
            <Pressable style={styles.secondaryButton} onPress={() => setListingStep(Math.max(0, listingStep - 1))}>
              <Ionicons name="arrow-back-outline" size={18} color="#0f766e" />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            {listingStep < listingSteps.length - 1 ? (
              <Pressable style={styles.primaryButton} onPress={() => setListingStep(Math.min(listingSteps.length - 1, listingStep + 1))}>
                <Text style={styles.primaryButtonText}>Next</Text>
                <Ionicons name="arrow-forward-outline" size={18} color="#ffffff" />
              </Pressable>
            ) : (
              <Pressable style={[styles.primaryButton, isPublishingListing && styles.disabledButton]} disabled={isPublishingListing} onPress={addListing}>
                <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>{isPublishingListing ? 'Uploading photos...' : 'Publish listing'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {!showListingForm && (
        <>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#64748b" />
        <TextInput
          placeholder="Search suburb, price, beds, solar, gated..."
          placeholderTextColor="#94a3b8"
          returnKeyType="search"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable style={styles.clearSearchButton} accessibilityLabel="Clear search" onPress={() => setQuery('')}>
            <Ionicons name="close-outline" size={18} color="#64748b" />
          </Pressable>
        )}
        <Pressable style={styles.filterButton} accessibilityLabel="Open listing filters" onPress={() => setShowHomeFilters(!showHomeFilters)}>
          <Ionicons name="options-outline" size={20} color="#ffffff" />
          {activeHomeFilterCount > 0 && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeHomeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {showHomeFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.formTitle}>Search filters</Text>
              <Text style={styles.panelHint}>Narrow homes by budget, rooms, amenities, or saved homes.</Text>
            </View>
            <Ionicons name="options-outline" size={26} color="#0f766e" />
          </View>
          <View style={styles.formGrid}>
            <TextInput
              keyboardType="numeric"
              onChangeText={(minPrice) => setHomeFilters((current) => ({ ...current, minPrice }))}
              placeholder="Min price"
              placeholderTextColor="#94a3b8"
              style={styles.formInput}
              value={homeFilters.minPrice}
            />
            <TextInput
              keyboardType="numeric"
              onChangeText={(maxPrice) => setHomeFilters((current) => ({ ...current, maxPrice }))}
              placeholder="Max price"
              placeholderTextColor="#94a3b8"
              style={styles.formInput}
              value={homeFilters.maxPrice}
            />
            <TextInput
              keyboardType="numeric"
              onChangeText={(bedrooms) => setHomeFilters((current) => ({ ...current, bedrooms }))}
              placeholder="Bedrooms"
              placeholderTextColor="#94a3b8"
              style={styles.formInput}
              value={homeFilters.bedrooms}
            />
            <TextInput
              keyboardType="numeric"
              onChangeText={(bathrooms) => setHomeFilters((current) => ({ ...current, bathrooms }))}
              placeholder="Bathrooms"
              placeholderTextColor="#94a3b8"
              style={styles.formInput}
              value={homeFilters.bathrooms}
            />
          </View>
          <TextInput
            onChangeText={(amenity) => setHomeFilters((current) => ({ ...current, amenity }))}
            placeholder="Amenity or feature, e.g. solar, gated, borehole"
            placeholderTextColor="#94a3b8"
            style={styles.formInput}
            value={homeFilters.amenity}
          />
          <View style={styles.formNavRow}>
            <Pressable
              style={[styles.signatureButton, homeFilters.savedOnly && styles.signatureButtonDone]}
              onPress={() => setHomeFilters((current) => ({ ...current, savedOnly: !current.savedOnly }))}
            >
              <Ionicons name={homeFilters.savedOnly ? 'heart' : 'heart-outline'} size={18} color={homeFilters.savedOnly ? '#ffffff' : '#0f766e'} />
              <Text style={[styles.signatureText, homeFilters.savedOnly && styles.signatureTextDone]}>Saved only</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setHomeFilters(emptyHomeFilters)}>
              <Ionicons name="refresh-outline" size={18} color="#0f766e" />
              <Text style={styles.secondaryButtonText}>Reset filters</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.segmentedControl}>
        {listingFilters.map((filter) => {
          const selected = filter.key === activeKind;
          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveKind(filter.key)}
              style={[styles.segmentButton, selected && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{trimmedQuery ? 'Best matches' : 'Featured listings'}</Text>
        <Text style={styles.sectionCount}>{filteredListings.length} found</Text>
      </View>

      <View style={styles.listGrid}>
        {filteredListings.map((listing) => (
          <ListingCard
            key={listing.id}
            isSaved={savedListingIds.includes(listing.id)}
            listing={listing}
            matchSummary={getListingMatchSummary(listing, query)}
            onChat={() => onMessageListing(listing)}
            onPress={() => {
              setSelectedListing(listing);
            }}
            onShare={() => onShareListing(listing)}
            onToggleSaved={() => onToggleSavedListing(listing.id)}
          />
        ))}
      </View>
      {filteredListings.length === 0 && (
        <View style={styles.emptyPanel}>
          <Ionicons name="search-outline" size={30} color="#0f766e" />
          <Text style={styles.formTitle}>No matching homes</Text>
          <Text style={styles.panelHint}>Try a suburb, price, room count, or feature like solar, borehole, gated, furnished, or serviced stand.</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setQuery('');
              setHomeFilters(emptyHomeFilters);
            }}
          >
            <Ionicons name="refresh-outline" size={18} color="#0f766e" />
            <Text style={styles.secondaryButtonText}>Clear search</Text>
          </Pressable>
        </View>
      )}
      {hasMoreListings && (
        <Pressable style={styles.loadMoreButton} onPress={onLoadMoreListings}>
          <Ionicons name="download-outline" size={18} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>{isLoadingListings ? 'Loading homes...' : 'Load more homes'}</Text>
        </Pressable>
      )}
        </>
      )}
    </ScrollView>
  );
}

function ListingCard({
  isSaved,
  listing,
  matchSummary,
  onChat,
  onPress,
  onShare,
  onToggleSaved
}: {
  isSaved: boolean;
  listing: Listing;
  matchSummary?: string;
  onChat?: () => void;
  onPress: () => void;
  onShare?: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <View style={styles.listingCard}>
      <Pressable onPress={onPress}>
        <CachedImage source={{ uri: listing.image }} style={styles.listingImage} />
      </Pressable>
      <View style={styles.cardBody}>
        <View style={styles.cardTopline}>
          <Text style={styles.listingTag}>{listing.tag}</Text>
          <View style={styles.cardActionRow}>
            {onShare ? (
              <Pressable accessibilityLabel="Share listing" style={styles.cardActionButton} onPress={onShare} hitSlop={8}>
                <Ionicons name="share-outline" size={18} color="#0f172a" />
              </Pressable>
            ) : null}
            <Pressable accessibilityLabel={isSaved ? 'Unsave listing' : 'Save listing'} style={styles.cardActionButton} onPress={onToggleSaved} hitSlop={8}>
              <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={21} color={isSaved ? '#e11d48' : '#0f172a'} />
            </Pressable>
          </View>
        </View>
        <Pressable onPress={onPress}>
          <Text style={styles.listingTitle} numberOfLines={2}>{listing.title}</Text>
          <Text style={styles.listingLocation} numberOfLines={1}>{listing.location}</Text>
          <Text style={styles.listingMeta} numberOfLines={1}>{listing.meta}</Text>
          {matchSummary ? (
            <View style={styles.matchPill}>
              <Ionicons name="sparkles-outline" size={14} color="#0f766e" />
              <Text style={styles.matchText} numberOfLines={1}>{matchSummary}</Text>
            </View>
          ) : null}
          <View style={styles.cardFooter}>
            <Text style={styles.listingPrice} numberOfLines={1}>{listing.price}</Text>
            <Text style={styles.hostName} numberOfLines={1}>{listing.host}</Text>
          </View>
        </Pressable>
        {onChat ? (
          <Pressable style={styles.primaryButton} onPress={onChat}>
            <Ionicons name="chatbubble-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Chat now</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ImageDropZone({
  onDropImages,
  onPickImages
}: {
  onDropImages: (uris: string[]) => void;
  onPickImages: () => void;
}) {
  const webDropProps =
    Platform.OS === 'web'
      ? {
          onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
          },
          onDrop: (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));

            Promise.all(
              files.map(
                (file) =>
                  new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.readAsDataURL(file);
                  })
              )
            ).then(onDropImages);
          }
        }
      : {};

  return (
    <Pressable {...webDropProps} style={styles.dropZone} onPress={onPickImages}>
      <View style={styles.dropZoneIcon}>
        <Ionicons name="images-outline" size={28} color="#0f766e" />
      </View>
      <View style={styles.dropZoneCopy}>
        <Text style={styles.dropZoneTitle}>Add property photos</Text>
        <Text style={styles.dropZoneText}>
          {Platform.OS === 'web' ? 'Drop images here or choose from your device.' : 'Choose images from your gallery.'}
        </Text>
      </View>
    </Pressable>
  );
}

function ListingDetails({
  currentUserEmail,
  currentUserName,
  isSaved,
  listing,
  monthlyIncomeEstimate,
  onBack,
  onMessage,
  onRequestViewing,
  onRequireAuth,
  onShare,
  onboardingRole,
  onSubmitListingToolApplication,
  onToggleSaved
}: {
  currentUserEmail: string;
  currentUserName: string;
  isSaved: boolean;
  listing: Listing;
  monthlyIncomeEstimate: number;
  onBack: () => void;
  onMessage: () => void;
  onRequestViewing: (date: string, time: string) => void;
  onRequireAuth: (reason: string) => boolean;
  onShare: () => void;
  onboardingRole: OnboardingRole | null;
  onSubmitListingToolApplication: (label: string, payload: ReportPayload) => void;
  onToggleSaved: () => void;
}) {
  const galleryPhotos = listing.photos.length > 0 ? listing.photos : [listing.image];
  const [showCalendar, setShowCalendar] = useState(false);
  const [showListingFinance, setShowListingFinance] = useState(false);
  const [selectedDate, setSelectedDate] = useState('Tomorrow');
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const viewingDates = ['Tomorrow', 'Friday', 'Saturday', 'Sunday'];
  const viewingTimes = ['10:00 AM', '12:30 PM', '3:00 PM', '5:30 PM'];
  const canCheckAffordability = listing.kind === 'sales' || listing.kind === 'stands';

  if (showListingFinance && canCheckAffordability) {
    return (
      <ScrollView contentContainerStyle={[styles.screenContent, styles.detailScreenContent]} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.profileBackButton} onPress={() => setShowListingFinance(false)}>
          <Ionicons name="chevron-back-outline" size={20} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>Property</Text>
        </Pressable>
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Check Affordability</Text>
          <Text style={styles.detailLocation}>{listing.title}</Text>
        </View>
        <ListingFinancePanel
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          listing={listing}
          monthlyIncomeEstimate={monthlyIncomeEstimate}
          onboardingRole={onboardingRole}
          onSubmitListingToolApplication={onSubmitListingToolApplication}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.screenContent, styles.detailScreenContent]} showsVerticalScrollIndicator={false}>
      <View style={styles.detailHeader}>
        <Pressable style={styles.detailBackButton} onPress={onBack} accessibilityLabel="Back to listings">
          <Ionicons name="chevron-back-outline" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.detailHeaderActions}>
          <Pressable style={styles.iconButton} accessibilityLabel="Share listing" onPress={onShare}>
            <Ionicons name="share-outline" size={20} color="#0f172a" />
          </Pressable>
          <Pressable style={styles.iconButton} accessibilityLabel={isSaved ? 'Unsave listing' : 'Save listing'} onPress={onToggleSaved}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={isSaved ? '#e11d48' : '#0f172a'} />
          </Pressable>
        </View>
      </View>

      <View style={styles.photoGallery}>
        <CachedImage source={{ uri: galleryPhotos[0] }} style={styles.heroPhoto} />
        <View style={styles.thumbnailGrid}>
          {galleryPhotos.slice(1, 5).map((photo) => (
            <CachedImage key={photo} source={{ uri: photo }} style={styles.thumbnailPhoto} />
          ))}
        </View>
      </View>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleCopy}>
          <Text style={styles.detailTitle} numberOfLines={3}>{listing.title}</Text>
          <Text style={styles.detailLocation} numberOfLines={3}>{listing.location}</Text>
        </View>
        <Text style={styles.detailPrice} numberOfLines={2}>{listing.price}</Text>
      </View>

      {canCheckAffordability && (
        <Pressable style={styles.primaryButton} onPress={() => setShowListingFinance(true)}>
          <Ionicons name="calculator-outline" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Check Affordability</Text>
        </Pressable>
      )}

      <View style={styles.detailFactGrid}>
        {listing.details.map((detail) => (
          <View key={detail} style={styles.detailFact}>
            <Ionicons name="checkmark-circle-outline" size={19} color="#0f766e" />
            <Text style={styles.detailFactText}>{detail}</Text>
          </View>
        ))}
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>About this property</Text>
        <Text style={styles.detailDescription}>{listing.description}</Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>What this place offers</Text>
        <View style={styles.amenityGrid}>
          {listing.amenities.map((amenity) => (
            <View key={amenity} style={styles.amenityRow}>
              <Ionicons name="sparkles-outline" size={18} color="#0f766e" />
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.hostPanel}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{listing.host.charAt(0)}</Text>
        </View>
        <View style={styles.messageCopy}>
          <Text style={styles.messageName}>{listing.host}</Text>
          <Text style={styles.messageText}>Verified landlord or agent · responds directly in HomeSwipe messages</Text>
        </View>
      </View>

      <View style={styles.detailActionBar}>
        <Pressable style={[styles.secondaryButton, styles.detailActionBarButton]} onPress={onMessage}>
          <Ionicons name="chatbubble-outline" size={18} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>Chat now</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, styles.detailActionBarButton]}
          onPress={() => {
            if (!showCalendar && !onRequireAuth('Sign up to request viewings and send booking details to the landlord or agent.')) {
              return;
            }

            setShowCalendar(!showCalendar);
          }}
        >
          <Ionicons name="calendar-outline" size={19} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Request viewing</Text>
        </Pressable>
      </View>

      {showCalendar && (
        <View style={styles.calendarPanel}>
          <Text style={styles.detailSectionTitle}>Choose a viewing time</Text>
          <View style={styles.calendarGrid}>
            {viewingDates.map((date) => {
              const selected = selectedDate === date;
              return (
                <Pressable key={date} style={[styles.calendarChip, selected && styles.calendarChipActive]} onPress={() => setSelectedDate(date)}>
                  <Ionicons name="calendar-clear-outline" size={18} color={selected ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.calendarChipText, selected && styles.calendarChipTextActive]}>{date}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.calendarGrid}>
            {viewingTimes.map((time) => {
              const selected = selectedTime === time;
              return (
                <Pressable key={time} style={[styles.calendarChip, selected && styles.calendarChipActive]} onPress={() => setSelectedTime(time)}>
                  <Ionicons name="time-outline" size={18} color={selected ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.calendarChipText, selected && styles.calendarChipTextActive]}>{time}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.primaryButton} onPress={() => onRequestViewing(selectedDate, selectedTime)}>
            <Ionicons name="send-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Send viewing request</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function ListingFinancePanel({
  currentUserEmail,
  currentUserName,
  listing,
  monthlyIncomeEstimate,
  onboardingRole,
  onSubmitListingToolApplication
}: {
  currentUserEmail: string;
  currentUserName: string;
  listing: Listing;
  monthlyIncomeEstimate: number;
  onboardingRole: OnboardingRole | null;
  onSubmitListingToolApplication: (label: string, payload: ReportPayload) => void;
}) {
  const availableModes = onboardingRole === 'lister'
    ? ['upgrade', 'insurance']
    : listing.kind === 'sales' || listing.kind === 'stands'
      ? ['affordability']
      : [];
  const [activeMode, setActiveMode] = useState(availableModes[0] || 'affordability');
  const [deposit, setDeposit] = useState('');
  const [upgradeBudget, setUpgradeBudget] = useState(`${Math.max(1000, Math.round(getNumberFromText(listing.price) * 0.12))}`);
  const [insuranceMonths, setInsuranceMonths] = useState('12');

  useEffect(() => {
    if (availableModes.length > 0 && !availableModes.includes(activeMode)) {
      setActiveMode(availableModes[0]);
    }
  }, [activeMode, availableModes.join('|')]);

  if (availableModes.length === 0) {
    return null;
  }

  const homeLoanReport = getListingHomeLoanReport(listing, currentUserName, currentUserEmail, monthlyIncomeEstimate, deposit);
  const upgradeReport = getListingUpgradeReport(listing, currentUserName, currentUserEmail, upgradeBudget);
  const insuranceReport = getListingInsuranceReport(listing, currentUserName, currentUserEmail, insuranceMonths);
  const activeReport = activeMode === 'upgrade' ? upgradeReport : activeMode === 'insurance' ? insuranceReport : homeLoanReport;

  const modeMeta: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    affordability: { label: 'Affordability', icon: 'home-outline' },
    upgrade: { label: 'Upgrade', icon: 'construct-outline' },
    insurance: { label: 'Insurance', icon: 'shield-checkmark-outline' }
  };

  return (
    <View style={styles.formPanel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.formTitle}>Listing finance</Text>
          <Text style={styles.panelHint}>Prefilled from this listing price and location.</Text>
        </View>
        <Ionicons name="cash-outline" size={26} color="#0f766e" />
      </View>

      {availableModes.length > 1 && (
        <View style={styles.segmentedControl}>
          {availableModes.map((mode) => (
            <Pressable key={mode} style={[styles.segmentButton, activeMode === mode && styles.segmentButtonActive]} onPress={() => setActiveMode(mode)}>
              <Ionicons name={modeMeta[mode].icon} size={16} color={activeMode === mode ? '#ffffff' : '#0f766e'} />
              <Text style={[styles.segmentText, activeMode === mode && styles.segmentTextActive]}>{modeMeta[mode].label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {activeMode === 'affordability' && (
        <ToolValueInput label="Deposit available" value={deposit} onChangeText={setDeposit} prefix="USD" keyboardType="decimal-pad" />
      )}
      {activeMode === 'upgrade' && (
        <ToolValueInput label="Upgrade budget" value={upgradeBudget} onChangeText={setUpgradeBudget} prefix="USD" keyboardType="decimal-pad" />
      )}
      {activeMode === 'insurance' && (
        <View style={styles.segmentedControl}>
          {insurancePeriods.map((period) => (
            <Pressable key={period.value} style={[styles.segmentButton, insuranceMonths === period.value && styles.segmentButtonActive]} onPress={() => setInsuranceMonths(period.value)}>
              <Text style={[styles.segmentText, insuranceMonths === period.value && styles.segmentTextActive]}>{period.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.toolInputSummaryGrid}>
        {Object.entries(activeReport.results).slice(0, 6).map(([key, value]) => (
          <View key={key} style={styles.toolInputSummaryItem}>
            <Text style={styles.toolInputSummaryLabel}>{key}</Text>
            <Text style={styles.toolInputSummaryValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.profileActionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => onSubmitListingToolApplication(activeMode === 'insurance' ? 'Request Home Insurance Quote' : activeMode === 'upgrade' ? 'Apply For Upgrade Financing' : 'Apply for Loan', activeReport)}
        >
          <Ionicons name="paper-plane-outline" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Apply for Loan</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => shareReport(activeReport)}>
          <Ionicons name="share-outline" size={18} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

type ToolKey = 'home-loan' | 'rent-loan' | 'household-insurance' | 'property-upgrades' | 'building-financing' | 'home-insurance' | 'leases';

const toolCatalog: { key: ToolKey; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home-loan', title: 'Home Loan Affordability', subtitle: 'Purchase estimate and upfront costs', icon: 'home-outline' },
  { key: 'rent-loan', title: 'Rent Loan', subtitle: 'Short-term rent support estimate', icon: 'cash-outline' },
  { key: 'household-insurance', title: 'Household Insurance', subtitle: 'Contents cover premium estimate', icon: 'shield-checkmark-outline' },
  { key: 'property-upgrades', title: 'Property Upgrades', subtitle: 'Managed upgrade finance', icon: 'construct-outline' },
  { key: 'building-financing', title: 'Building Financing', subtitle: 'Managed construction finance', icon: 'business-outline' },
  { key: 'home-insurance', title: 'Home Insurance', subtitle: 'Building cover premium estimate', icon: 'umbrella-outline' },
  { key: 'leases', title: 'Lease PDF Generator', subtitle: 'Draft, sign, share, and download leases', icon: 'document-text-outline' }
];

const interestRate = 0.125;
const monthlyRate = interestRate / 12;
const defaultToolInputs = {
  currency: 'USD',
  income: '',
  loanYears: '5',
  deposit: '',
  monthlyRent: '',
  supportMonths: '1',
  repaymentMonths: '6',
  contentsValue: '',
  coverType: 'Standard',
  insuranceItem: 'Buildings',
  insuranceSumInsured: '',
  insuranceMonths: '12',
  upgradeType: 'Solar Installation',
  propertyLocation: '',
  upgradeBudget: '',
  siteInspection: '',
  buildingStage: 'Foundation',
  standLocation: '',
  buildLoanYears: '5',
  buildBudget: '',
  propertyValue: '',
  propertyType: 'House',
  insuranceLocation: ''
};

function ToolsScreen({
  currentUserEmail,
  currentUserName,
  leases,
  onRequireAuth,
  savedReports,
  setActiveTab,
  setApplications,
  setSavedReports,
  setLeases
}: {
  currentUserEmail: string;
  currentUserName: string;
  leases: LeaseDraft[];
  onRequireAuth: (reason: string) => boolean;
  savedReports: SavedToolReport[];
  setActiveTab: React.Dispatch<React.SetStateAction<TabKey>>;
  setApplications: React.Dispatch<React.SetStateAction<RentalApplication[]>>;
  setSavedReports: React.Dispatch<React.SetStateAction<SavedToolReport[]>>;
  setLeases: React.Dispatch<React.SetStateAction<LeaseDraft[]>>;
}) {
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [toolStep, setToolStep] = useState(0);
  const [toolInputs, setToolInputs] = useState(defaultToolInputs);
  const [leaseForm, setLeaseForm] = useState(emptyLeaseForm);
  const [leaseError, setLeaseError] = useState('');
  const selectedTool = toolCatalog.find((tool) => tool.key === activeTool);

  const setToolInput = (key: keyof typeof defaultToolInputs, value: string) => {
    setToolInputs((current) => ({ ...current, [key]: value }));
  };

  const restartTool = () => {
    setToolInputs(defaultToolInputs);
    setLeaseForm(emptyLeaseForm);
    setLeaseError('');
    setToolStep(0);
  };

  const openTool = (tool: ToolKey) => {
    setActiveTool(tool);
    setToolStep(0);
    setLeaseError('');
  };

  const closeTool = () => {
    setActiveTool(null);
    setToolStep(0);
  };

  const goBackInTool = () => {
    if (toolStep > 0) {
      setToolStep((currentStep) => Math.max(0, currentStep - 1));
      return;
    }

    closeTool();
  };

  const saveReport = (payload: ReportPayload) => {
    if (!onRequireAuth('Sign in to save HomeSwipe calculator results to your profile.')) {
      return;
    }

    setSavedReports((currentReports) => [
      { id: `${Date.now()}`, title: payload.title, createdAt: new Date().toLocaleDateString(), payload },
      ...currentReports
    ]);
  };

  const submitToolApplication = (label: string, payload: ReportPayload) => {
    if (!onRequireAuth('Sign in to apply and track your HomeSwipe application review.')) {
      return;
    }
    const summary = Object.entries(payload.results)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');
    const application: RentalApplication = {
      id: `tool-${Date.now()}`,
      listingId: `tool-${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      property: label,
      landlord: 'HomeSwipe Finance',
      status: 'In Review',
      submitted: new Date().toLocaleDateString(),
      nextStep: `${summary}. Sent for HomeSwipe review at homeswipelistings@gmail.com.`
    };
    setApplications((currentApplications) => [application, ...currentApplications]);
    setActiveTab('profile');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const body = [
        `Application: ${label}`,
        `User: ${currentUserName}`,
        currentUserEmail ? `Email: ${currentUserEmail}` : '',
        '',
        'Inputs',
        ...Object.entries(payload.inputs).map(([key, value]) => `${key}: ${value}`),
        '',
        'Results',
        ...Object.entries(payload.results).map(([key, value]) => `${key}: ${value}`),
        '',
        `Application ID: ${application.id}`
      ].filter(Boolean).join('\n');
      window.location.href = `mailto:homeswipelistings@gmail.com?subject=${encodeURIComponent(`HomeSwipe ${label}`)}&body=${encodeURIComponent(body)}`;
    }
  };

  const getReportPayload = (): ReportPayload | null => {
    const currency = toolInputs.currency;
    if (activeTool === 'home-loan') {
      const income = getNumberFromText(toolInputs.income);
      const years = Math.max(1, Math.min(10, getNumberFromText(toolInputs.loanYears) || 1));
      const deposit = getNumberFromText(toolInputs.deposit);
      const maxMonthly = income * 0.3;
      const months = years * 12;
      const loanAmount = monthlyRate > 0 ? maxMonthly * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate) : maxMonthly * months;
      const requiredDeposit = Math.max(deposit, loanAmount * 0.1);
      const purchasePrice = loanAmount + requiredDeposit;
      const transferCosts = purchasePrice * 0.035;
      const registrationCosts = loanAmount * 0.025;
      const valuationFees = Math.max(150, purchasePrice * 0.002);
      const applicationFees = Math.max(100, loanAmount * 0.0015);
      return {
        title: 'Home Loan Affordability',
        userName: currentUserName,
        userEmail: currentUserEmail,
        inputs: {
          Currency: currency,
          'Monthly Net Income': formatMoney(currency, income),
          'Loan Period': `${years} years`,
          'Deposit Available': formatMoney(currency, deposit)
        },
        results: {
          'Estimated Purchase Price': formatMoney(currency, purchasePrice),
          'Required Deposit': formatMoney(currency, requiredDeposit),
          'Estimated Loan Amount': formatMoney(currency, loanAmount),
          'Monthly Repayment': formatMoney(currency, maxMonthly),
          'Interest Rate': formatPercent(12.5),
          'Estimated Upfront Costs': formatMoney(currency, transferCosts + registrationCosts + valuationFees + applicationFees),
          'Transfer Costs': formatMoney(currency, transferCosts),
          'Registration Costs': formatMoney(currency, registrationCosts),
          'Valuation Fees': formatMoney(currency, valuationFees),
          'Application Fees': formatMoney(currency, applicationFees)
        }
      };
    }

    if (activeTool === 'rent-loan') {
      const rent = getNumberFromText(toolInputs.monthlyRent);
      const supportMonths = Math.max(1, getNumberFromText(toolInputs.supportMonths) || 1);
      const repaymentMonths = Math.max(1, getNumberFromText(toolInputs.repaymentMonths) || 1);
      const principal = rent * supportMonths;
      const totalInterest = principal * interestRate * (repaymentMonths / 12);
      const serviceFee = principal * 0.03;
      const totalRepayment = principal + totalInterest + serviceFee;
      return {
        title: 'Rent Loan',
        userName: currentUserName,
        userEmail: currentUserEmail,
        inputs: {
          Currency: currency,
          'Monthly Rent': formatMoney(currency, rent),
          'Months Needing Support': `${supportMonths}`,
          'Repayment Period': `${repaymentMonths} months`
        },
        results: {
          'Total Rent Finance Required': formatMoney(currency, principal),
          'Monthly Repayment': formatMoney(currency, totalRepayment / repaymentMonths),
          'Interest Rate': formatPercent(12.5),
          'Service Fee': formatMoney(currency, serviceFee),
          'Total Repayment': formatMoney(currency, totalRepayment)
        },
        notes: ['Rent loan estimates exclude security deposits and are based only on rent financing requirements.']
      };
    }

    if (activeTool === 'household-insurance') {
      const value = getNumberFromText(toolInputs.insuranceSumInsured);
      const ratePercent = 0.12;
      const months = Math.max(4, getNumberFromText(toolInputs.insuranceMonths) || 12);
      const premium = value * (ratePercent / 100) * (months / 12);
      const stampDuty = premium * 0.05;
      const totalDue = premium + stampDuty;
      return {
        title: 'Home, Household and Specified Items Insurance',
        userName: currentUserName,
        userEmail: currentUserEmail,
        inputs: {
          Currency: currency,
          'Item Insured': toolInputs.insuranceItem,
          'Sum Insured': formatMoney(currency, value),
          'Insurance Rate': `${ratePercent}%`,
          'Period of Cover': `${months} months`
        },
        results: {
          'Item': toolInputs.insuranceItem,
          'Sum Insured': formatMoney(currency, value),
          Premium: formatMoney(currency, premium),
          'Stamp Duty': formatMoney(currency, stampDuty),
          'Total Due': formatMoney(currency, totalDue)
        },
        notes: ['Insurance premium uses the selected rate and period of cover. Stamp duty is calculated at 5% of the premium.']
      };
    }

    if (activeTool === 'property-upgrades') {
      const budget = getNumberFromText(toolInputs.upgradeBudget);
      const financeAmount = budget;
      const repaymentMonths = 36;
      const total = financeAmount + financeAmount * interestRate * 3;
      return {
        title: 'Property Upgrades',
        userName: currentUserName,
        userEmail: currentUserEmail,
        inputs: {
          Currency: currency,
          'Upgrade Type': toolInputs.upgradeType,
          'Property Location': toolInputs.propertyLocation || 'Not provided',
          'Estimated Budget': formatMoney(currency, budget),
          'Site Inspection': toolInputs.siteInspection || 'To be scheduled'
        },
        results: {
          'Estimated Project Cost': formatMoney(currency, budget),
          'Estimated Monthly Repayment': formatMoney(currency, total / repaymentMonths),
          'Finance Amount': formatMoney(currency, financeAmount),
          'Interest Rate': formatPercent(12.5),
          'Project Timeline': budget > 20000 ? '8-16 weeks' : '3-8 weeks'
        },
        notes: ['HomeSwipe controls the project, suppliers, contractors, payments, inspections and completion process.', 'Funds are paid directly to approved suppliers and contractors, not to the customer.']
      };
    }

    if (activeTool === 'building-financing') {
      const budget = getNumberFromText(toolInputs.buildBudget);
      const years = Math.max(1, getNumberFromText(toolInputs.buildLoanYears) || 1);
      const repaymentMonths = years * 12;
      const total = budget + budget * interestRate * years;
      return {
        title: 'Building Financing',
        userName: currentUserName,
        userEmail: currentUserEmail,
        inputs: {
          Currency: currency,
          'Building Stage': toolInputs.buildingStage,
          'Stand Location': toolInputs.standLocation || 'Not provided',
          'Loan Duration': `${years} years`,
          'Estimated Budget': formatMoney(currency, budget),
          'Site Inspection': toolInputs.siteInspection || 'To be scheduled'
        },
        results: {
          'Estimated Building Cost': formatMoney(currency, budget),
          'Finance Amount': formatMoney(currency, budget),
          'Monthly Repayment': formatMoney(currency, total / repaymentMonths),
          'Interest Rate': formatPercent(12.5),
          'Project Timeline': toolInputs.buildingStage === 'Full Build' ? '6-12 months' : '6-20 weeks'
        },
        notes: ['HomeSwipe oversees construction, suppliers, contractors, quality control, inspections and project completion.', 'Payments are made directly to suppliers and contractors in approved project stages.']
      };
    }

    if (activeTool === 'home-insurance') {
      const value = getNumberFromText(toolInputs.insuranceSumInsured);
      const ratePercent = 0.12;
      const months = Math.max(4, getNumberFromText(toolInputs.insuranceMonths) || 12);
      const premium = value * (ratePercent / 100) * (months / 12);
      const stampDuty = premium * 0.05;
      const totalDue = premium + stampDuty;
      return {
        title: 'Home, Household and Specified Items Insurance',
        userName: currentUserName,
        userEmail: currentUserEmail,
        inputs: {
          Currency: currency,
          'Item Insured': toolInputs.insuranceItem,
          'Sum Insured': formatMoney(currency, value),
          'Insurance Rate': `${ratePercent}%`,
          'Period of Cover': `${months} months`
        },
        results: {
          'Item': toolInputs.insuranceItem,
          'Sum Insured': formatMoney(currency, value),
          Premium: formatMoney(currency, premium),
          'Stamp Duty': formatMoney(currency, stampDuty),
          'Total Due': formatMoney(currency, totalDue)
        },
        notes: ['Insurance premium uses the selected rate and period of cover. Stamp duty is calculated at 5% of the premium.']
      };
    }

    return null;
  };

  const activeReport = getReportPayload();

  const createLease = () => {
    if (!onRequireAuth('Sign up to generate leases, send documents, and keep agreements attached to your profile.')) {
      return;
    }

    const missingFields = [
      !leaseForm.property.trim() ? 'property' : '',
      !leaseForm.landlord.trim() ? 'landlord' : '',
      !leaseForm.tenant.trim() ? 'tenant' : '',
      !leaseForm.rent.trim() ? 'monthly rent' : ''
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setLeaseError(`Add ${missingFields.join(', ')} before generating the lease.`);
      return;
    }

    const lease: LeaseDraft = {
      property: leaseForm.property.trim(),
      landlord: leaseForm.landlord.trim(),
      tenant: leaseForm.tenant.trim(),
      rent: leaseForm.rent.trim(),
      deposit: leaseForm.deposit.trim() || 'No deposit recorded',
      startDate: leaseForm.startDate.trim() || 'Start date to be confirmed',
      endDate: leaseForm.endDate.trim() || 'End date to be confirmed',
      utilities: leaseForm.utilities.trim() || 'Utilities to be agreed in writing.',
      petPolicy: leaseForm.petPolicy.trim() || 'Pet policy to be agreed in writing.',
      parking: leaseForm.parking.trim() || 'Parking to be agreed in writing.',
      id: `${Date.now()}`,
      status: 'Draft',
      landlordSigned: false,
      tenantSigned: false
    };

    setLeaseError('');
    setLeases((currentLeases) => [lease, ...currentLeases]);
    setLeaseForm(emptyLeaseForm);
  };

  const getLeaseReportPayload = (lease: LeaseDraft): ReportPayload => ({
    title: `Lease Agreement - ${lease.property}`,
    userName: currentUserName,
    userEmail: currentUserEmail,
    inputs: {
      Property: lease.property,
      Landlord: lease.landlord,
      Tenant: lease.tenant,
      Rent: lease.rent,
      Deposit: lease.deposit,
      Term: `${lease.startDate} to ${lease.endDate}`
    },
    results: {
      Status: lease.status,
      Utilities: lease.utilities,
      'Pet Policy': lease.petPolicy,
      Parking: lease.parking,
      'Landlord Signed': lease.landlordSigned ? 'Yes' : 'No',
      'Tenant Signed': lease.tenantSigned ? 'Yes' : 'No'
    }
  });

  const updateLease = (id: string, update: Partial<LeaseDraft>) => {
    if (!onRequireAuth('Sign in to update lease signatures and signing status.')) {
      return;
    }

    setLeases((currentLeases) =>
      currentLeases.map((lease) => {
        if (lease.id !== id) return lease;
        const nextLease = { ...lease, ...update };
        const signaturesComplete = nextLease.landlordSigned && nextLease.tenantSigned;
        const hasSignature = nextLease.landlordSigned || nextLease.tenantSigned;
        const status = signaturesComplete ? 'Completed' : nextLease.status === 'Completed' || hasSignature ? 'Sent for signing' : nextLease.status;
        return { ...nextLease, status };
      })
    );
  };

  const deleteLease = (id: string) => {
    if (onRequireAuth('Sign in to delete lease drafts.')) {
      setLeases((currentLeases) => currentLeases.filter((lease) => lease.id !== id));
    }
  };

  const shareLease = async (lease: LeaseDraft) => {
    if (!onRequireAuth('Sign in to share lease drafts with another user.')) return;
    const message = getLeaseShareMessage(lease);
    const leaseLink = getLeaseLink(lease);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(leaseLink).catch(() => undefined);
    }
    await Share.share({ title: `Lease for ${lease.property}`, message, url: leaseLink });
    updateLease(lease.id, { status: lease.status === 'Draft' ? 'Sent for signing' : lease.status });
  };

  const renderCommonActions = (payload: ReportPayload | null, primaryActions: { label: string; icon: keyof typeof Ionicons.glyphMap }[]) => {
    if (!payload) return null;
    return (
      <View style={styles.toolActionPanel}>
        <View style={styles.profileActionRow}>
          {primaryActions.map((action) => (
            <Pressable key={action.label} style={styles.primaryButton} onPress={() => submitToolApplication(action.label, payload)}>
              <Ionicons name={action.icon} size={18} color="#ffffff" />
              <Text style={styles.primaryButtonText}>{action.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.secondaryButton} onPress={() => saveReport(payload)}>
            <Ionicons name="bookmark-outline" size={18} color="#0f766e" />
            <Text style={styles.secondaryButtonText}>Save Results</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => downloadReportPdf(payload)}>
            <Ionicons name="download-outline" size={18} color="#0f766e" />
            <Text style={styles.secondaryButtonText}>Download PDF</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => shareReport(payload)}>
            <Ionicons name="share-outline" size={18} color="#0f766e" />
            <Text style={styles.secondaryButtonText}>Share PDF</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => emailReport(payload)}>
            <Ionicons name="mail-outline" size={18} color="#0f766e" />
            <Text style={styles.secondaryButtonText}>Email PDF</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderResults = (payload: ReportPayload | null, primaryActions: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = []) => {
    if (!payload) return null;
    const resultEntries = Object.entries(payload.results);
    const [heroLabel = 'Estimated Result', heroValue = 'Ready'] = resultEntries[0] || [];
    const detailEntries = resultEntries.slice(1);
    return (
      <View style={styles.toolResultsPanel}>
        <View style={styles.toolResultsHeader}>
          <View style={styles.panelHeaderCopy}>
            <Text style={styles.formTitle}>{payload.title} Results</Text>
            <Text style={styles.panelHint}>Professional estimate generated {new Date().toLocaleDateString()}</Text>
          </View>
          <View style={styles.statusPill}>
            <Ionicons name="document-text-outline" size={16} color="#0f766e" />
            <Text style={styles.statusPillText}>PDF Ready</Text>
          </View>
        </View>
        <View style={styles.toolResultHero}>
          <Text style={styles.toolResultHeroLabel}>{heroLabel}</Text>
          <Text style={styles.toolResultHeroValue}>{heroValue}</Text>
          <View style={styles.toolResultMetaRow}>
            <View style={styles.toolResultMetaItem}>
              <Text style={styles.toolResultMetaLabel}>User</Text>
              <Text style={styles.toolResultMetaValue}>{payload.userName || 'Guest'}</Text>
            </View>
            <View style={styles.toolResultMetaItem}>
              <Text style={styles.toolResultMetaLabel}>Date</Text>
              <Text style={styles.toolResultMetaValue}>{new Date().toLocaleDateString()}</Text>
            </View>
            <View style={styles.toolResultMetaItem}>
              <Text style={styles.toolResultMetaLabel}>Status</Text>
              <Text style={styles.toolResultMetaValue}>Estimate</Text>
            </View>
          </View>
        </View>
        <View style={styles.toolSectionBlock}>
          <Text style={styles.previewTitle}>Calculation Inputs</Text>
          <View style={styles.toolInputSummaryGrid}>
            {Object.entries(payload.inputs).map(([key, value]) => (
              <View key={key} style={styles.toolInputSummaryItem}>
                <Text style={styles.toolInputSummaryLabel}>{key}</Text>
                <Text style={styles.toolInputSummaryValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.toolSectionBlock}>
          <Text style={styles.previewTitle}>Result Breakdown</Text>
          <View style={styles.toolResultGrid}>
            {detailEntries.map(([key, value]) => (
              <View key={key} style={styles.toolResultRow}>
                <Text style={styles.toolResultLabel}>{key}</Text>
              <Text style={styles.toolResultValue}>{value}</Text>
            </View>
          ))}
          </View>
        </View>
        {payload.notes?.map((note) => (
          <View key={note} style={styles.verificationNote}>
            <Ionicons name="information-circle-outline" size={18} color="#075985" />
            <Text style={styles.verificationNoteText}>{note}</Text>
          </View>
        ))}
        {renderCommonActions(payload, primaryActions)}
      </View>
    );
  };

  const renderCalculator = () => {
    if (!activeTool || activeTool === 'leases') return null;
    const currencyControl = (
      <View style={styles.segmentedControl}>
        {['USD', 'ZWG'].map((currency) => (
          <Pressable key={currency} style={[styles.segmentButton, toolInputs.currency === currency && styles.segmentButtonActive]} onPress={() => setToolInput('currency', currency)}>
            <Text style={[styles.segmentText, toolInputs.currency === currency && styles.segmentTextActive]}>{currency}</Text>
          </Pressable>
        ))}
      </View>
    );

    const fields: React.ReactNode[] = [<View key="currency">{currencyControl}</View>];
    let actions: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [];

    if (activeTool === 'home-loan') {
      actions = [{ label: 'Get Pre-Approved', icon: 'checkmark-circle-outline' }, { label: 'Compare Mortgages', icon: 'git-compare-outline' }];
      fields.push(
        <ToolValueInput key="income" label="Monthly Net Income" value={toolInputs.income} onChangeText={(value) => setToolInput('income', value)} prefix={toolInputs.currency} keyboardType="decimal-pad" />,
        <ToolValueInput key="years" label="Loan Period" helper="1 to 10 years" value={toolInputs.loanYears} onChangeText={(value) => setToolInput('loanYears', value.replace(/[^0-9]/g, ''))} suffix="Years" keyboardType="number-pad" />,
        <ToolValueInput key="deposit" label="Deposit Available" value={toolInputs.deposit} onChangeText={(value) => setToolInput('deposit', value)} prefix={toolInputs.currency} keyboardType="decimal-pad" />
      );
    }

    if (activeTool === 'rent-loan') {
      actions = [{ label: 'Apply for Rent Loan', icon: 'cash-outline' }];
      fields.push(
        <ToolValueInput key="rent" label="Monthly Rent" value={toolInputs.monthlyRent} onChangeText={(value) => setToolInput('monthlyRent', value)} prefix={toolInputs.currency} keyboardType="decimal-pad" />,
        <ToolValueInput key="support" label="Months Needing Support" value={toolInputs.supportMonths} onChangeText={(value) => setToolInput('supportMonths', value.replace(/[^0-9]/g, ''))} suffix="Months" keyboardType="number-pad" />,
        <ToolValueInput key="repayment" label="Repayment Period" value={toolInputs.repaymentMonths} onChangeText={(value) => setToolInput('repaymentMonths', value.replace(/[^0-9]/g, ''))} suffix="Months" keyboardType="number-pad" />
      );
    }

    if (activeTool === 'household-insurance') {
      actions = [{ label: 'Request Quote', icon: 'chatbubble-ellipses-outline' }];
      fields.push(
        <View key="item" style={styles.segmentedControl}>{insuranceItems.map((item) => <Pressable key={item} style={[styles.segmentButton, toolInputs.insuranceItem === item && styles.segmentButtonActive]} onPress={() => setToolInput('insuranceItem', item)}><Text style={[styles.segmentText, toolInputs.insuranceItem === item && styles.segmentTextActive]}>{item}</Text></Pressable>)}</View>,
        <ToolValueInput key="sum" label={`${toolInputs.insuranceItem} sum insured`} helper="Example: 20000" value={toolInputs.insuranceSumInsured} onChangeText={(value) => setToolInput('insuranceSumInsured', value)} prefix={toolInputs.currency} keyboardType="decimal-pad" />,
        <View key="period" style={styles.segmentedControl}>{insurancePeriods.map((period) => <Pressable key={period.value} style={[styles.segmentButton, toolInputs.insuranceMonths === period.value && styles.segmentButtonActive]} onPress={() => setToolInput('insuranceMonths', period.value)}><Text style={[styles.segmentText, toolInputs.insuranceMonths === period.value && styles.segmentTextActive]}>{period.label}</Text></Pressable>)}</View>
      );
    }

    if (activeTool === 'property-upgrades') {
      actions = [{ label: 'Request Site Visit', icon: 'calendar-outline' }, { label: 'Apply For Upgrade Financing', icon: 'hammer-outline' }];
      fields.push(
        <View key="upgrade" style={styles.segmentedControl}>{['Solar Installation', 'Boreholes', 'Kitchens', 'Roofing', 'Tiling', 'Security Systems', 'Boundary Walls', 'Painting', 'Extensions'].map((item) => <Pressable key={item} style={[styles.segmentButton, toolInputs.upgradeType === item && styles.segmentButtonActive]} onPress={() => setToolInput('upgradeType', item)}><Text style={[styles.segmentText, toolInputs.upgradeType === item && styles.segmentTextActive]}>{item}</Text></Pressable>)}</View>,
        <ToolValueInput key="location" label="Property Location" value={toolInputs.propertyLocation} onChangeText={(value) => setToolInput('propertyLocation', value)} />,
        <ToolValueInput key="budget" label="Estimated Budget" value={toolInputs.upgradeBudget} onChangeText={(value) => setToolInput('upgradeBudget', value)} prefix={toolInputs.currency} keyboardType="decimal-pad" />,
        <ToolDateInput key="site" label="Schedule Site Inspection" value={toolInputs.siteInspection} onChangeText={(value) => setToolInput('siteInspection', value)} />
      );
    }

    if (activeTool === 'building-financing') {
      actions = [{ label: 'Request Site Visit', icon: 'calendar-outline' }, { label: 'Apply For Building Finance', icon: 'business-outline' }];
      fields.push(
        <View key="stage" style={styles.segmentedControl}>{['Foundation', 'Walls', 'Roofing', 'Finishing', 'Full Build'].map((stage) => <Pressable key={stage} style={[styles.segmentButton, toolInputs.buildingStage === stage && styles.segmentButtonActive]} onPress={() => setToolInput('buildingStage', stage)}><Text style={[styles.segmentText, toolInputs.buildingStage === stage && styles.segmentTextActive]}>{stage}</Text></Pressable>)}</View>,
        <ToolValueInput key="stand" label="Stand Location" value={toolInputs.standLocation} onChangeText={(value) => setToolInput('standLocation', value)} />,
        <ToolValueInput key="duration" label="Loan Duration" helper="Enter duration in years" value={toolInputs.buildLoanYears} onChangeText={(value) => setToolInput('buildLoanYears', value.replace(/[^0-9]/g, ''))} suffix="Years" keyboardType="number-pad" />,
        <ToolValueInput key="budget" label="Estimated Budget" value={toolInputs.buildBudget} onChangeText={(value) => setToolInput('buildBudget', value)} prefix={toolInputs.currency} keyboardType="decimal-pad" />,
        <ToolDateInput key="site" label="Schedule Site Inspection" value={toolInputs.siteInspection} onChangeText={(value) => setToolInput('siteInspection', value)} />
      );
    }

    if (activeTool === 'home-insurance') {
      actions = [{ label: 'Request Home Insurance Quote', icon: 'chatbubble-ellipses-outline' }];
      fields.push(
        <View key="item" style={styles.segmentedControl}>{insuranceItems.map((item) => <Pressable key={item} style={[styles.segmentButton, toolInputs.insuranceItem === item && styles.segmentButtonActive]} onPress={() => setToolInput('insuranceItem', item)}><Text style={[styles.segmentText, toolInputs.insuranceItem === item && styles.segmentTextActive]}>{item}</Text></Pressable>)}</View>,
        <ToolValueInput key="sum" label={`${toolInputs.insuranceItem} sum insured`} helper="Example: 20000" value={toolInputs.insuranceSumInsured} onChangeText={(value) => setToolInput('insuranceSumInsured', value)} prefix={toolInputs.currency} keyboardType="decimal-pad" />,
        <View key="period" style={styles.segmentedControl}>{insurancePeriods.map((period) => <Pressable key={period.value} style={[styles.segmentButton, toolInputs.insuranceMonths === period.value && styles.segmentButtonActive]} onPress={() => setToolInput('insuranceMonths', period.value)}><Text style={[styles.segmentText, toolInputs.insuranceMonths === period.value && styles.segmentTextActive]}>{period.label}</Text></Pressable>)}</View>
      );
    }

    const isResultsStep = toolStep >= fields.length;
    const currentQuestion = fields[Math.min(toolStep, fields.length - 1)];

    if (isResultsStep) {
      return renderResults(activeReport, actions);
    }

    return (
      <View style={styles.formPanel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.formTitle}>{selectedTool?.title}</Text>
            <Text style={styles.panelHint}>Question {toolStep + 1} of {fields.length}</Text>
          </View>
          <Ionicons name={selectedTool?.icon || 'construct-outline'} size={28} color="#0f766e" />
        </View>
        <View style={styles.toolQuestionShell}>{currentQuestion}</View>
        <View style={styles.formNavRow}>
          <Pressable style={styles.secondaryButton} onPress={goBackInTool}>
            <Ionicons name="chevron-back-outline" size={18} color="#0f766e" />
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => setToolStep((currentStep) => currentStep + 1)}>
            <Ionicons name={toolStep === fields.length - 1 ? 'calculator-outline' : 'chevron-forward-outline'} size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>{toolStep === fields.length - 1 ? 'Calculate Estimate' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderLeaseTool = () => {
    const leaseFields = [
      <LeaseInput key="property" label="Property" value={leaseForm.property} onChangeText={(property) => { setLeaseError(''); setLeaseForm((current) => ({ ...current, property })); }} />,
      <LeaseInput key="landlord" label="Landlord" value={leaseForm.landlord} onChangeText={(landlord) => { setLeaseError(''); setLeaseForm((current) => ({ ...current, landlord })); }} />,
      <LeaseInput key="tenant" label="Tenant" value={leaseForm.tenant} onChangeText={(tenant) => { setLeaseError(''); setLeaseForm((current) => ({ ...current, tenant })); }} />,
      <LeaseInput key="rent" label="Monthly rent" value={leaseForm.rent} onChangeText={(rent) => { setLeaseError(''); setLeaseForm((current) => ({ ...current, rent })); }} />,
      <LeaseInput key="deposit" label="Deposit" value={leaseForm.deposit} onChangeText={(deposit) => setLeaseForm((current) => ({ ...current, deposit }))} />,
      <LeaseInput key="startDate" label="Start date" value={leaseForm.startDate} onChangeText={(startDate) => setLeaseForm((current) => ({ ...current, startDate }))} />,
      <LeaseInput key="endDate" label="End date" value={leaseForm.endDate} onChangeText={(endDate) => setLeaseForm((current) => ({ ...current, endDate }))} />,
      <LeaseInput key="parking" label="Parking" value={leaseForm.parking} onChangeText={(parking) => setLeaseForm((current) => ({ ...current, parking }))} />,
      <LeaseInput key="utilities" label="Utilities" multiline value={leaseForm.utilities} onChangeText={(utilities) => setLeaseForm((current) => ({ ...current, utilities }))} />,
      <LeaseInput key="petPolicy" label="Pet policy" multiline value={leaseForm.petPolicy} onChangeText={(petPolicy) => setLeaseForm((current) => ({ ...current, petPolicy }))} />
    ];
    const isReviewStep = toolStep >= leaseFields.length;
    const currentQuestion = leaseFields[Math.min(toolStep, leaseFields.length - 1)];

    return (
      <View style={styles.leaseWorkspace}>
        {!isReviewStep ? (
          <View style={styles.formPanel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.formTitle}>Create lease draft</Text>
                <Text style={styles.panelHint}>Question {toolStep + 1} of {leaseFields.length}</Text>
              </View>
              <Ionicons name="document-lock-outline" size={28} color="#0f766e" />
            </View>
            {leaseError ? <View style={styles.publishError}><Ionicons name="alert-circle-outline" size={18} color="#b91c1c" /><Text style={styles.publishErrorText}>{leaseError}</Text></View> : null}
            <View style={styles.toolQuestionShell}>{currentQuestion}</View>
            <View style={styles.formNavRow}>
              <Pressable style={styles.secondaryButton} onPress={goBackInTool}>
                <Ionicons name="chevron-back-outline" size={18} color="#0f766e" />
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => setToolStep((currentStep) => currentStep + 1)}>
                <Ionicons name="chevron-forward-outline" size={18} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Next</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.formPanel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.formTitle}>Review lease details</Text>
                <Text style={styles.panelHint}>Create the draft, then download, share, save, or email the PDF.</Text>
              </View>
              <Ionicons name="document-text-outline" size={28} color="#0f766e" />
            </View>
            {leaseError ? <View style={styles.publishError}><Ionicons name="alert-circle-outline" size={18} color="#b91c1c" /><Text style={styles.publishErrorText}>{leaseError}</Text></View> : null}
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>{leaseForm.property || 'Property not added'}</Text>
              <Text style={styles.previewText}>Landlord: {leaseForm.landlord || 'Not added'}</Text>
              <Text style={styles.previewText}>Tenant: {leaseForm.tenant || 'Not added'}</Text>
              <Text style={styles.previewText}>Rent: {leaseForm.rent || 'Not added'}</Text>
              <Text style={styles.previewText}>Deposit: {leaseForm.deposit || 'No deposit recorded'}</Text>
              <Text style={styles.previewText}>Term: {leaseForm.startDate || 'Start date to be confirmed'} to {leaseForm.endDate || 'End date to be confirmed'}</Text>
            </View>
            <View style={styles.formNavRow}>
              <Pressable style={styles.secondaryButton} onPress={goBackInTool}>
                <Ionicons name="chevron-back-outline" size={18} color="#0f766e" />
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={createLease}>
                <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Create lease draft</Text>
              </Pressable>
            </View>
          </View>
        )}
        {isReviewStep && <View style={styles.leaseList}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Lease drafts</Text><Text style={styles.sectionCount}>{leases.length} total</Text></View>
        {leases.length === 0 ? <View style={styles.emptyPanel}><Ionicons name="document-text-outline" size={30} color="#0f766e" /><Text style={styles.formTitle}>No leases yet</Text><Text style={styles.panelHint}>Create a lease draft above, then share it or download a PDF.</Text></View> : leases.map((lease) => {
          const payload = getLeaseReportPayload(lease);
          return (
            <View key={lease.id} style={styles.leaseCard}>
              <View style={styles.cardTopline}><Text style={styles.listingTag}>{lease.status}</Text><Ionicons name={lease.status === 'Completed' ? 'checkmark-done-outline' : 'create-outline'} size={22} color="#0f172a" /></View>
              <Text style={styles.leaseTitle}>{lease.property}</Text>
              <Text style={styles.leaseBody}>This fixed-term residential lease is between {lease.landlord} and {lease.tenant}. Rent is {lease.rent} per month with a deposit of {lease.deposit}. The lease starts {lease.startDate} and ends {lease.endDate}.</Text>
              <View style={styles.previewBox}><Text style={styles.previewTitle}>Agreement preview</Text><Text style={styles.previewText}>Utilities: {lease.utilities}</Text><Text style={styles.previewText}>Pet policy: {lease.petPolicy}</Text><Text style={styles.previewText}>Parking: {lease.parking}</Text></View>
              <View style={styles.signatureRow}>
                <Pressable style={[styles.signatureButton, lease.landlordSigned && styles.signatureButtonDone]} onPress={() => updateLease(lease.id, { landlordSigned: !lease.landlordSigned })}><Ionicons name={lease.landlordSigned ? 'checkmark-circle' : 'pencil-outline'} size={18} color={lease.landlordSigned ? '#ffffff' : '#0f766e'} /><Text style={[styles.signatureText, lease.landlordSigned && styles.signatureTextDone]}>Landlord sign</Text></Pressable>
                <Pressable style={[styles.signatureButton, lease.tenantSigned && styles.signatureButtonDone]} onPress={() => updateLease(lease.id, { tenantSigned: !lease.tenantSigned })}><Ionicons name={lease.tenantSigned ? 'checkmark-circle' : 'pencil-outline'} size={18} color={lease.tenantSigned ? '#ffffff' : '#0f766e'} /><Text style={[styles.signatureText, lease.tenantSigned && styles.signatureTextDone]}>Tenant sign</Text></Pressable>
              </View>
              <View style={styles.leaseActionRow}>
                <Pressable style={styles.primaryButton} onPress={() => shareLease(lease)}><Ionicons name="share-outline" size={18} color="#ffffff" /><Text style={styles.primaryButtonText}>Share lease</Text></Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => downloadReportPdf(payload)}><Ionicons name="download-outline" size={18} color="#0f766e" /><Text style={styles.secondaryButtonText}>Download PDF</Text></Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => saveReport(payload)}><Ionicons name="bookmark-outline" size={18} color="#0f766e" /><Text style={styles.secondaryButtonText}>Save PDF</Text></Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => emailReport(payload)}><Ionicons name="mail-outline" size={18} color="#0f766e" /><Text style={styles.secondaryButtonText}>Email PDF</Text></Pressable>
                <Pressable style={styles.dangerButton} onPress={() => deleteLease(lease.id)}><Ionicons name="trash-outline" size={18} color="#b91c1c" /><Text style={styles.dangerButtonText}>Delete</Text></Pressable>
              </View>
            </View>
          );
        })}
        </View>}
      </View>
    );
  };

  if (activeTool) {
    return (
      <ScrollView contentContainerStyle={[styles.screenContent, styles.toolFullScreen]} showsVerticalScrollIndicator={false}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderCopy}>
            <Text style={styles.pageTitle}>{selectedTool?.title}</Text>
            <Text style={styles.subtitle}>{selectedTool?.subtitle}</Text>
          </View>
          <Ionicons name={selectedTool?.icon || 'construct-outline'} size={30} color="#0f766e" />
        </View>
        <View style={styles.toolNavRow}>
          <Pressable style={styles.secondaryButton} onPress={closeTool}><Ionicons name="home-outline" size={18} color="#0f766e" /><Text style={styles.secondaryButtonText}>Home</Text></Pressable>
          <Pressable style={styles.secondaryButton} onPress={goBackInTool}><Ionicons name="chevron-back-outline" size={18} color="#0f766e" /><Text style={styles.secondaryButtonText}>Back</Text></Pressable>
          <Pressable style={styles.secondaryButton} onPress={restartTool}><Ionicons name="refresh-outline" size={18} color="#0f766e" /><Text style={styles.secondaryButtonText}>Restart</Text></Pressable>
          <Pressable style={styles.dangerButton} onPress={closeTool}><Ionicons name="close-outline" size={18} color="#b91c1c" /><Text style={styles.dangerButtonText}>Cancel</Text></Pressable>
        </View>
        <View style={styles.activeToolPanel}>{activeTool === 'leases' ? renderLeaseTool() : renderCalculator()}</View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Tools</Text>
      <Text style={styles.subtitle}>Run financing, insurance, project, and lease calculators without leaving HomeSwipe.</Text>
      <View style={styles.toolsTableGrid}>
        {toolCatalog.map((tool) => (
          <Pressable key={tool.key} style={styles.toolTableButton} onPress={() => openTool(tool.key)}>
            <Ionicons name={tool.icon} size={22} color="#0f766e" />
            <View style={styles.messageCopy}><Text style={styles.toolTableTitle}>{tool.title}</Text><Text style={styles.toolTableSubtitle}>{tool.subtitle}</Text></View>
          </Pressable>
        ))}
      </View>
      {savedReports.length > 0 && <View style={styles.formPanel}><Text style={styles.formTitle}>Saved to Profile</Text>{savedReports.slice(0, 5).map((report) => <Text key={report.id} style={styles.previewText}>{report.title} · {report.createdAt}</Text>)}</View>}
    </ScrollView>
  );
}

function LeaseInput({
  label,
  multiline,
  onChangeText,
  value
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        style={[styles.formInput, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

function ToolValueInput({
  helper,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  value
}: {
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  value: string;
}) {
  return (
    <View style={styles.toolValueInputGroup}>
      <Text style={styles.toolValueInputLabel}>{label}</Text>
      {helper ? <Text style={styles.toolValueInputHelper}>{helper}</Text> : null}
      <View style={styles.toolValueInputShell}>
        {prefix ? <Text style={styles.toolValueInputAdornment}>{prefix}</Text> : null}
        <TextInput
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor="#94a3b8"
          style={styles.toolValueInput}
          value={value}
        />
        {suffix ? <Text style={styles.toolValueInputAdornment}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function ToolDateInput({
  label,
  onChangeText,
  value
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.toolValueInputGroup}>
      <Text style={styles.toolValueInputLabel}>{label}</Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={value}
          onChange={(event) => onChangeText(event.currentTarget.value)}
          style={{
            minHeight: 50,
            width: '100%',
            maxWidth: 360,
            borderRadius: 8,
            border: '1px solid #99f6e4',
            padding: '0 12px',
            color: '#0f172a',
            fontSize: 16,
            fontWeight: 800,
            textAlign: 'center'
          }}
        />
      ) : (
        <ToolValueInput label={label} value={value} onChangeText={onChangeText} placeholder="YYYY-MM-DD" />
      )}
    </View>
  );
}

function MessagesScreen({
  activeConversationId,
  conversations,
  onGoHome,
  onSendMessage,
  setActiveConversationId
}: {
  activeConversationId: string;
  conversations: Conversation[];
  onGoHome: () => void;
  onSendMessage: (conversationId: string, message: string) => void;
  setActiveConversationId: (id: string) => void;
}) {
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || null;
  const [replyText, setReplyText] = useState('');
  const [showConversationProfile, setShowConversationProfile] = useState(false);

  const sendReply = () => {
    if (!activeConversation) {
      return;
    }

    onSendMessage(activeConversation.id, replyText);
    setReplyText('');
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Messages</Text>
      <Text style={styles.subtitle}>Direct communication between landlords and tenants.</Text>
      {conversations.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Ionicons name="chatbubbles-outline" size={30} color="#0f766e" />
          <Text style={styles.formTitle}>No chats yet</Text>
          <Text style={styles.panelHint}>Use Chat now on any home listing to start a real conversation.</Text>
          <Pressable style={styles.primaryButton} onPress={onGoHome}>
            <Ionicons name="home-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Find homes</Text>
          </Pressable>
        </View>
      ) : (
        <>
      <View style={styles.messageList}>
        {conversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            style={[styles.messageRow, activeConversation?.id === conversation.id && styles.messageRowActive]}
            onPress={() => {
              setActiveConversationId(conversation.id);
              setShowConversationProfile(false);
            }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{conversation.person.charAt(0)}</Text>
            </View>
            <View style={styles.messageCopy}>
              <View style={styles.messageMeta}>
                <Text style={styles.messageName}>{conversation.person}</Text>
                <Text style={styles.messageTime}>{conversation.time}</Text>
              </View>
              <Text numberOfLines={2} style={styles.messageText}>
                {conversation.messages[conversation.messages.length - 1]}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {activeConversation ? (
        <View style={styles.inboxPanel}>
          <Pressable style={styles.panelHeader} onPress={() => setShowConversationProfile((value) => !value)}>
            <View>
              <Text style={styles.formTitle}>{activeConversation.person}</Text>
              <Text style={styles.panelHint}>
                {activeConversation.role} · {activeConversation.listingTitle}
              </Text>
            </View>
            <Ionicons name={showConversationProfile ? 'chevron-up-outline' : 'person-circle-outline'} size={26} color="#0f766e" />
          </Pressable>
          {showConversationProfile && <PublicProfileCard profile={activeConversation.profile || getConversationFallbackProfile(activeConversation)} />}
          <Pressable style={styles.secondaryButton} onPress={() => setActiveConversationId('')}>
            <Ionicons name="chevron-back-outline" size={18} color="#0f766e" />
            <Text style={styles.secondaryButtonText}>Chats</Text>
          </Pressable>
          {activeConversation.messages.map((message, index) => (
            <View key={`${activeConversation.id}-${index}`} style={styles.chatBubble}>
              <Text style={styles.chatText}>{message}</Text>
            </View>
          ))}
          <View style={styles.replyBar}>
            <TextInput
              onChangeText={setReplyText}
              onSubmitEditing={sendReply}
              placeholder="Write a reply"
              placeholderTextColor="#94a3b8"
              returnKeyType="send"
              style={styles.replyInput}
              value={replyText}
            />
            <Pressable style={styles.replyButton} accessibilityLabel="Send reply" onPress={sendReply}>
              <Ionicons name="send-outline" size={20} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.emptyPanel}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#0f766e" />
          <Text style={styles.formTitle}>Open a chat</Text>
          <Text style={styles.panelHint}>Tap any conversation above to view the full message thread.</Text>
        </View>
      )}
        </>
      )}
    </ScrollView>
  );
}

const getConversationFallbackProfile = (conversation: Conversation): PublicProfileSnapshot => ({
  name: conversation.person,
  role: conversation.role,
  verification: 'Listed on HomeSwipe',
  location: conversation.listingTitle,
  primaryLocation: conversation.listingTitle,
  listerType: conversation.role
});

function PublicProfileCard({ profile }: { profile: PublicProfileSnapshot }) {
  const facts = [
    ['Location', profile.location],
    ['Budget', profile.budget],
    ['Employment', profile.employmentStatus],
    ['Primary Location', profile.primaryLocation],
    ['Properties', profile.propertyCount],
    ['Lister Type', profile.listerType]
  ].filter(([, value]) => Boolean(value));
  const chips = [
    ...(profile.propertyTypes || []),
    ...(profile.amenities || []),
    ...(profile.householdTypes || []),
    ...(profile.leasePreferences || [])
  ];

  return (
    <View style={styles.publicProfileCard}>
      <View style={styles.hostPanel}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitial(profile.name || 'HomeSwipe user')}</Text>
        </View>
        <View style={styles.messageCopy}>
          <Text style={styles.messageName}>{profile.name || 'HomeSwipe user'}</Text>
          <Text style={styles.messageText}>{profile.role || 'User'}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{profile.verification || 'Not Verified'}</Text>
        </View>
      </View>
      <View style={styles.toolInputSummaryGrid}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.toolInputSummaryItem}>
            <Text style={styles.toolInputSummaryLabel}>{label}</Text>
            <Text style={styles.toolInputSummaryValue}>{value}</Text>
          </View>
        ))}
      </View>
      {chips.length > 0 && (
        <View style={styles.quickSearchRail}>
          {chips.map((chip) => (
            <View key={chip} style={styles.quickSearchChip}>
              <Text style={styles.quickSearchText}>{chip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ProfileScreen({
  accountProfile,
  applications,
  currentUserEmail,
  currentUserName,
  documents,
  isSignedIn,
  listerOnboarding,
  landlordListings,
  listings,
  onboardingRole,
  savedListings,
  savedToolReports,
  signUpMethod,
  tenantOnboarding,
  verificationRole,
  onMessageListing,
  onAddListing,
  onOpenListing,
  onToggleSavedListing,
  onDeleteListing,
  onSubmitListingToolApplication,
  onRequireAuth,
  onSetVerificationRole,
  onSignOut,
  onUploadVerificationDocument,
  onUpdateAccountProfile,
  onUpdateListing
}: {
  accountProfile: AccountProfileInput;
  applications: RentalApplication[];
  currentUserEmail: string;
  currentUserName: string;
  documents: VerificationDocument[];
  isSignedIn: boolean;
  listerOnboarding: ListerOnboardingInput;
  landlordListings: Listing[];
  listings: Listing[];
  onboardingRole: OnboardingRole | null;
  savedListings: Listing[];
  savedToolReports: SavedToolReport[];
  signUpMethod: string;
  tenantOnboarding: TenantOnboardingInput;
  verificationRole: VerificationRole;
  onMessageListing: (listing: Listing) => void;
  onAddListing: () => void;
  onOpenListing: (listing: Listing) => void;
  onToggleSavedListing: (listingId: string) => void;
  onDeleteListing: (listingId: string) => void;
  onSubmitListingToolApplication: (label: string, payload: ReportPayload) => void;
  onRequireAuth: (reason: string) => boolean;
  onSetVerificationRole: (role: VerificationRole) => void;
  onSignOut: () => void;
  onUploadVerificationDocument: (id: string) => void;
  onUpdateAccountProfile: (profile: AccountProfileInput) => void;
  onUpdateListing: (listing: Listing) => void;
}) {
  const [profileView, setProfileView] = useState<ProfileView>('overview');
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [deleteConfirmListingId, setDeleteConfirmListingId] = useState<string | null>(null);
  const [listingDraft, setListingDraft] = useState({
    title: '',
    location: '',
    price: '',
    meta: '',
    description: ''
  });
  const [personalInfo, setPersonalInfo] = useState({
    fullName: accountProfile.fullName || (isSignedIn ? currentUserName : ''),
    phone: accountProfile.phone,
    email: accountProfile.email || currentUserEmail,
    employer: accountProfile.employer,
    monthlyBudget: accountProfile.monthlyBudget
  });
  const [paymentPreferences, setPaymentPreferences] = useState({
    method: 'EcoCash',
    autopay: true,
    receipts: true
  });
  const hasUploadedAllDocuments = documents.every((document) => document.status === 'Verified');
  const uploadedDocumentCount = documents.filter((document) => document.status === 'Verified').length;
  const verificationStatusLabel = hasUploadedAllDocuments ? 'Verified' : uploadedDocumentCount > 0 ? 'In progress' : 'Not verified';

  const activeTitle =
    profileView === 'overview'
      ? 'Profile'
      : profileView === 'landlordListings'
        ? 'My homes'
        : profileView === 'saved'
          ? 'Saved'
            : profileView === 'applications'
              ? 'Applications'
            : profileView === 'rating'
              ? 'Reviews'
              : profileView === 'personal'
                ? 'Personal information'
                : profileView === 'documents'
                  ? 'Verification documents'
                  : profileView === 'support'
                    ? 'Support'
                    : 'Payment preferences';
  const profileDisplayName = isSignedIn ? currentUserName : 'Guest';
  const profileInitial = getInitial(profileDisplayName);

  useEffect(() => {
    setPersonalInfo({
      fullName: accountProfile.fullName || (isSignedIn ? currentUserName : ''),
      phone: accountProfile.phone,
      email: accountProfile.email || currentUserEmail,
      employer: accountProfile.employer,
      monthlyBudget: accountProfile.monthlyBudget
    });
  }, [accountProfile, currentUserEmail, currentUserName, isSignedIn]);

  const getListingForApplication = (application: RentalApplication) => {
    return listings.find((listing) => listing.id === application.listingId);
  };

  const startEditingListing = (listing: Listing) => {
    if (!onRequireAuth('Sign in to edit and manage your published listings.')) {
      return;
    }

    setEditingListingId(listing.id);
    setDeleteConfirmListingId(null);
    setListingDraft({
      title: listing.title,
      location: listing.location,
      price: listing.price.replace(/[^0-9.]/g, ''),
      meta: listing.meta,
      description: listing.description
    });
  };

  const saveListingChanges = (listing: Listing) => {
    const priceNumber = listingDraft.price.replace(/[^0-9.]/g, '').trim();
    const updatedListing = {
      ...listing,
      title: listingDraft.title.trim() || listing.title,
      location: listingDraft.location.trim() || listing.location,
      price: priceNumber ? `$${priceNumber}` : listing.price,
      meta: listingDraft.meta.trim() || listing.meta,
      description: listingDraft.description.trim() || listing.description
    };

    onUpdateListing(updatedListing);
    setEditingListingId(null);
  };

  const requestDeleteListing = (listingId: string) => {
    if (!onRequireAuth('Sign in to delete listings from your landlord dashboard.')) {
      return;
    }

    if (deleteConfirmListingId === listingId) {
      onDeleteListing(listingId);
      setDeleteConfirmListingId(null);
      return;
    }

    setEditingListingId(null);
    setDeleteConfirmListingId(listingId);
  };

  const savePersonalInfo = () => {
    onUpdateAccountProfile({
      ...accountProfile,
      fullName: personalInfo.fullName.trim(),
      email: personalInfo.email.trim(),
      phone: personalInfo.phone.trim(),
      employer: personalInfo.employer.trim(),
      monthlyBudget: personalInfo.monthlyBudget.trim(),
      password: '',
      forgotPasswordMessage: ''
    });
    setProfileView('overview');
  };

  const emailSupport = (subject: string, body: string) => {
    const url = `mailto:homeswipelistings@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
      return;
    }

    Linking.openURL(url).catch(() => undefined);
  };

  if (!isSignedIn) {
    return (
      <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.emptyPanel}>
          <Ionicons name="lock-closed-outline" size={30} color="#0f766e" />
          <Text style={styles.formTitle}>Sign in to view your profile</Text>
          <Text style={styles.panelHint}>Your profile, saved chats, applications, documents, and listings are private to your HomeSwipe account.</Text>
          <Pressable style={styles.primaryButton} onPress={() => onRequireAuth('Sign in to view and update your HomeSwipe profile.')}>
            <Ionicons name="person-circle-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      {profileView !== 'overview' && (
        <Pressable style={styles.profileBackButton} onPress={() => setProfileView('overview')}>
          <Ionicons name="chevron-back-outline" size={20} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>Profile</Text>
        </Pressable>
      )}

      <View style={styles.profileHeader}>
        <View style={styles.profileInitialAvatar}>
          <Text style={styles.profileInitialText}>{profileInitial}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{profileDisplayName}</Text>
          <Text style={styles.profileRole}>{isSignedIn ? activeTitle : 'Guest profile'}</Text>
        </View>
        <Pressable style={styles.iconButton} accessibilityLabel={isSignedIn ? 'Sign out' : 'Edit profile'} onPress={isSignedIn ? onSignOut : () => setProfileView('personal')}>
          <Ionicons name={isSignedIn ? 'log-out-outline' : 'pencil-outline'} size={20} color="#0f172a" />
        </Pressable>
      </View>

      {profileView === 'overview' && (
        <>
          <View style={styles.profileStats}>
            <Pressable style={styles.statBlock} onPress={() => setProfileView('saved')}>
              <Text style={styles.statValue}>{savedListings.length}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </Pressable>
            <Pressable style={styles.statBlock} onPress={() => setProfileView('applications')}>
              <Text style={styles.statValue}>{applications.length}</Text>
              <Text style={styles.statLabel}>Applications</Text>
            </Pressable>
            <Pressable style={styles.statBlock} onPress={() => setProfileView('landlordListings')}>
              <Text style={styles.statValue}>{landlordListings.length}</Text>
              <Text style={styles.statLabel}>My homes</Text>
            </Pressable>
          </View>

          <View style={styles.formPanel}>
            <Pressable style={styles.panelHeader} onPress={() => setShowProfileInfo((visible) => !visible)}>
              <View>
                <Text style={styles.formTitle}>Profile information</Text>
                <Text style={styles.panelHint}>Tap to view onboarding and verification details.</Text>
              </View>
              <Ionicons name={showProfileInfo ? 'chevron-up-outline' : 'chevron-down-outline'} size={26} color="#0f766e" />
            </Pressable>
            {showProfileInfo && (
              <View style={styles.toolInputSummaryGrid}>
                <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Signup</Text><Text style={styles.toolInputSummaryValue}>{signUpMethod}</Text></View>
                <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Email</Text><Text style={styles.toolInputSummaryValue}>{accountProfile.email || currentUserEmail || 'Not provided'}</Text></View>
                <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Role</Text><Text style={styles.toolInputSummaryValue}>{verificationRole}</Text></View>
                <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Verification</Text><Text style={styles.toolInputSummaryValue}>{documents.every((document) => document.status === 'Verified') ? 'Verified' : 'Pending'}</Text></View>
                {onboardingRole === 'tenant' ? (
                  <>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>City</Text><Text style={styles.toolInputSummaryValue}>{tenantOnboarding.city || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Budget</Text><Text style={styles.toolInputSummaryValue}>{tenantOnboarding.budget || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Property Types</Text><Text style={styles.toolInputSummaryValue}>{tenantOnboarding.propertyTypes.join(', ') || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Amenities</Text><Text style={styles.toolInputSummaryValue}>{tenantOnboarding.amenities.join(', ') || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Employment</Text><Text style={styles.toolInputSummaryValue}>{tenantOnboarding.employmentStatus || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Household</Text><Text style={styles.toolInputSummaryValue}>{tenantOnboarding.householdTypes.join(', ') || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Lease Preference</Text><Text style={styles.toolInputSummaryValue}>{tenantOnboarding.leasePreferences.join(', ') || 'Not provided'}</Text></View>
                  </>
                ) : (
                  <>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Location</Text><Text style={styles.toolInputSummaryValue}>{listerOnboarding.primaryLocation || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Properties</Text><Text style={styles.toolInputSummaryValue}>{listerOnboarding.propertyCount || 'Not provided'}</Text></View>
                    <View style={styles.toolInputSummaryItem}><Text style={styles.toolInputSummaryLabel}>Lister Type</Text><Text style={styles.toolInputSummaryValue}>{listerOnboarding.listerType || 'Not provided'}</Text></View>
                  </>
                )}
              </View>
            )}
          </View>

          <View style={styles.settingsList}>
            {[
              { key: 'personal' as const, label: 'Personal information' },
              { key: 'landlordListings' as const, label: 'My homes' },
              { key: 'documents' as const, label: 'Verification documents' },
              { key: 'support' as const, label: 'Support' },
              { key: 'payments' as const, label: 'Payment preferences' }
            ].map((item) => (
              <Pressable key={item.key} style={styles.settingRow} onPress={() => setProfileView(item.key)}>
                <Text style={styles.settingText}>{item.label}</Text>
                <Ionicons name="chevron-forward-outline" size={22} color="#94a3b8" />
              </Pressable>
            ))}
          </View>
          {savedToolReports.length > 0 && (
            <View style={styles.formPanel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.formTitle}>Saved PDFs and reports</Text>
                  <Text style={styles.panelHint}>Calculator and lease reports saved from Tools.</Text>
                </View>
                <Ionicons name="folder-open-outline" size={26} color="#0f766e" />
              </View>
              {savedToolReports.slice(0, 5).map((report) => (
                <View key={report.id} style={styles.savedSearchRow}>
                  <Ionicons name="document-text-outline" size={20} color="#0f766e" />
                  <Text style={styles.settingText}>{report.title}</Text>
                  <Text style={styles.messageTime}>{report.createdAt}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {profileView === 'landlordListings' && (
        <View style={styles.profileSection}>
          <Pressable style={styles.primaryButton} onPress={onAddListing}>
            <Ionicons name="add-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Add home</Text>
          </Pressable>
          {landlordListings.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Ionicons name="business-outline" size={30} color="#0f766e" />
              <Text style={styles.formTitle}>No homes yet</Text>
              <Text style={styles.panelHint}>Add rentals, homes for sale, or stands here. You can edit or delete them from this profile area.</Text>
            </View>
          ) : (
            landlordListings.map((listing) => {
              const isEditing = editingListingId === listing.id;
              return (
                <View key={listing.id} style={styles.applicationCard}>
                  <View style={styles.cardTopline}>
                    <Text style={styles.listingTag}>{listing.tag}</Text>
                    <Text style={styles.messageTime}>{listing.kind}</Text>
                  </View>
                  {isEditing ? (
                    <>
                      <TextInput
                        placeholder="Listing title"
                        placeholderTextColor="#94a3b8"
                        value={listingDraft.title}
                        onChangeText={(title) => setListingDraft((current) => ({ ...current, title }))}
                        style={styles.formInput}
                      />
                      <TextInput
                        placeholder="Precise location"
                        placeholderTextColor="#94a3b8"
                        value={listingDraft.location}
                        onChangeText={(location) => setListingDraft((current) => ({ ...current, location }))}
                        style={styles.formInput}
                      />
                      <View style={styles.priceInputShell}>
                        <Text style={styles.pricePrefix}>$</Text>
                        <TextInput
                          keyboardType="numeric"
                          placeholder="850"
                          placeholderTextColor="#94a3b8"
                          value={listingDraft.price}
                          onChangeText={(price) => setListingDraft((current) => ({ ...current, price: price.replace(/[^0-9.]/g, '') }))}
                          style={styles.priceInput}
                        />
                      </View>
                      <TextInput
                        placeholder="Summary"
                        placeholderTextColor="#94a3b8"
                        value={listingDraft.meta}
                        onChangeText={(meta) => setListingDraft((current) => ({ ...current, meta }))}
                        style={styles.formInput}
                      />
                      <TextInput
                        multiline
                        placeholder="Description"
                        placeholderTextColor="#94a3b8"
                        value={listingDraft.description}
                        onChangeText={(description) => setListingDraft((current) => ({ ...current, description }))}
                        style={[styles.formInput, styles.multilineInput]}
                      />
                      <View style={styles.profileActionRow}>
                        <Pressable style={styles.primaryButton} onPress={() => saveListingChanges(listing)}>
                          <Ionicons name="save-outline" size={18} color="#ffffff" />
                          <Text style={styles.primaryButtonText}>Save changes</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => setEditingListingId(null)}>
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.leaseTitle}>{listing.title}</Text>
                      <Text style={styles.messageText}>{listing.location}</Text>
                      <Text style={styles.listingPrice}>{listing.price}</Text>
                      <ListingFinancePanel
                        currentUserEmail={currentUserEmail}
                        currentUserName={currentUserName}
                        listing={listing}
                        monthlyIncomeEstimate={0}
                        onboardingRole="lister"
                        onSubmitListingToolApplication={onSubmitListingToolApplication}
                      />
                      <View style={styles.profileActionRow}>
                        <Pressable style={styles.secondaryButton} onPress={() => onOpenListing(listing)}>
                          <Ionicons name="eye-outline" size={18} color="#0f766e" />
                          <Text style={styles.secondaryButtonText}>View</Text>
                        </Pressable>
                        <Pressable style={styles.primaryButton} onPress={() => startEditingListing(listing)}>
                          <Ionicons name="create-outline" size={18} color="#ffffff" />
                          <Text style={styles.primaryButtonText}>Edit listing</Text>
                        </Pressable>
                        <Pressable style={styles.dangerButton} onPress={() => requestDeleteListing(listing.id)}>
                          <Ionicons name={deleteConfirmListingId === listing.id ? 'alert-circle-outline' : 'trash-outline'} size={18} color="#b91c1c" />
                          <Text style={styles.dangerButtonText}>{deleteConfirmListingId === listing.id ? 'Confirm delete' : 'Delete'}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {profileView === 'saved' && (
        <View style={styles.profileSection}>
          {savedListings.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Ionicons name="heart-outline" size={30} color="#0f766e" />
              <Text style={styles.formTitle}>No saved homes yet</Text>
              <Text style={styles.panelHint}>Tap the heart on any listing to keep it here.</Text>
            </View>
          ) : (
            <View style={styles.listGrid}>
              {savedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  isSaved
                  listing={listing}
                  onPress={() => onOpenListing(listing)}
                  onToggleSaved={() => onToggleSavedListing(listing.id)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {profileView === 'applications' && (
        <View style={styles.profileSection}>
          {applications.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Ionicons name="document-text-outline" size={30} color="#0f766e" />
              <Text style={styles.formTitle}>No applications yet</Text>
              <Text style={styles.panelHint}>When you request a viewing or submit an application, it will appear here.</Text>
            </View>
          ) : (
            applications.map((application) => {
              const listing = getListingForApplication(application);
              return (
                <View key={application.id} style={styles.applicationCard}>
                  <View style={styles.cardTopline}>
                    <Text style={styles.listingTag}>{application.status}</Text>
                    <Text style={styles.messageTime}>{application.submitted}</Text>
                  </View>
                  <Text style={styles.leaseTitle}>{application.property}</Text>
                  <Text style={styles.messageText}>{application.nextStep}</Text>
                  <View style={styles.profileActionRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        if (Platform.OS === 'web' && typeof window !== 'undefined') {
                          window.location.href = `mailto:homeswipelistings@gmail.com?subject=${encodeURIComponent(`HomeSwipe Application ${application.id}`)}`;
                        }
                      }}
                    >
                      <Ionicons name="mail-outline" size={18} color="#0f766e" />
                      <Text style={styles.secondaryButtonText}>Email review team</Text>
                    </Pressable>
                    {listing && (
                      <Pressable style={styles.secondaryButton} onPress={() => onOpenListing(listing)}>
                        <Ionicons name="home-outline" size={18} color="#0f766e" />
                        <Text style={styles.secondaryButtonText}>View home</Text>
                      </Pressable>
                    )}
                    {listing && (
                      <Pressable style={styles.primaryButton} onPress={() => onMessageListing(listing)}>
                        <Ionicons name="chatbubble-outline" size={18} color="#ffffff" />
                        <Text style={styles.primaryButtonText}>Message</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {profileView === 'rating' && (
        <View style={styles.profileSection}>
          <View style={styles.emptyPanel}>
            <Ionicons name="star-outline" size={30} color="#0f766e" />
            <Text style={styles.formTitle}>No reviews yet</Text>
            <Text style={styles.panelHint}>Reviews will appear after completed conversations, viewings, leases, or property transactions.</Text>
          </View>
        </View>
      )}

      {profileView === 'personal' && (
        <View style={styles.formPanel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderCopy}>
              <Text style={styles.formTitle}>Your details</Text>
              <Text style={styles.panelHint}>Only your signed-in account can read or update this profile.</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={24} color="#0f766e" />
          </View>
          <LeaseInput label="Full name" value={personalInfo.fullName} onChangeText={(fullName) => setPersonalInfo((current) => ({ ...current, fullName }))} />
          <LeaseInput label="Phone" value={personalInfo.phone} onChangeText={(phone) => setPersonalInfo((current) => ({ ...current, phone }))} />
          <LeaseInput label="Email" value={personalInfo.email} onChangeText={(email) => setPersonalInfo((current) => ({ ...current, email }))} />
          <LeaseInput label="Employer" value={personalInfo.employer} onChangeText={(employer) => setPersonalInfo((current) => ({ ...current, employer }))} />
          <LeaseInput label="Monthly budget" value={personalInfo.monthlyBudget} onChangeText={(monthlyBudget) => setPersonalInfo((current) => ({ ...current, monthlyBudget }))} />
          <Pressable style={styles.primaryButton} onPress={savePersonalInfo}>
            <Ionicons name="save-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Save profile</Text>
          </Pressable>
        </View>
      )}

      {profileView === 'documents' && (
        <View style={styles.profileSection}>
          <View style={styles.formPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderCopy}>
                <Text style={styles.formTitle}>Verification documents</Text>
                <Text style={styles.panelHint}>Upload only the documents required for your HomeSwipe role. Your profile becomes verified after every required item is uploaded.</Text>
              </View>
              <View style={[styles.statusPill, hasUploadedAllDocuments && styles.statusPillVerified]}>
                <Ionicons name={hasUploadedAllDocuments ? 'shield-checkmark-outline' : 'shield-outline'} size={16} color={hasUploadedAllDocuments ? '#2563eb' : '#0f766e'} />
                <Text style={[styles.statusPillText, hasUploadedAllDocuments && styles.statusPillTextVerified]}>{verificationStatusLabel}</Text>
              </View>
            </View>
            <View style={styles.verificationStack}>
              <Text style={styles.previewTitle}>I am a</Text>
              {verificationRoles.map((role) => (
                <Pressable
                  key={role}
                  style={[styles.roleChoice, verificationRole === role && styles.roleChoiceSelected]}
                  onPress={() => onSetVerificationRole(role)}
                >
                  <Ionicons name={verificationRole === role ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={verificationRole === role ? '#ffffff' : '#0f766e'} />
                  <Text style={[styles.roleChoiceText, verificationRole === role && styles.roleChoiceTextSelected]}>{role}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {documents.map((document) => (
            <View key={document.id} style={styles.documentRow}>
              <View style={styles.toolIcon}>
                <Ionicons name={document.status === 'Verified' ? 'shield-checkmark-outline' : 'document-attach-outline'} size={22} color="#0f766e" />
              </View>
              <View style={styles.messageCopy}>
                <View style={styles.cardTopline}>
                  <Text style={styles.messageName}>{document.title}</Text>
                  <Text style={[styles.riskBadge, document.status === 'Verified' && styles.riskBadgeVerified]}>{document.status}</Text>
                </View>
                <Text style={styles.messageText}>{document.standard}</Text>
                {document.fileName && <Text style={styles.documentStatus}>Uploaded: {document.fileName}</Text>}
                <Text style={styles.documentStatus}>{verificationRole}</Text>
              </View>
              {document.status !== 'Verified' && (
                <Pressable style={styles.secondaryButton} onPress={() => onUploadVerificationDocument(document.id)}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#0f766e" />
                  <Text style={styles.secondaryButtonText}>Upload</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {profileView === 'support' && (
        <View style={styles.profileSection}>
          <View style={styles.formPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderCopy}>
                <Text style={styles.formTitle}>HomeSwipe Support</Text>
                <Text style={styles.panelHint}>Get help with listings, verification, applications, payments, or account access.</Text>
              </View>
              <Ionicons name="help-buoy-outline" size={26} color="#0f766e" />
            </View>
          </View>

          {[
            {
              icon: 'mail-outline' as const,
              title: 'Email support',
              subtitle: 'homeswipelistings@gmail.com',
              subject: 'HomeSwipe Support',
              body: 'Hi HomeSwipe Support,\n\nI need help with: '
            },
            {
              icon: 'home-outline' as const,
              title: 'Listing help',
              subtitle: 'Get support adding, editing, deleting, or managing homes.',
              subject: 'HomeSwipe Listing Help',
              body: 'Hi HomeSwipe Support,\n\nI need help with my listing.\n\nIssue: '
            },
            {
              icon: 'shield-checkmark-outline' as const,
              title: 'Verification help',
              subtitle: 'Ask about optional verification and uploaded documents.',
              subject: 'HomeSwipe Verification Help',
              body: 'Hi HomeSwipe,\n\nI need help with verification documents.'
            }
          ].map((item) => (
            <Pressable
              key={item.title}
              style={styles.settingRow}
              onPress={() => {
                emailSupport(item.subject, item.body);
              }}
            >
              <Ionicons name={item.icon} size={22} color="#0f766e" />
              <View style={styles.messageCopy}>
                <Text style={styles.settingText}>{item.title}</Text>
                <Text style={styles.messageText}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={22} color="#94a3b8" />
            </Pressable>
          ))}
        </View>
      )}

      {profileView === 'payments' && (
        <View style={styles.formPanel}>
          <LeaseInput
            label="Preferred payment method"
            value={paymentPreferences.method}
            onChangeText={(method) => setPaymentPreferences((current) => ({ ...current, method }))}
          />
          <Pressable
            style={styles.settingRow}
            onPress={() => setPaymentPreferences((current) => ({ ...current, autopay: !current.autopay }))}
          >
            <Text style={styles.settingText}>Automatic rent reminders</Text>
            <Ionicons name={paymentPreferences.autopay ? 'toggle' : 'toggle-outline'} size={30} color="#0f766e" />
          </Pressable>
          <Pressable
            style={styles.settingRow}
            onPress={() => setPaymentPreferences((current) => ({ ...current, receipts: !current.receipts }))}
          >
            <Text style={styles.settingText}>Email receipts</Text>
            <Ionicons name={paymentPreferences.receipts ? 'toggle' : 'toggle-outline'} size={30} color="#0f766e" />
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  appShell: {
    flex: 1,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center'
  },
  screenContent: {
    padding: 20,
    paddingBottom: 110
  },
  onboardingContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    gap: 18,
    padding: 20,
    paddingBottom: 42
  },
  onboardingProgress: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6
  },
  onboardingProgressBar: {
    flex: 1,
    height: 5,
    borderRadius: 8,
    backgroundColor: '#dbeafe'
  },
  onboardingProgressBarActive: {
    backgroundColor: '#0f766e'
  },
  onboardingCard: {
    gap: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  onboardingChoiceGrid: {
    flexDirection: 'column',
    gap: 10
  },
  onboardingChoice: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#ffffff'
  },
  onboardingChoiceSelected: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e'
  },
  onboardingChoiceText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800'
  },
  onboardingChoiceTextSelected: {
    color: '#ffffff'
  },
  onboardingActionButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#ffffff'
  },
  onboardingActionButtonSelected: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e'
  },
  onboardingActionText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900'
  },
  onboardingActionTextSelected: {
    color: '#ffffff'
  },
  welcomeHero: {
    height: 380,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#0f172a'
  },
  welcomeHeroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  welcomeHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.34)'
  },
  welcomeHeroCopy: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 24,
    gap: 14
  },
  welcomeBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  welcomeBrandText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900'
  },
  welcomeHeroTitle: {
    color: '#ffffff',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '400'
  },
  onboardingDocumentRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc'
  },
  onboardingReady: {
    minHeight: 420,
    justifyContent: 'center',
    gap: 14
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18
  },
  brand: {
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '800'
  },
  pageTitle: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 640
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  addHomeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0f766e'
  },
  addHomeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  authOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.42)'
  },
  authPanel: {
    width: '100%',
    maxWidth: 440,
    gap: 12,
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#ffffff'
  },
  authModeRow: {
    flexDirection: 'row',
    gap: 8
  },
  authModeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#e2e8f0'
  },
  authModeButtonActive: {
    backgroundColor: '#0f766e'
  },
  authModeText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800'
  },
  authModeTextActive: {
    color: '#ffffff'
  },
  googleButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  googleButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900'
  },
  formPanel: {
    gap: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 18
  },
  listingFormScreen: {
    gap: 14,
    flexGrow: 1,
    minHeight: Platform.OS === 'web' ? 640 : undefined,
    paddingTop: 4,
    paddingBottom: 24
  },
  formTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900'
  },
  publishError: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2'
  },
  publishErrorText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '800'
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  formField: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 220 : undefined,
    gap: 6
  },
  formFieldFull: {
    gap: 6
  },
  formLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900'
  },
  formInput: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 220 : undefined,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 15
  },
  priceInputShell: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 220 : undefined,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  pricePrefix: {
    paddingLeft: 12,
    paddingRight: 4,
    color: '#0f766e',
    fontSize: 16,
    fontWeight: '900'
  },
  priceInput: {
    flex: 1,
    minHeight: 44,
    paddingRight: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 15
  },
  ruleBuilder: {
    gap: 10
  },
  ruleList: {
    gap: 8
  },
  ruleRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#f0fdfa'
  },
  ruleText: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  featureOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa'
  },
  featureOptionActive: {
    borderColor: '#0f766e',
    backgroundColor: '#0f766e'
  },
  featureText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900'
  },
  featureTextActive: {
    color: '#ffffff'
  },
  generatedSummary: {
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#f0fdfa'
  },
  generatedSummaryText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21
  },
  multilineInput: {
    minHeight: 82,
    textAlignVertical: 'top'
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0f766e'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900'
  },
  disabledButton: {
    opacity: 0.64
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 38
  },
  clearSearchButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  filterButton: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#0f766e'
  },
  filterCountBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#e11d48',
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  filterCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900'
  },
  quickSearchRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  searchAssistPanel: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    marginBottom: 16
  },
  searchAssistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  searchAssistTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900'
  },
  searchAssistHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700'
  },
  quickSearchChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f8fafc'
  },
  quickSearchChipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#0f766e'
  },
  quickSearchText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900'
  },
  quickSearchTextActive: {
    color: '#ffffff'
  },
  filterPanel: {
    gap: 12,
    padding: 16,
    marginBottom: 18,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#e2e8f0'
  },
  segmentButtonActive: {
    backgroundColor: '#0f766e'
  },
  segmentText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700'
  },
  segmentTextActive: {
    color: '#ffffff'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800'
  },
  sectionCount: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700'
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  loadMoreButton: {
    alignSelf: 'center',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa'
  },
  listingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '48%',
    flexGrow: 1,
    flexBasis: Platform.OS === 'web' ? 260 : '47%',
    maxWidth: Platform.OS === 'web' ? 560 : '49%'
  },
  listingImage: {
    width: '100%',
    aspectRatio: 1.28,
    backgroundColor: '#cbd5e1'
  },
  cardBody: {
    padding: 10
  },
  cardTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6
  },
  cardActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  listingTag: {
    flex: 1,
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  listingTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 19
  },
  listingLocation: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 6
  },
  listingMeta: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10
  },
  matchPill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#f0fdfa'
  },
  matchText: {
    flex: 1,
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900'
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  listingPrice: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900'
  },
  hostName: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700'
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  detailScreenContent: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center'
  },
  detailBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 8
  },
  photoGallery: {
    gap: 10,
    marginBottom: 20
  },
  heroPhoto: {
    width: '100%',
    aspectRatio: 1.55,
    maxHeight: 520,
    borderRadius: 8,
    backgroundColor: '#cbd5e1'
  },
  thumbnailGrid: {
    flexDirection: 'row',
    gap: 10
  },
  thumbnailPhoto: {
    flex: 1,
    aspectRatio: 1.25,
    borderRadius: 8,
    backgroundColor: '#cbd5e1'
  },
  detailTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16
  },
  detailTitleCopy: {
    flex: 1,
    minWidth: 240
  },
  detailTitle: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34
  },
  detailLocation: {
    color: '#475569',
    fontSize: 16,
    marginTop: 5,
    lineHeight: 22
  },
  detailPrice: {
    color: '#0f766e',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    flexShrink: 1
  },
  detailFactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18
  },
  detailFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    maxWidth: '100%',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  detailFactText: {
    flexShrink: 1,
    color: '#334155',
    fontSize: 14,
    fontWeight: '800'
  },
  detailSection: {
    gap: 10,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  detailSectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900'
  },
  detailDescription: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24
  },
  amenityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  amenityRow: {
    width: Platform.OS === 'web' ? '48%' : '100%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  amenityText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700'
  },
  hostPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14
  },
  publicProfileCard: {
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#f8fafc'
  },
  detailActionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  detailActionBarButton: {
    flexGrow: 1,
    flexBasis: 180
  },
  calendarPanel: {
    gap: 12,
    padding: 16,
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  calendarChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#ffffff'
  },
  calendarChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e'
  },
  calendarChipText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900'
  },
  calendarChipTextActive: {
    color: '#ffffff'
  },
  stepRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  stepPill: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e2e8f0'
  },
  stepPillActive: {
    backgroundColor: '#0f766e'
  },
  stepText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900'
  },
  stepTextActive: {
    color: '#ffffff'
  },
  formNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  dropZone: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0f766e',
    backgroundColor: '#f0fdfa'
  },
  dropZoneIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#ccfbf1'
  },
  dropZoneCopy: {
    flex: 1
  },
  dropZoneTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4
  },
  dropZoneText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20
  },
  uploadPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  uploadPreviewItem: {
    position: 'relative',
    width: 112,
    height: 86,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#cbd5e1'
  },
  uploadPreviewImage: {
    width: '100%',
    height: '100%'
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0f172a'
  },
  toolIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ccfbf1'
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 34
  },
  checkText: {
    flex: 1,
    color: '#334155',
    fontSize: 15,
    fontWeight: '700'
  },
  leaseWorkspace: {
    gap: 16,
    marginTop: 18
  },
  toolFullScreen: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    flexGrow: 1
  },
  toolNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16
  },
  toolsTableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16
  },
  toolTableButton: {
    flexGrow: 1,
    flexBasis: Platform.OS === 'web' ? '30%' : '45%',
    minWidth: 210,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#ffffff'
  },
  toolTableButtonActive: {
    borderColor: '#0f766e',
    backgroundColor: '#0f766e'
  },
  toolTableTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900'
  },
  toolTableTitleActive: {
    color: '#ffffff'
  },
  toolTableSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3
  },
  toolTableSubtitleActive: {
    color: '#ccfbf1'
  },
  activeToolPanel: {
    gap: 16,
    marginTop: 16,
    flex: 1
  },
  toolQuestionShell: {
    minHeight: Platform.OS === 'web' ? 340 : 240,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  toolValueInputGroup: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    gap: 7
  },
  toolValueInputLabel: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center'
  },
  toolValueInputHelper: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  },
  toolValueInputShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#ffffff'
  },
  toolValueInputAdornment: {
    paddingHorizontal: 12,
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900'
  },
  toolValueInput: {
    flex: 1,
    minWidth: 120,
    minHeight: 48,
    paddingHorizontal: 12,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center'
  },
  toolResultsPanel: {
    gap: 18,
    padding: Platform.OS === 'web' ? 22 : 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff'
  },
  toolResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  toolResultHero: {
    gap: 10,
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#0f172a'
  },
  toolResultHeroLabel: {
    color: '#99f6e4',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  toolResultHeroValue: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 36 : 28,
    fontWeight: '900'
  },
  toolResultMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6
  },
  toolResultMetaItem: {
    minWidth: 120,
    paddingRight: 14
  },
  toolResultMetaLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  toolResultMetaValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2
  },
  toolSectionBlock: {
    gap: 10
  },
  toolInputSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  toolInputSummaryItem: {
    minWidth: Platform.OS === 'web' ? 180 : 140,
    flexGrow: 1,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  toolInputSummaryLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  toolInputSummaryValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3
  },
  toolResultGrid: {
    gap: 10
  },
  toolResultRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  toolResultLabel: {
    flex: 1,
    color: '#334155',
    fontSize: 14,
    fontWeight: '800'
  },
  toolResultValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right'
  },
  toolActionPanel: {
    gap: 10
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14
  },
  panelHeaderCopy: {
    flex: 1
  },
  panelHint: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4
  },
  inputGroup: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 220 : undefined,
    gap: 6
  },
  inputLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800'
  },
  leaseList: {
    gap: 12
  },
  leaseCard: {
    gap: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  leaseTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900'
  },
  leaseBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21
  },
  previewBox: {
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  previewTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900'
  },
  previewText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19
  },
  verificationStack: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  statusPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#99f6e4'
  },
  statusPillVerified: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  statusPillText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  statusPillTextVerified: {
    color: '#2563eb'
  },
  roleChoice: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#ffffff'
  },
  roleChoiceSelected: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e'
  },
  roleChoiceText: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800'
  },
  roleChoiceTextSelected: {
    color: '#ffffff'
  },
  verificationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  verificationNoteText: {
    flex: 1,
    color: '#075985',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19
  },
  verificationGrid: {
    gap: 10
  },
  signalCard: {
    gap: 8,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  signalStatus: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  signalStatusPass: {
    color: '#047857'
  },
  signalStatusBlocked: {
    color: '#b91c1c'
  },
  signatureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  leaseActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  signatureButton: {
    flex: 1,
    minWidth: 150,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#ffffff'
  },
  signatureButtonDone: {
    backgroundColor: '#0f766e'
  },
  signatureText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900'
  },
  signatureTextDone: {
    color: '#ffffff'
  },
  secondaryButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa'
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900'
  },
  dangerButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2'
  },
  dangerButtonText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '900'
  },
  messageList: {
    gap: 10,
    marginTop: 20
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  messageRowActive: {
    borderColor: '#0f766e',
    backgroundColor: '#f0fdfa'
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#134e4a'
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900'
  },
  messageCopy: {
    flex: 1
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4
  },
  messageName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800'
  },
  messageTime: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700'
  },
  messageText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20
  },
  inboxPanel: {
    gap: 12,
    marginTop: 18,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  chatBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  chatText: {
    color: '#0f172a',
    fontSize: 15,
    lineHeight: 21
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  replyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0f766e'
  },
  profileBackButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20
  },
  profileInitialAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#0f766e'
  },
  profileInitialText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900'
  },
  profileCopy: {
    flex: 1
  },
  profileName: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900'
  },
  profileRole: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 4
  },
  profileStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18
  },
  statBlock: {
    flex: 1,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  statValue: {
    color: '#0f766e',
    fontSize: 24,
    fontWeight: '900'
  },
  statLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4
  },
  settingsList: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  settingRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  settingText: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700'
  },
  profileSection: {
    gap: 12
  },
  emptyPanel: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  applicationCard: {
    gap: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  profileActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  riskBadge: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  riskBadgeHigh: {
    color: '#b91c1c'
  },
  riskBadgeVerified: {
    color: '#2563eb'
  },
  documentStatus: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3
  },
  savedSearchRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  bottomTabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignSelf: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 50,
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: '#ecfeff'
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700'
  },
  tabLabelActive: {
    color: '#0f766e'
  }
});
