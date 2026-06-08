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

Upload the contents of `dist/` to the DreamHost site directory for your domain. For the primary domain this is usually the domain folder in your DreamHost user home, for example `example.com/`. Upload the files inside `dist/`, not the `dist` folder itself.

The build includes `public/.htaccess` so Apache serves app routes through `index.html` and caches static assets. Firebase values from `.env` are baked into the website at build time, so rebuild after changing any `EXPO_PUBLIC_*` value.

## Firebase

The app is linked to the `homeswipe-59d71` Firebase project. Copy `.env.example` to `.env` and replace the remaining `replace-with-*` values with the web app config from Firebase Console > Project settings > General > Your apps.

Cloud Firestore must be created for `homeswipe-59d71` before the app can sync. In Firebase Console, open Firestore Database, create the default database, then publish `firestore.rules` so the app can read listings:

```bash
npx firebase-tools deploy --only firestore:rules --project homeswipe-59d71
```

HomeSwipe stores user-specific prototype app data in Firestore at:

```text
homeswipeUsers/{anonymousAuthUid}
```

Property listings are stored separately and loaded in pages of 20 from:

```text
homeswipeListings
```

The app still runs without Firebase config, but the Home tab will show `Firebase not configured` and changes will only live in memory for that session.

If the Home tab shows `Firebase: Offline`, make sure Cloud Firestore is enabled, Anonymous Auth is enabled, and the rules in `firestore.rules` are published.

Image uploads are compressed to a maximum dimension of 1280px before they are added to listing drafts.
