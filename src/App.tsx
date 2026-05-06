import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageStyle,
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
  collection,
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
import { db, isFirebaseConfigured } from './firebase';

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
  tag: string;
  description: string;
  amenities: string[];
  details: string[];
};

type ListingForm = {
  kind: ListingKind;
  propertyType: string;
  spaceType: string;
  title: string;
  location: string;
  price: string;
  meta: string;
  host: string;
  image: string;
  photos: string;
  localPhotos: string[];
  description: string;
  amenities: string;
  guests: string;
  bedrooms: string;
  bathrooms: string;
  houseRules: string;
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
  time: string;
  messages: string[];
};

type ApplicationStatus = 'Submitted' | 'Viewing booked' | 'Docs requested';

type RentalApplication = {
  id: string;
  listingId: string;
  property: string;
  landlord: string;
  status: ApplicationStatus;
  submitted: string;
  nextStep: string;
};

type ProfileView = 'overview' | 'saved' | 'applications' | 'rating' | 'personal' | 'documents' | 'searches' | 'payments';

type HomeFilters = {
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  bathrooms: string;
  amenity: string;
  savedOnly: boolean;
};

type FirebaseStatus = 'Not configured' | 'Connecting' | 'Synced' | 'Saving' | 'Offline';

type HomeSwipeData = {
  applications: RentalApplication[];
  conversations: Conversation[];
  savedListingIds: string[];
  savedSearches: string[];
};

const emptyListingForm: ListingForm = {
  kind: 'rentals',
  propertyType: '',
  spaceType: '',
  title: '',
  location: '',
  price: '',
  meta: '',
  host: '',
  image: '',
  photos: '',
  localPhotos: [],
  description: '',
  amenities: '',
  guests: '',
  bedrooms: '',
  bathrooms: '',
  houseRules: ''
};

const initialConversations: Conversation[] = [
  {
    id: 'moyo-properties',
    person: 'Moyo Properties',
    role: 'Landlord',
    listingTitle: 'Sunny 2 bed apartment',
    time: '12:45',
    messages: ['The Borrowdale apartment is open for viewing at 4 PM.']
  },
  {
    id: 'tari-m',
    person: 'Tari M.',
    role: 'Landlord',
    listingTitle: 'Modern garden cottage',
    time: '10:12',
    messages: ['Please send your proof of income for screening.']
  },
  {
    id: 'prime-estates',
    person: 'Prime Estates',
    role: 'Agent',
    listingTitle: 'Family home with pool',
    time: 'Mon',
    messages: ['We can share the title deed docs after registration.']
  }
];

const initialApplications: RentalApplication[] = [
  {
    id: 'application-1',
    listingId: '1',
    property: 'Sunny 2 bed apartment',
    landlord: 'Moyo Properties',
    status: 'Viewing booked',
    submitted: 'May 3, 2026',
    nextStep: 'Attend viewing and confirm proof of income.'
  },
  {
    id: 'application-2',
    listingId: '2',
    property: 'Modern garden cottage',
    landlord: 'Tari Homes',
    status: 'Docs requested',
    submitted: 'May 1, 2026',
    nextStep: 'Upload ID, employment letter, and latest payslip.'
  },
  {
    id: 'application-3',
    listingId: '4',
    property: 'Townhouse near schools',
    landlord: 'Kudu Realty',
    status: 'Submitted',
    submitted: 'April 28, 2026',
    nextStep: 'Waiting for landlord response.'
  }
];

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
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'tools', label: 'Tools', icon: 'construct-outline' },
  { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-circle-outline' }
];

const listingFilters: { key: ListingKind; label: string }[] = [
  { key: 'rentals', label: 'Rentals' },
  { key: 'sales', label: 'For sale' },
  { key: 'stands', label: 'Stands' }
];

const emptyHomeFilters: HomeFilters = {
  minPrice: '',
  maxPrice: '',
  bedrooms: '',
  bathrooms: '',
  amenity: '',
  savedOnly: false
};

const userDataDocId = 'demo-user';
const listingsPageSize = 20;
const compressedImageMaxSize = 1280;

