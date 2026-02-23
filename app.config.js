export default {
  expo: {
    name: "CoolCity",
    slug: "coolcity",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/coolcityicon2.png",
    scheme: "heatguard",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.coolcity.app",
      infoPlist: {
        UIBackgroundModes: ["location", "fetch"],
        NSSpeechRecognitionUsageDescription: "CoolCity needs speech recognition to help you search for safety centers by voice.",
        NSMicrophoneUsageDescription: "CoolCity needs microphone access to listen for your search queries."
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      package: "com.coolcity.app",
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "POST_NOTIFICATIONS",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.WAKE_LOCK",
        "RECORD_AUDIO"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/coolcityicon_padded.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      output: "static",
      favicon: "./assets/images/coolcityicon2.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/coolcityicon2.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow CoolCity to access your location to provide heat risk alerts."
        }
      ],
      "expo-background-fetch",
      "expo-task-manager",
      "expo-notifications",
      "expo-speech-recognition"
    ],
    experiments: {
      "typedRoutes": false,
      "reactCompiler": false
    },
    extra: {
      router: {},
      eas: {
        projectId: "72814f1d-a497-4cf2-92b1-3530de7492de"
      }
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/72814f1d-a497-4cf2-92b1-3530de7492de"
    }
  }
};
