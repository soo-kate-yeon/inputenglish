// Set env vars before any module load (Expo inlines EXPO_PUBLIC_* at transform time)
process.env.EXPO_PUBLIC_RC_IOS_KEY = "test_ios_key_abc123";
process.env.EXPO_PUBLIC_RC_ANDROID_KEY = "test_android_key_abc123";

import { Platform } from "react-native";

// ---- Mock react-native-purchases ----
const mockConfigure = jest.fn();
const mockLogIn = jest.fn().mockResolvedValue(undefined);
const mockGetOfferings = jest.fn();
const mockGetCustomerInfo = jest.fn();
const mockRestorePurchases = jest.fn();
const mockPurchasePackage = jest.fn();

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    logIn: mockLogIn,
    getOfferings: mockGetOfferings,
    getCustomerInfo: mockGetCustomerInfo,
    restorePurchases: mockRestorePurchases,
    purchasePackage: mockPurchasePackage,
  },
}));

jest.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn() },
}));

// Re-import fresh module per test to reset module-level state
function loadModule() {
  jest.resetModules();
  return require("../lib/revenue-cat") as typeof import("../lib/revenue-cat");
}

beforeEach(() => {
  jest.resetAllMocks();
  mockLogIn.mockResolvedValue(undefined);
  process.env.EXPO_PUBLIC_RC_IOS_KEY = "test_ios_key_abc123";
  process.env.EXPO_PUBLIC_RC_ANDROID_KEY = "test_android_key_abc123";
});

describe("configureRevenueCat", () => {
  it("configures SDK and returns true", async () => {
    const mod = loadModule();
    const result = await mod.configureRevenueCat();

    expect(result).toBe(true);
    expect(mockConfigure).toHaveBeenCalledWith({
      apiKey: expect.any(String),
    });
  });

  it("returns false when configure throws", async () => {
    mockConfigure.mockImplementationOnce(() => {
      throw new Error("SDK error");
    });
    const mod = loadModule();
    const result = await mod.configureRevenueCat();

    expect(result).toBe(false);
  });

  it("returns false when API key is empty", async () => {
    process.env.EXPO_PUBLIC_RC_IOS_KEY = "";
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY = "";
    const mod = loadModule();
    const result = await mod.configureRevenueCat();

    expect(result).toBe(false);
    expect(mockConfigure).not.toHaveBeenCalled();
  });

  it("only configures once (idempotent)", async () => {
    const mod = loadModule();
    await mod.configureRevenueCat();
    await mod.configureRevenueCat();

    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });
});

describe("logInRevenueCat", () => {
  it("calls logIn after configure", async () => {
    const mod = loadModule();
    await mod.logInRevenueCat("user-123");

    expect(mockConfigure).toHaveBeenCalled();
    expect(mockLogIn).toHaveBeenCalledWith("user-123");
  });

  it("does not call logIn when configure fails", async () => {
    mockConfigure.mockImplementationOnce(() => {
      throw new Error("fail");
    });
    const mod = loadModule();
    await mod.logInRevenueCat("user-123");

    expect(mockLogIn).not.toHaveBeenCalled();
  });

  it("does not throw when logIn fails", async () => {
    mockLogIn.mockRejectedValueOnce(new Error("network error"));
    const mod = loadModule();

    await expect(mod.logInRevenueCat("user-123")).resolves.toBeUndefined();
  });
});

describe("initRevenueCat (deprecated)", () => {
  it("configures SDK and logs in user", async () => {
    const mod = loadModule();
    await mod.initRevenueCat("user-123");

    expect(mockConfigure).toHaveBeenCalledWith({
      apiKey: expect.any(String),
    });
    expect(mockLogIn).toHaveBeenCalledWith("user-123");
  });

  it("does not throw when logIn fails", async () => {
    mockLogIn.mockRejectedValueOnce(new Error("network error"));
    const mod = loadModule();

    await expect(mod.initRevenueCat("user-123")).resolves.toBeUndefined();
  });
});

describe("waitForRevenueCat", () => {
  it("configures and returns true when called without prior configure", async () => {
    const mod = loadModule();
    const result = await mod.waitForRevenueCat();
    expect(result).toBe(true);
    expect(mockConfigure).toHaveBeenCalled();
  });

  it("returns cached result on repeated calls", async () => {
    const mod = loadModule();
    await mod.configureRevenueCat();
    const result = await mod.waitForRevenueCat();

    expect(result).toBe(true);
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });
});

describe("getOfferings", () => {
  it("returns offerings on success", async () => {
    const fakeOfferings = {
      current: {
        identifier: "default",
        availablePackages: [{ product: { identifier: "premium_monthly" } }],
      },
    };
    mockGetOfferings.mockResolvedValueOnce(fakeOfferings);

    const mod = loadModule();
    const result = await mod.getOfferings();
    expect(result).toEqual(fakeOfferings);
  });

  it("returns null when SDK configure failed", async () => {
    process.env.EXPO_PUBLIC_RC_IOS_KEY = "";
    process.env.EXPO_PUBLIC_RC_ANDROID_KEY = "";
    const mod = loadModule();
    const result = await mod.getOfferings();
    expect(result).toBeNull();
    expect(mockGetOfferings).not.toHaveBeenCalled();
  });

  it("retries on empty offerings and returns null after max retries", async () => {
    const emptyOfferings = {
      current: { identifier: "default", availablePackages: [] },
    };
    mockGetOfferings
      .mockResolvedValueOnce(emptyOfferings)
      .mockResolvedValueOnce(emptyOfferings)
      .mockResolvedValueOnce(emptyOfferings);

    const mod = loadModule();
    // Use maxRetries=1 to speed up test
    const result = await mod.getOfferings(1);
    expect(result).toBeNull();
  });

  it("retries on error and succeeds on subsequent attempt", async () => {
    const fakeOfferings = {
      current: {
        identifier: "default",
        availablePackages: [{ product: { identifier: "premium_monthly" } }],
      },
    };
    mockGetOfferings
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(fakeOfferings);

    const mod = loadModule();
    const result = await mod.getOfferings(2);
    expect(result).toEqual(fakeOfferings);
    expect(mockGetOfferings).toHaveBeenCalledTimes(2);
  });

  it("returns null after all retries exhausted", async () => {
    mockGetOfferings.mockRejectedValue(new Error("persistent failure"));

    const mod = loadModule();
    const result = await mod.getOfferings(2);
    expect(result).toBeNull();
    expect(mockGetOfferings).toHaveBeenCalledTimes(2);
  });
});

describe("getPlanFromCustomerInfo", () => {
  it("returns PREMIUM when premium entitlement is active", () => {
    const mod = loadModule();
    const info = {
      entitlements: { active: { premium: {} } },
    } as any;
    expect(mod.getPlanFromCustomerInfo(info)).toBe("PREMIUM");
  });

  it("returns PREMIUM when any entitlement is active", () => {
    const mod = loadModule();
    const info = {
      entitlements: { active: { some_other: {} } },
    } as any;
    expect(mod.getPlanFromCustomerInfo(info)).toBe("PREMIUM");
  });

  it("returns FREE when no entitlements are active", () => {
    const mod = loadModule();
    const info = {
      entitlements: { active: {} },
    } as any;
    expect(mod.getPlanFromCustomerInfo(info)).toBe("FREE");
  });
});
