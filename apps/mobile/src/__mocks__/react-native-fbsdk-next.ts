// Jest mock for react-native-fbsdk-next. The real module instantiates a native
// NativeEventEmitter at import time, which throws under jest-expo. Tests that
// render the root layout (which initializes the Facebook SDK) only need these
// no-op stubs.
export const Settings = {
  initializeSDK: () => {},
  setAppID: () => {},
  setAdvertiserTrackingEnabled: () => {},
  setAdvertiserTrackingEnabledAsync: async () => {},
};

export const AppEventsLogger = {
  logEvent: () => {},
  logPurchase: () => {},
};

export const LoginManager = {
  logInWithPermissions: async () => ({ isCancelled: true }),
  logOut: () => {},
};

export const AccessToken = {
  getCurrentAccessToken: async () => null,
};

export default { Settings, AppEventsLogger, LoginManager, AccessToken };