const getNumberFromText = (value: string) => {
  const match = value.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const getListingSearchText = (listing: Listing) => {
  return `${listing.title} ${listing.location} ${listing.meta} ${listing.description} ${listing.amenities.join(' ')} ${listing.details.join(' ')}`.toLowerCase();
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
  const [availableListings, setAvailableListings] = useState<Listing[]>(initialListings);
  const [showListingForm, setShowListingForm] = useState(false);
  const [showHomeFilters, setShowHomeFilters] = useState(false);
  const [homeFilters, setHomeFilters] = useState<HomeFilters>(emptyHomeFilters);
  const [listingForm, setListingForm] = useState<ListingForm>(emptyListingForm);
  const [listingStep, setListingStep] = useState(0);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0].id);
  const [applications, setApplications] = useState<RentalApplication[]>(initialApplications);
  const [savedSearches, setSavedSearches] = useState(['Borrowdale gated 2 bed', 'Avondale furnished cottage', 'Ruwa serviced stand']);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus>(isFirebaseConfigured ? 'Connecting' : 'Not configured');
  const hasLoadedFirebaseData = useRef(!isFirebaseConfigured);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [hasMoreListings, setHasMoreListings] = useState(true);

  const filteredListings = useMemo(() => {
    return availableListings.filter((listing) => {
      const matchesKind = listing.kind === activeKind;
      const searchable = getListingSearchText(listing);
      const matchesQuery = searchable.includes(query.trim().toLowerCase());
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
    });
  }, [activeKind, availableListings, homeFilters, query, savedListingIds]);

  const savedListings = useMemo(() => {
    const knownListings = [...availableListings, ...initialListings].filter(
      (listing, index, listings) => listings.findIndex((item) => item.id === listing.id) === index
    );
    return knownListings.filter((listing) => savedListingIds.includes(listing.id));
  }, [availableListings, savedListingIds]);

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

  useEffect(() => {
    const firestore = db;
    if (!firestore) {
      return;
    }

    const unsubscribe = onSnapshot(
      doc(firestore, 'homeswipeUsers', userDataDocId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<HomeSwipeData>;
          setSavedListingIds(data.savedListingIds || []);
          setConversations(data.conversations?.length ? data.conversations : initialConversations);
          setApplications(data.applications?.length ? data.applications : initialApplications);
          setSavedSearches(data.savedSearches?.length ? data.savedSearches : ['Borrowdale gated 2 bed', 'Avondale furnished cottage', 'Ruwa serviced stand']);
        } else {
          setDoc(doc(firestore, 'homeswipeUsers', userDataDocId), {
            applications,
            conversations,
            savedListingIds,
            savedSearches
          });
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
  }, []);

  const loadListingsPage = async (mode: 'reset' | 'more') => {
    const firestore = db;
    if (!firestore) {
      const localListings = initialListings.filter((listing) => listing.kind === activeKind);
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
      const listings = snapshot.docs.map((listingDoc) => listingDoc.data() as Listing);

      if (mode === 'reset' && snapshot.empty) {
        await Promise.all(
          initialListings.map((listing, index) =>
            setDoc(doc(firestore, 'homeswipeListings', listing.id), {
              ...listing,
              sortOrder: index
            })
          )
        );
        const seededListings = initialListings.filter((listing) => listing.kind === activeKind).slice(0, listingsPageSize);
        setAvailableListings(seededListings);
        setLastListingDoc(null);
        setHasMoreListings(false);
        setFirebaseStatus('Synced');
        return;
      }

      setAvailableListings((currentListings) => {
        const nextListings = mode === 'more' ? [...currentListings, ...listings] : listings;
        return nextListings.filter((listing, index, allListings) => allListings.findIndex((item) => item.id === listing.id) === index);
      });
      setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreListings(snapshot.docs.length === listingsPageSize);
      setFirebaseStatus('Synced');
    } catch {
      const fallbackListings = initialListings.filter((listing) => listing.kind === activeKind);
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
    const firestore = db;
    if (!firestore || !hasLoadedFirebaseData.current) {
      return;
    }

    setFirebaseStatus('Saving');
    setDoc(
      doc(firestore, 'homeswipeUsers', userDataDocId),
      {
        applications,
        conversations,
        savedListingIds,
        savedSearches
      },
      { merge: true }
    )
      .then(() => setFirebaseStatus('Synced'))
      .catch(() => setFirebaseStatus('Offline'));
  }, [applications, conversations, savedListingIds, savedSearches]);

  const addListing = () => {
    const title = listingForm.title.trim();
    const location = listingForm.location.trim();
    const price = listingForm.price.trim();
    const host = listingForm.host.trim();

    if (!title || !location || !price || !host) {
      return;
    }

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
    const details = [
      listingForm.propertyType || 'Home',
      listingForm.spaceType || 'Entire place',
      listingForm.guests ? `${listingForm.guests} guests` : '',
      listingForm.bedrooms ? `${listingForm.bedrooms} bedrooms` : '',
      listingForm.bathrooms ? `${listingForm.bathrooms} bathrooms` : '',
      listingForm.meta.trim()
    ].filter(Boolean);

    const newListing: Listing = {
      id: `${Date.now()}`,
      kind: listingForm.kind,
      title,
      location,
      price,
      meta: listingForm.meta.trim() || 'Details available on request',
      host,
      image: uploadedPhotos[0] || listingForm.image.trim() || fallbackImage,
      photos: [uploadedPhotos[0] || listingForm.image.trim() || fallbackImage, ...uploadedPhotos.slice(1), ...galleryPhotos, fallbackImage],
      tag: listingForm.kind === 'rentals' ? 'New rental' : listingForm.kind === 'sales' ? 'New sale' : 'New stand',
      description: listingForm.description.trim() || `${title} is listed by ${host}. Contact the landlord to confirm viewing times, documents, and availability.`,
      amenities: amenities.length > 0 ? amenities : ['Direct landlord contact', 'Viewing available', 'Saved listing', 'Verified details pending'],
      details: details.length > 0 ? details : [location, price, host]
    };

    setAvailableListings((currentListings) => [newListing, ...currentListings]);
    if (db) {
      setDoc(doc(db, 'homeswipeListings', newListing.id), newListing).catch(() => setFirebaseStatus('Offline'));
    }
    setActiveKind(newListing.kind);
    setListingForm(emptyListingForm);
    setListingStep(0);
    setShowListingForm(false);
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
    const conversationId = listing.host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || listing.id;

    setConversations((currentConversations) => {
      const existingConversation = currentConversations.find((conversation) => conversation.id === conversationId);
      if (existingConversation) {
        return currentConversations.map((conversation) =>
          conversation.id === conversationId && openingMessage
            ? { ...conversation, time: 'Now', messages: [...conversation.messages, openingMessage] }
            : conversation
        );
      }

      return [
        {
          id: conversationId,
          person: listing.host,
          role: listing.kind === 'sales' || listing.kind === 'stands' ? 'Agent' : 'Landlord',
          listingTitle: listing.title,
          time: 'Now',
          messages: [openingMessage || `Hi, I am interested in ${listing.title}. Is it still available?`]
        },
        ...currentConversations
      ];
    });

    setActiveConversationId(conversationId);
    setActiveTab('messages');
  };

  const requestViewing = (listing: Listing, date: string, time: string) => {
    openListingConversation(listing, `Viewing request for ${listing.title}: ${date} at ${time}.`);
  };

  const toggleSavedListing = (listingId: string) => {
    setSavedListingIds((currentIds) =>
      currentIds.includes(listingId) ? currentIds.filter((id) => id !== listingId) : [...currentIds, listingId]
    );
  };

  const shareListing = async (listing: Listing) => {
    await Share.share({
      title: listing.title,
      message: `${listing.title} in ${listing.location} for ${listing.price}. Contact ${listing.host} on HomeSwipe.`
    });
  };

  const sendMessage = (conversationId: string, message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, time: 'Now', messages: [...conversation.messages, trimmedMessage] }
          : conversation
      )
    );
  };

  const openListingFromProfile = (listing: Listing) => {
    setSelectedListing(listing);
    setActiveKind(listing.kind);
    setActiveTab('home');
  };

  const saveCurrentSearch = (search: string) => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      return;
    }

    setSavedSearches((currentSearches) =>
      currentSearches.includes(trimmedSearch) ? currentSearches : [trimmedSearch, ...currentSearches]
    );
  };

  const removeSavedSearch = (search: string) => {
    setSavedSearches((currentSearches) => currentSearches.filter((savedSearch) => savedSearch !== search));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        {activeTab === 'home' && (
          <HomeScreen
            activeKind={activeKind}
            activeHomeFilterCount={activeHomeFilterCount}
            firebaseStatus={firebaseStatus}
            filteredListings={filteredListings}
            hasMoreListings={hasMoreListings}
            homeFilters={homeFilters}
            isLoadingListings={isLoadingListings}
            query={query}
            listingForm={listingForm}
            showListingForm={showListingForm}
            showHomeFilters={showHomeFilters}
            addListing={addListing}
            listingStep={listingStep}
            selectedListing={selectedListing}
            savedListingIds={savedListingIds}
            onMessageListing={openListingConversation}
            onPickListingImages={pickListingImages}
            onRequestViewing={requestViewing}
            onDropListingImages={addDroppedListingImages}
            onLoadMoreListings={() => loadListingsPage('more')}
            onShareListing={shareListing}
            onToggleSavedListing={toggleSavedListing}
            setActiveKind={setActiveKind}
            setHomeFilters={setHomeFilters}
            setListingForm={setListingForm}
            setListingStep={setListingStep}
            setQuery={setQuery}
            setSelectedListing={setSelectedListing}
            setShowHomeFilters={setShowHomeFilters}
            setShowListingForm={setShowListingForm}
          />
        )}
        {activeTab === 'tools' && <ToolsScreen />}
        {activeTab === 'messages' && (
          <MessagesScreen
            activeConversationId={activeConversationId}
            conversations={conversations}
            onSendMessage={sendMessage}
            setActiveConversationId={setActiveConversationId}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            applications={applications}
            listings={availableListings}
            currentSearch={query}
            savedListings={savedListings}
            savedSearches={savedSearches}
            onMessageListing={openListingConversation}
            onOpenListing={openListingFromProfile}
            onRemoveSavedSearch={removeSavedSearch}
            onSaveCurrentSearch={saveCurrentSearch}
            onToggleSavedListing={toggleSavedListing}
          />
        )}
      </View>
      <View style={styles.bottomTabs}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
            >
              <Ionicons name={tab.icon} size={22} color={selected ? '#0f766e' : '#64748b'} />
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({
  activeKind,
  activeHomeFilterCount,
  firebaseStatus,
  filteredListings,
  hasMoreListings,
  homeFilters,
  isLoadingListings,
  listingForm,
  query,
  showHomeFilters,
  showListingForm,
  addListing,
  listingStep,
  selectedListing,
  savedListingIds,
  onMessageListing,
  onPickListingImages,
  onRequestViewing,
  onDropListingImages,
  onLoadMoreListings,
  onShareListing,
  onToggleSavedListing,
  setActiveKind,
  setHomeFilters,
  setListingForm,
  setListingStep,
  setQuery,
  setSelectedListing,
  setShowHomeFilters,
  setShowListingForm
}: {
  activeKind: ListingKind;
  activeHomeFilterCount: number;
  firebaseStatus: FirebaseStatus;
  filteredListings: Listing[];
  hasMoreListings: boolean;
  homeFilters: HomeFilters;
  isLoadingListings: boolean;
  listingForm: ListingForm;
  query: string;
  showHomeFilters: boolean;
  showListingForm: boolean;
  addListing: () => void;
  listingStep: number;
  selectedListing: Listing | null;
  savedListingIds: string[];
  onMessageListing: (listing: Listing) => void;
  onPickListingImages: () => void;
  onRequestViewing: (listing: Listing, date: string, time: string) => void;
  onDropListingImages: (uris: string[]) => void;
  onLoadMoreListings: () => void;
  onShareListing: (listing: Listing) => void;
  onToggleSavedListing: (listingId: string) => void;
  setActiveKind: (kind: ListingKind) => void;
  setHomeFilters: React.Dispatch<React.SetStateAction<HomeFilters>>;
  setListingForm: React.Dispatch<React.SetStateAction<ListingForm>>;
  setListingStep: (step: number) => void;
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
        onShare={() => onShareListing(selectedListing)}
        onToggleSaved={() => onToggleSavedListing(selectedListing.id)}
      />
    );
  }

  const loadMoreWhenNearBottom = ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const distanceFromBottom = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
    if (distanceFromBottom < 240 && hasMoreListings && !isLoadingListings) {
      onLoadMoreListings();
    }
  };

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
          <View style={styles.syncBadge}>
            <Ionicons
              name={firebaseStatus === 'Synced' ? 'cloud-done-outline' : firebaseStatus === 'Saving' ? 'cloud-upload-outline' : 'cloud-offline-outline'}
              size={16}
              color={firebaseStatus === 'Offline' ? '#b91c1c' : '#0f766e'}
            />
            <Text style={styles.syncBadgeText}>{firebaseStatus === 'Not configured' ? 'Firebase not configured' : `Firebase: ${firebaseStatus}`}</Text>
          </View>
        </View>
        <Pressable
          style={styles.addHomeButton}
          accessibilityLabel="Add a house listing"
          onPress={() => setShowListingForm(!showListingForm)}
        >
          <Ionicons name={showListingForm ? 'close-outline' : 'add-outline'} size={22} color="#ffffff" />
          <Text style={styles.addHomeText}>{showListingForm ? 'Close' : 'Add home'}</Text>
        </Pressable>
      </View>

      {showListingForm && (
        <View style={styles.formPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.formTitle}>Add your place</Text>
              <Text style={styles.panelHint}>Step {listingStep + 1} of 4</Text>
            </View>
            <Ionicons name="home-outline" size={28} color="#0f766e" />
          </View>
          <View style={styles.stepRail}>
            {['Basics', 'Space', 'Photos', 'Price'].map((step, index) => (
              <Pressable key={step} style={[styles.stepPill, listingStep === index && styles.stepPillActive]} onPress={() => setListingStep(index)}>
                <Text style={[styles.stepText, listingStep === index && styles.stepTextActive]}>{step}</Text>
              </Pressable>
            ))}
          </View>

          {listingStep === 0 && (
            <>
              <View style={styles.segmentedControl}>
                {listingFilters.map((filter) => {
                  const selected = listingForm.kind === filter.key;
                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => setListingForm((current) => ({ ...current, kind: filter.key }))}
                      style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{filter.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.formGrid}>
                <TextInput
                  placeholder="Property type, e.g. Apartment"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.propertyType}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, propertyType: value }))}
                  style={styles.formInput}
                />
                <TextInput
                  placeholder="Entire place, room, or stand"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.spaceType}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, spaceType: value }))}
                  style={styles.formInput}
                />
                <TextInput
                  placeholder="Location"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.location}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, location: value }))}
                  style={styles.formInput}
                />
                <TextInput
                  placeholder="Landlord or agency name"
                  placeholderTextColor="#94a3b8"
                  value={listingForm.host}
                  onChangeText={(value) => setListingForm((current) => ({ ...current, host: value }))}
                  style={styles.formInput}
                />
              </View>
            </>
          )}

          {listingStep === 1 && (
            <>
              <View style={styles.formGrid}>
                <TextInput placeholder="Guests" placeholderTextColor="#94a3b8" value={listingForm.guests} onChangeText={(value) => setListingForm((current) => ({ ...current, guests: value }))} style={styles.formInput} />
                <TextInput placeholder="Bedrooms" placeholderTextColor="#94a3b8" value={listingForm.bedrooms} onChangeText={(value) => setListingForm((current) => ({ ...current, bedrooms: value }))} style={styles.formInput} />
                <TextInput placeholder="Bathrooms" placeholderTextColor="#94a3b8" value={listingForm.bathrooms} onChangeText={(value) => setListingForm((current) => ({ ...current, bathrooms: value }))} style={styles.formInput} />
                <TextInput placeholder="Key amenities, comma separated" placeholderTextColor="#94a3b8" value={listingForm.amenities} onChangeText={(value) => setListingForm((current) => ({ ...current, amenities: value }))} style={styles.formInput} />
              </View>
              <TextInput placeholder="House rules or property notes" placeholderTextColor="#94a3b8" value={listingForm.houseRules} onChangeText={(value) => setListingForm((current) => ({ ...current, houseRules: value }))} style={styles.formInput} />
            </>
          )}

          {listingStep === 2 && (
            <>
              <TextInput placeholder="Listing title" placeholderTextColor="#94a3b8" value={listingForm.title} onChangeText={(value) => setListingForm((current) => ({ ...current, title: value }))} style={styles.formInput} />
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
              <TextInput placeholder="Cover image URL, optional" placeholderTextColor="#94a3b8" value={listingForm.image} onChangeText={(value) => setListingForm((current) => ({ ...current, image: value }))} style={styles.formInput} />
              <TextInput placeholder="More photo URLs, one per line" placeholderTextColor="#94a3b8" value={listingForm.photos} onChangeText={(value) => setListingForm((current) => ({ ...current, photos: value }))} style={[styles.formInput, styles.multilineInput]} multiline />
              <TextInput placeholder="Describe your place" placeholderTextColor="#94a3b8" value={listingForm.description} onChangeText={(value) => setListingForm((current) => ({ ...current, description: value }))} style={[styles.formInput, styles.multilineInput]} multiline />
            </>
          )}

          {listingStep === 3 && (
            <>
              <View style={styles.formGrid}>
                <TextInput placeholder="Price, e.g. $850/mo" placeholderTextColor="#94a3b8" value={listingForm.price} onChangeText={(value) => setListingForm((current) => ({ ...current, price: value }))} style={styles.formInput} />
                <TextInput placeholder="Summary, e.g. 2 beds · gated · solar" placeholderTextColor="#94a3b8" value={listingForm.meta} onChangeText={(value) => setListingForm((current) => ({ ...current, meta: value }))} style={styles.formInput} />
              </View>
              <View style={styles.detailFactGrid}>
                {[listingForm.propertyType, listingForm.spaceType, listingForm.location, listingForm.price].filter(Boolean).map((detail) => (
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
            {listingStep < 3 ? (
              <Pressable style={styles.primaryButton} onPress={() => setListingStep(Math.min(3, listingStep + 1))}>
                <Text style={styles.primaryButtonText}>Next</Text>
                <Ionicons name="arrow-forward-outline" size={18} color="#ffffff" />
              </Pressable>
            ) : (
              <Pressable style={styles.primaryButton} onPress={addListing}>
                <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Publish listing</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#64748b" />
        <TextInput
          placeholder="Search suburb, city, or feature"
          placeholderTextColor="#94a3b8"
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
        <Text style={styles.sectionTitle}>Featured listings</Text>
        <Text style={styles.sectionCount}>{filteredListings.length} found</Text>
      </View>

      <View style={styles.listGrid}>
        {filteredListings.map((listing) => (
          <ListingCard
            key={listing.id}
            isSaved={savedListingIds.includes(listing.id)}
            listing={listing}
            onPress={() => setSelectedListing(listing)}
            onToggleSaved={() => onToggleSavedListing(listing.id)}
          />
        ))}
      </View>
      {hasMoreListings && (
        <Pressable style={styles.loadMoreButton} onPress={onLoadMoreListings}>
          <Ionicons name="download-outline" size={18} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>{isLoadingListings ? 'Loading homes...' : 'Load more homes'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function ListingCard({
  isSaved,
  listing,
  onPress,
  onToggleSaved
}: {
  isSaved: boolean;
  listing: Listing;
  onPress: () => void;
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
          <Pressable accessibilityLabel={isSaved ? 'Unsave listing' : 'Save listing'} onPress={onToggleSaved} hitSlop={8}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={22} color={isSaved ? '#e11d48' : '#0f172a'} />
          </Pressable>
        </View>
        <Pressable onPress={onPress}>
          <Text style={styles.listingTitle}>{listing.title}</Text>
          <Text style={styles.listingLocation}>{listing.location}</Text>
          <Text style={styles.listingMeta}>{listing.meta}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.listingPrice}>{listing.price}</Text>
            <Text style={styles.hostName}>{listing.host}</Text>
          </View>
        </Pressable>
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
  isSaved,
  listing,
  onBack,
  onMessage,
  onRequestViewing,
  onShare,
  onToggleSaved
}: {
  isSaved: boolean;
  listing: Listing;
  onBack: () => void;
  onMessage: () => void;
  onRequestViewing: (date: string, time: string) => void;
  onShare: () => void;
  onToggleSaved: () => void;
}) {
  const galleryPhotos = listing.photos.length > 0 ? listing.photos : [listing.image];
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState('Tomorrow');
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const viewingDates = ['Tomorrow', 'Friday', 'Saturday', 'Sunday'];
  const viewingTimes = ['10:00 AM', '12:30 PM', '3:00 PM', '5:30 PM'];

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.detailTitle}>{listing.title}</Text>
          <Text style={styles.detailLocation}>{listing.location}</Text>
        </View>
        <Text style={styles.detailPrice}>{listing.price}</Text>
      </View>

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
        <Pressable style={styles.secondaryButton} onPress={onMessage}>
          <Ionicons name="chatbubble-outline" size={18} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>Message</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => setShowCalendar(!showCalendar)}>
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

function ToolsScreen() {
  const [activeTool, setActiveTool] = useState<'screening' | 'reviews' | 'leases'>('leases');
  const [leaseForm, setLeaseForm] = useState<Omit<LeaseDraft, 'id' | 'status' | 'landlordSigned' | 'tenantSigned'>>({
    property: 'Sunny 2 bed apartment, Borrowdale',
    landlord: 'Moyo Properties',
    tenant: 'Tendai Ndlovu',
    rent: '$850',
    deposit: '$850',
    startDate: '2026-06-01',
    endDate: '2027-05-31',
    utilities: 'Tenant pays electricity and internet. Landlord covers rates and water up to fair use.',
    petPolicy: 'Small pets allowed with written approval.',
    parking: 'One covered parking bay included.'
  });
  const [leases, setLeases] = useState<LeaseDraft[]>([
    {
      id: 'lease-1',
      property: 'Modern garden cottage, Avondale',
      landlord: 'Tari Homes',
      tenant: 'Rudo M.',
      rent: '$520',
      deposit: '$520',
      startDate: '2026-05-15',
      endDate: '2027-05-14',
      utilities: 'Prepaid electricity. Water included.',
      petPolicy: 'No pets without written consent.',
      parking: 'Open parking for one vehicle.',
      status: 'Sent for signing',
      landlordSigned: true,
      tenantSigned: false
    }
  ]);

  const tools = [
    {
      key: 'screening' as const,
      icon: 'shield-checkmark-outline' as const,
      title: 'Tenant screening',
      description: 'Collect ID checks, employment details, references, and affordability notes.'
    },
    {
      key: 'reviews' as const,
      icon: 'star-outline' as const,
      title: 'Tenant reviews',
      description: 'Review rental history, landlord feedback, and payment reliability signals.'
    },
    {
      key: 'leases' as const,
      icon: 'document-text-outline' as const,
      title: 'Lease agreements',
      description: 'Create, store, and send lease agreements for rentals and sales paperwork.'
    }
  ];

  const createLease = () => {
    if (!leaseForm.property.trim() || !leaseForm.landlord.trim() || !leaseForm.tenant.trim() || !leaseForm.rent.trim()) {
      return;
    }

    const lease: LeaseDraft = {
      ...leaseForm,
      id: `${Date.now()}`,
      status: 'Draft',
      landlordSigned: false,
      tenantSigned: false
    };

    setLeases((currentLeases) => [lease, ...currentLeases]);
  };

  const updateLease = (id: string, update: Partial<LeaseDraft>) => {
    setLeases((currentLeases) =>
      currentLeases.map((lease) => {
        if (lease.id !== id) {
          return lease;
        }

        const nextLease = { ...lease, ...update };
        const signaturesComplete = nextLease.landlordSigned && nextLease.tenantSigned;
        const status = signaturesComplete ? 'Completed' : nextLease.status === 'Completed' ? 'Sent for signing' : nextLease.status;
        return { ...nextLease, status };
      })
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Tools</Text>
      <Text style={styles.subtitle}>Everything landlords and tenants need before keys change hands.</Text>
      <View style={styles.toolList}>
        {tools.map((tool) => (
          <Pressable
            key={tool.title}
            style={[styles.toolCard, activeTool === tool.key && styles.toolCardActive]}
            onPress={() => setActiveTool(tool.key)}
          >
            <View style={styles.toolIcon}>
              <Ionicons name={tool.icon} size={24} color="#0f766e" />
            </View>
            <View style={styles.toolCopy}>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDescription}>{tool.description}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={22} color="#94a3b8" />
          </Pressable>
        ))}
      </View>

      {activeTool === 'screening' && (
        <View style={styles.formPanel}>
          <Text style={styles.formTitle}>Tenant screening checklist</Text>
          {['Identity verified', 'Employment confirmed', 'Income-to-rent checked', 'References contacted'].map((item) => (
            <View key={item} style={styles.checkRow}>
              <Ionicons name="checkmark-circle" size={22} color="#0f766e" />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {activeTool === 'reviews' && (
        <View style={styles.formPanel}>
          <Text style={styles.formTitle}>Tenant review summary</Text>
          {['Paid rent on time for 11 of 12 months', 'Kept previous unit in good condition', 'Landlord reference received'].map(
            (item) => (
              <View key={item} style={styles.checkRow}>
                <Ionicons name="star" size={20} color="#f59e0b" />
                <Text style={styles.checkText}>{item}</Text>
              </View>
            )
          )}
        </View>
      )}

      {activeTool === 'leases' && (
        <View style={styles.leaseWorkspace}>
          <View style={styles.formPanel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.formTitle}>Professional lease creation</Text>
                <Text style={styles.panelHint}>Build a customized rental agreement, preview it, then send it for online signing.</Text>
              </View>
              <Ionicons name="document-lock-outline" size={28} color="#0f766e" />
            </View>
            <View style={styles.formGrid}>
              <LeaseInput label="Property" value={leaseForm.property} onChangeText={(property) => setLeaseForm((current) => ({ ...current, property }))} />
              <LeaseInput label="Landlord" value={leaseForm.landlord} onChangeText={(landlord) => setLeaseForm((current) => ({ ...current, landlord }))} />
              <LeaseInput label="Tenant" value={leaseForm.tenant} onChangeText={(tenant) => setLeaseForm((current) => ({ ...current, tenant }))} />
              <LeaseInput label="Monthly rent" value={leaseForm.rent} onChangeText={(rent) => setLeaseForm((current) => ({ ...current, rent }))} />
              <LeaseInput label="Deposit" value={leaseForm.deposit} onChangeText={(deposit) => setLeaseForm((current) => ({ ...current, deposit }))} />
              <LeaseInput label="Start date" value={leaseForm.startDate} onChangeText={(startDate) => setLeaseForm((current) => ({ ...current, startDate }))} />
              <LeaseInput label="End date" value={leaseForm.endDate} onChangeText={(endDate) => setLeaseForm((current) => ({ ...current, endDate }))} />
              <LeaseInput label="Parking" value={leaseForm.parking} onChangeText={(parking) => setLeaseForm((current) => ({ ...current, parking }))} />
            </View>
            <LeaseInput
              label="Utilities"
              multiline
              value={leaseForm.utilities}
              onChangeText={(utilities) => setLeaseForm((current) => ({ ...current, utilities }))}
            />
            <LeaseInput
              label="Pet policy"
              multiline
              value={leaseForm.petPolicy}
              onChangeText={(petPolicy) => setLeaseForm((current) => ({ ...current, petPolicy }))}
            />
            <Pressable style={styles.primaryButton} onPress={createLease}>
              <Ionicons name="sparkles-outline" size={20} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Generate lease draft</Text>
            </Pressable>
          </View>

          <View style={styles.leaseList}>
            {leases.map((lease) => (
              <View key={lease.id} style={styles.leaseCard}>
                <View style={styles.cardTopline}>
                  <Text style={styles.listingTag}>{lease.status}</Text>
                  <Ionicons name={lease.status === 'Completed' ? 'checkmark-done-outline' : 'create-outline'} size={22} color="#0f172a" />
                </View>
                <Text style={styles.leaseTitle}>{lease.property}</Text>
                <Text style={styles.leaseBody}>
                  This fixed-term residential lease is between {lease.landlord} and {lease.tenant}. Rent is {lease.rent} per month with a
                  deposit of {lease.deposit}. The lease starts {lease.startDate} and ends {lease.endDate}.
                </Text>
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>Agreement preview</Text>
                  <Text style={styles.previewText}>Utilities: {lease.utilities}</Text>
                  <Text style={styles.previewText}>Pet policy: {lease.petPolicy}</Text>
                  <Text style={styles.previewText}>Parking: {lease.parking}</Text>
                </View>
                <View style={styles.signatureRow}>
                  <Pressable
                    style={[styles.signatureButton, lease.landlordSigned && styles.signatureButtonDone]}
                    onPress={() => updateLease(lease.id, { landlordSigned: !lease.landlordSigned })}
                  >
                    <Ionicons name={lease.landlordSigned ? 'checkmark-circle' : 'pencil-outline'} size={18} color={lease.landlordSigned ? '#ffffff' : '#0f766e'} />
                    <Text style={[styles.signatureText, lease.landlordSigned && styles.signatureTextDone]}>Landlord sign</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.signatureButton, lease.tenantSigned && styles.signatureButtonDone]}
                    onPress={() => updateLease(lease.id, { tenantSigned: !lease.tenantSigned })}
                  >
                    <Ionicons name={lease.tenantSigned ? 'checkmark-circle' : 'pencil-outline'} size={18} color={lease.tenantSigned ? '#ffffff' : '#0f766e'} />
                    <Text style={[styles.signatureText, lease.tenantSigned && styles.signatureTextDone]}>Tenant sign</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => updateLease(lease.id, { status: lease.status === 'Draft' ? 'Sent for signing' : lease.status })}
                >
                  <Ionicons name="send-outline" size={18} color="#0f766e" />
                  <Text style={styles.secondaryButtonText}>Send for online signing</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}
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

function MessagesScreen({
  activeConversationId,
  conversations,
  onSendMessage,
  setActiveConversationId
}: {
  activeConversationId: string;
  conversations: Conversation[];
  onSendMessage: (conversationId: string, message: string) => void;
  setActiveConversationId: (id: string) => void;
}) {
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
  const [replyText, setReplyText] = useState('');

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
      <View style={styles.messageList}>
        {conversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            style={[styles.messageRow, activeConversation?.id === conversation.id && styles.messageRowActive]}
            onPress={() => setActiveConversationId(conversation.id)}
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

      {activeConversation && (
        <View style={styles.inboxPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.formTitle}>{activeConversation.person}</Text>
              <Text style={styles.panelHint}>
                {activeConversation.role} · {activeConversation.listingTitle}
              </Text>
            </View>
            <Ionicons name="chatbubbles-outline" size={28} color="#0f766e" />
          </View>
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
      )}
    </ScrollView>
  );
}

function ProfileScreen({
  applications,
  currentSearch,
  listings,
  savedListings,
  savedSearches,
  onMessageListing,
  onOpenListing,
  onRemoveSavedSearch,
  onSaveCurrentSearch,
  onToggleSavedListing
}: {
  applications: RentalApplication[];
  currentSearch: string;
  listings: Listing[];
  savedListings: Listing[];
  savedSearches: string[];
  onMessageListing: (listing: Listing) => void;
  onOpenListing: (listing: Listing) => void;
  onRemoveSavedSearch: (search: string) => void;
  onSaveCurrentSearch: (search: string) => void;
  onToggleSavedListing: (listingId: string) => void;
}) {
  const [profileView, setProfileView] = useState<ProfileView>('overview');
  const [personalInfo, setPersonalInfo] = useState({
    fullName: 'Tendai Ndlovu',
    phone: '+263 77 123 4567',
    email: 'tendai.ndlovu@example.com',
    employer: 'Avondale Medical Centre',
    monthlyBudget: '$900/mo'
  });
  const [documents, setDocuments] = useState([
    { id: 'national-id', title: 'National ID', status: 'Verified' },
    { id: 'proof-income', title: 'Proof of income', status: 'Needs update' },
    { id: 'references', title: 'Landlord references', status: 'Ready' }
  ]);
  const [paymentPreferences, setPaymentPreferences] = useState({
    method: 'EcoCash',
    autopay: true,
    receipts: true
  });

  const activeTitle =
    profileView === 'overview'
      ? 'Profile'
      : profileView === 'saved'
        ? 'Saved homes'
        : profileView === 'applications'
          ? 'Applications'
          : profileView === 'rating'
            ? 'Tenant rating'
            : profileView === 'personal'
              ? 'Personal information'
              : profileView === 'documents'
                ? 'Verification documents'
                : profileView === 'searches'
                  ? 'Saved searches'
                  : 'Payment preferences';

  const getListingForApplication = (application: RentalApplication) => {
    return listings.find((listing) => listing.id === application.listingId);
  };

  const markDocumentReady = (id: string) => {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) => (document.id === id ? { ...document, status: 'Ready' } : document))
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      {profileView !== 'overview' && (
        <Pressable style={styles.profileBackButton} onPress={() => setProfileView('overview')}>
          <Ionicons name="chevron-back-outline" size={20} color="#0f766e" />
          <Text style={styles.secondaryButtonText}>Profile</Text>
        </Pressable>
      )}

      <View style={styles.profileHeader}>
        <CachedImage
          source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80' }}
          style={styles.profileImage}
        />
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{activeTitle}</Text>
          <Text style={styles.profileRole}>Tenant · verified profile</Text>
        </View>
        <Pressable style={styles.iconButton} accessibilityLabel="Edit profile" onPress={() => setProfileView('personal')}>
          <Ionicons name="pencil-outline" size={20} color="#0f172a" />
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
            <Pressable style={styles.statBlock} onPress={() => setProfileView('rating')}>
              <Text style={styles.statValue}>4.8</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </Pressable>
          </View>

          <View style={styles.settingsList}>
            {[
              { key: 'personal' as const, label: 'Personal information' },
              { key: 'documents' as const, label: 'Verification documents' },
              { key: 'searches' as const, label: 'Saved searches' },
              { key: 'payments' as const, label: 'Payment preferences' }
            ].map((item) => (
              <Pressable key={item.key} style={styles.settingRow} onPress={() => setProfileView(item.key)}>
                <Text style={styles.settingText}>{item.label}</Text>
                <Ionicons name="chevron-forward-outline" size={22} color="#94a3b8" />
              </Pressable>
            ))}
          </View>
        </>
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
          {applications.map((application) => {
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
          })}
        </View>
      )}

      {profileView === 'rating' && (
        <View style={styles.profileSection}>
          <View style={styles.formPanel}>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.detailDescription}>Based on landlord feedback, payment history, document readiness, and viewing attendance.</Text>
            {['Rent paid on time', 'Documents verified', 'Strong landlord reference', 'Viewing attendance confirmed'].map((item) => (
              <View key={item} style={styles.checkRow}>
                <Ionicons name="star" size={20} color="#f59e0b" />
                <Text style={styles.checkText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {profileView === 'personal' && (
        <View style={styles.formPanel}>
          <LeaseInput label="Full name" value={personalInfo.fullName} onChangeText={(fullName) => setPersonalInfo((current) => ({ ...current, fullName }))} />
          <LeaseInput label="Phone" value={personalInfo.phone} onChangeText={(phone) => setPersonalInfo((current) => ({ ...current, phone }))} />
          <LeaseInput label="Email" value={personalInfo.email} onChangeText={(email) => setPersonalInfo((current) => ({ ...current, email }))} />
          <LeaseInput label="Employer" value={personalInfo.employer} onChangeText={(employer) => setPersonalInfo((current) => ({ ...current, employer }))} />
          <LeaseInput label="Monthly budget" value={personalInfo.monthlyBudget} onChangeText={(monthlyBudget) => setPersonalInfo((current) => ({ ...current, monthlyBudget }))} />
        </View>
      )}

      {profileView === 'documents' && (
        <View style={styles.profileSection}>
          {documents.map((document) => (
            <View key={document.id} style={styles.documentRow}>
              <View style={styles.toolIcon}>
                <Ionicons name="document-attach-outline" size={22} color="#0f766e" />
              </View>
              <View style={styles.messageCopy}>
                <Text style={styles.messageName}>{document.title}</Text>
                <Text style={styles.messageText}>{document.status}</Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => markDocumentReady(document.id)}>
                <Text style={styles.secondaryButtonText}>Mark ready</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {profileView === 'searches' && (
        <View style={styles.profileSection}>
          <Pressable style={styles.primaryButton} onPress={() => onSaveCurrentSearch(currentSearch)}>
            <Ionicons name="bookmark-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Save current search</Text>
          </Pressable>
          {savedSearches.map((search) => (
            <View key={search} style={styles.savedSearchRow}>
              <Ionicons name="search-outline" size={20} color="#0f766e" />
              <Text style={styles.settingText}>{search}</Text>
              <Pressable accessibilityLabel="Remove saved search" onPress={() => onRemoveSavedSearch(search)}>
                <Ionicons name="close-circle-outline" size={22} color="#64748b" />
              </Pressable>
            </View>
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
  formPanel: {
    gap: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 18
  },
  formTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900'
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
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
  syncBadge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#99f6e4'
  },
  syncBadgeText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800'
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
    marginBottom: 14
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
    gap: 16
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
    width: Platform.OS === 'web' ? '48%' : '100%',
    minWidth: Platform.OS === 'web' ? 320 : undefined
  },
  listingImage: {
    width: '100%',
    aspectRatio: 1.5,
    backgroundColor: '#cbd5e1'
  },
  cardBody: {
    padding: 14
  },
  cardTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  listingTag: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  listingTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4
  },
  listingLocation: {
    color: '#475569',
    fontSize: 15,
    marginBottom: 6
  },
  listingMeta: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  listingPrice: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900'
  },
  hostName: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700'
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16
  },
  detailTitleCopy: {
    flex: 1
  },
  detailTitle: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900'
  },
  detailLocation: {
    color: '#475569',
    fontSize: 16,
    marginTop: 5
  },
  detailPrice: {
    color: '#0f766e',
    fontSize: 24,
    fontWeight: '900'
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
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  detailFactText: {
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
  detailActionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
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
  toolList: {
    gap: 12,
    marginTop: 20
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  toolCardActive: {
    borderColor: '#0f766e',
    backgroundColor: '#f0fdfa'
  },
  toolIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#ccfbf1'
  },
  toolCopy: {
    flex: 1
  },
  toolTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4
  },
  toolDescription: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20
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
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14
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
  signatureRow: {
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
  profileImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#cbd5e1'
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
