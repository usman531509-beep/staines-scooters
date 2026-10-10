import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor config for wrapping the web app as a native iOS/Android app.
// The `server.url` points at the published site so staff always get the
// latest build (prices, POS-driven changes) without waiting for a
// new App Store / Play Store release. Rebuild + resubmit is only needed for
// changes to the native shell itself (icon, splash, name, native plugins).
const config: CapacitorConfig = {
  appId: "com.stainessscooter.app",
  appName: "Stainess Scooter",
  webDir: "dist",
  server: {
    // Set to the deployed site, e.g. "https://<domain>/appsign?app=1", before building the native app.
    url: process.env.CAPACITOR_SERVER_URL,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
