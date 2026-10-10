# Stainess Scooter — Native App (Capacitor)

This project is wrapped with **Capacitor** so it can be submitted to the Apple App Store and Google Play Store as a native iOS and Android app.

The native app loads the live website (set via `CAPACITOR_SERVER_URL`), so **any change you make in Lovable — prices, POS, products, rentals — appears instantly in the staff's installed app**. No re-submission needed for content changes.

You only need to rebuild and resubmit for changes to the **native shell**: app icon, app name, splash screen, or adding native plugins (push notifications, camera, Face ID, etc.).

---

## Requirements

| For iOS build | For Android build |
| --- | --- |
| A **Mac** with macOS | Any computer (Mac / Windows / Linux) |
| Xcode (free from Mac App Store) | Android Studio (free) |
| Apple Developer account — **£79 / year** | Google Play Developer account — **$25 one-off** |
| An iPhone or iOS Simulator | An Android device or emulator |

You cannot build the iOS app in Lovable — it must be built on a Mac. If you don't have one, hire a freelancer (Fiverr / Upwork) for a few hours to submit the first build for you.

---

## First-time setup (run once on your Mac / laptop)

After pulling this project down from GitHub / Lovable export:

```bash
# 1. Install dependencies
npm install       # or: bun install

# 2. Build the web app (produces the dist/ folder Capacitor points to)
npm run build

# 3. Add the native iOS and Android platforms
npx cap add ios
npx cap add android

# 4. Sync web build + config into the native projects
npx cap sync
```

This creates two new folders — `ios/` and `android/` — that are the actual native app projects.

---

## Open the native projects

```bash
npx cap open ios        # opens Xcode  (Mac only)
npx cap open android    # opens Android Studio
```

From there:

- **iOS**: In Xcode → Product → Archive → Distribute App → App Store Connect. Follow Apple's submission wizard.
- **Android**: In Android Studio → Build → Generate Signed Bundle → AAB → upload the `.aab` to Google Play Console.

---

## When you change the website in Lovable

**Nothing to do.** The installed app fetches the live site, so staff see the update on next open.

## When you change the app icon, name, or splash screen

```bash
npm run build
npx cap sync
npx cap open ios       # rebuild + resubmit in Xcode
npx cap open android   # rebuild + resubmit in Android Studio
```

Then upload the new version to each store and wait for review (usually 1–3 days).

---

## App metadata

- **App ID (bundle):** `com.stainessscooter.app`
- **App name:** `Stainess Scooter`
- **Loads:** the URL in `CAPACITOR_SERVER_URL`

Change these in `capacitor.config.ts` if needed **before** the first store submission — changing bundle ID after the app is live in a store means creating a brand-new listing.

---

## Optional next steps (later)

If you decide you want native features, install the relevant Capacitor plugin, then `npx cap sync` and resubmit:

- Push notifications → `@capacitor/push-notifications`
- Camera (for garage photos) → `@capacitor/camera`
- Biometric login (Face ID / fingerprint) → community plugin
- Share sheet → `@capacitor/share`

Ask Lovable when you're ready and I'll wire them up.
