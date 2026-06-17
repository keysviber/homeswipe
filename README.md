# HomeSwipe

HomeSwipe is a shared Expo app for iOS, Android, and web. It helps landlords and tenants discover rentals, homes for sale, and stands for sale, then manage screening, lease tools, messages, and profiles from the same codebase.

## Run

```bash
npm install
npm run web
```

Use `npm run ios` or `npm run android` for native simulators once Expo is installed and configured locally.

## DreamHost web upload

Build the static website:

```bash
npm install
npm run build:web
```

Upload the contents of `dist/` to the DreamHost site directory for the HomeSwipe domain. For the primary domain this is usually the domain folder in your DreamHost user home. Upload the files inside `dist/`, not the `dist` folder itself.

The build includes `public/.htaccess` so Apache serves app routes through `index.html` and caches static assets. Firebase values from `.env` are baked into the website at build time, so rebuild after changing any `EXPO_PUBLIC_*` value.

## Firebase

The app is linked to the `homeswipe-59d71` Firebase project. The checked-in `.env.example` contains the current Firebase web app config. Copy it to `.env` for local development, then rebuild after any Firebase setting changes.

Cloud Firestore and Firebase Storage must be created for `homeswipe-59d71` before the app can sync. In Firebase Console, open Firestore Database and Storage, create the default resources, then publish the rules so the app can read listings and upload owner-linked listing photos:

```bash
npx firebase-tools deploy --only firestore:rules,storage --project homeswipe-59d71
```

HomeSwipe stores user-specific prototype app data in Firestore at:

```text
homeswipeUsers/{firebaseAuthUid}
```

Property listings are stored separately and loaded in pages of 20 from:

```text
homeswipeListings
```

Uploaded listing photos are compressed in the app, uploaded to Firebase Storage, and linked to the signed-in owner at:

```text
homeswipeUsers/{firebaseAuthUid}/listings/{listingId}/photos/{fileName}
```

Firestore listing documents store public download URLs in `image` / `photos` and the owned Storage object paths in `storagePaths`.

The app still runs without Firebase config, but the Home tab will show `Firebase not configured` and changes will only live in memory for that session.

Enable Authentication > Sign-in method > Email/Password and Google in Firebase Console. Browsing listings is public, but HomeSwipe asks users to sign up or sign in before publishing a listing, saving homes, starting chats, using tools, or opening profile workflows.

If the Home tab shows `Firebase: Offline`, make sure Cloud Firestore and Firebase Storage are enabled, Email/Password and Google sign-in are enabled, and the rules in `firestore.rules` and `storage.rules` are published.

Image uploads are compressed to a maximum dimension of 1280px before they are uploaded to Firebase Storage.
