import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.demandmap.nyc",
  appName: "DemandMap NYC",
  webDir: "public",
  server: {
    url: "https://demandmap.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0f1e",
  },
  android: {
    backgroundColor: "#0a0f1e",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0a0f1e",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0f1e",
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
