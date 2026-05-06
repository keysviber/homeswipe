# HomeSwipe

HomeSwipe is a shared Expo app for iOS, Android, and web. It helps landlords and tenants discover rentals, homes for sale, and stands for sale, then manage screening, lease tools, messages, and profiles from the same codebase.

## Run

```bash
npm install
npm run web
```

Use `npm run ios` or `npm run android` for native simulators once Expo is installed and configured locally.

## Firebase

The app is linked to the `homeswipe-59d71` Firebase project. You can still copy `.env.example` to `.env` if you want to override the Firebase web app config values later.

HomeSwipe stores user-specific prototype app data in Firestore at:

```text
homeswipeUsers/demo-user
```

Property listings are stored separately and loaded in pages of 20 from:

```text
homeswipeListings
```

The app still runs without Firebase config, but the Home tab will show `Firebase not configured` and changes will only live in memory for that session.

If the Home tab shows `Firebase: Offline`, make sure Cloud Firestore is created/enabled for the `homeswipe-59d71` project and that your Firestore rules allow this prototype document to read and write.

Image uploads are compressed to a maximum dimension of 1280px before they are added to listing drafts.
