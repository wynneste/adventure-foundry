import type { ExpoConfig } from "expo/config";

// app.config.ts (instead of app.json) so secrets like the Maps key come from .env.
const config: ExpoConfig = {
  name: "Adventure Foundry",
  slug: "adventure-foundry",
  scheme: "adventurefoundry",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.adventurefoundry.app",
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription: "Take your profile and verification photos.",
      NSPhotoLibraryUsageDescription: "Pick photos of you, your commander and your playmat.",
      NSCalendarsWriteOnlyAccessUsageDescription: "Add games you schedule to your calendar.",
      NSLocationWhenInUseUsageDescription: "Find stores and players near you while traveling.",
    },
  },
  android: {
    package: "com.adventurefoundry.app",
    adaptiveIcon: {
      backgroundColor: "#1B1530",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } },
    permissions: ["CAMERA", "READ_CALENDAR", "WRITE_CALENDAR", "ACCESS_COARSE_LOCATION"],
  },
  plugins: [
    "expo-router",
    "expo-web-browser",
    "expo-secure-store",
    "expo-image",
    "expo-apple-authentication",
    "expo-calendar",
    "expo-location",
    "expo-image-picker",
  ],
  experiments: { typedRoutes: true },
};

export default config;
