import { Platform } from "react-native";
import { Settings } from "react-native-fbsdk-next";

let facebookSdkInitialized = false;

export function initializeFacebookSdk() {
  if (facebookSdkInitialized || Platform.OS !== "ios") {
    return;
  }

  try {
    Settings.initializeSDK();
    facebookSdkInitialized = true;
  } catch (error) {
    console.warn("[FacebookSDK] Failed to initialize Facebook SDK", error);
  }
}
