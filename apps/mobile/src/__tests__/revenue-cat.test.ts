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

// Re-import fresh module per test to reset `rcReady`
function loadModule() {
  jest.resetModules();
  return require("../lib/revenue-cat") as typeof import("../lib/revenue-cat");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLogIn.mockResolvedValue(undefined);
});

describe("initRevenueCat", () => {
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
  it("resolves immediately when init was never called", async () => {
    const mod = loadModule();
    await expect(mod.waitForRevenueCat()).resolves.toBeUndefined();
  });

  it("waits for init to complete before resolving", async () => {
    let resolveLogIn!: () => void;
    mockLogIn.mockReturnValueOnce(
      new Promise<void>((r) => {
        resolveLogIn = r;
      }),
    );

    const mod = loadModule();
    const initPromise = mod.initRevenueCat("user-123");

    let waitResolved = false;
    const waitPromise = mod.waitForRevenueCat().then(() => {
      waitResolved = true;
    });

    // waitForRevenueCat should not resolve while logIn is pending
    await Promise.resolve();
    expect(waitResolved).toBe(false);

    // Finish init
    resolveLogIn();
    await initPromise;
    await waitPromise;
    expect(waitResolved).toBe(true);
  });

  it("resolves even when init fails", async () => {
    mockLogIn.mockRejectedValueOnce(new Error("fail"));
    const mod = loadModule();
    await mod.initRevenueCat("user-123");

    await expect(mod.waitForRevenueCat()).resolves.toBeUndefined();
  });
});

describe("getOfferings", () => {
  it("returns offerings on success", async () => {
    const fakeOfferings = { current: { availablePackages: [] } };
    mockGetOfferings.mockResolvedValueOnce(fakeOfferings);

    const mod = loadModule();
    const result = await mod.getOfferings();
    expect(result).toEqual(fakeOfferings);
  });

  it("returns null on failure", async () => {
    mockGetOfferings.mockRejectedValueOnce(new Error("fail"));

    const mod = loadModule();
    const result = await mod.getOfferings();
    expect(result).toBeNull();
  });
});

describe("race condition: waitForRevenueCat -> getOfferings", () => {
  it("getOfferings succeeds when called after waitForRevenueCat", async () => {
    let resolveLogIn!: () => void;
    mockLogIn.mockReturnValueOnce(
      new Promise<void>((r) => {
        resolveLogIn = r;
      }),
    );

    const fakeOfferings = {
      current: {
        availablePackages: [{ product: { identifier: "premium_monthly" } }],
      },
    };
    mockGetOfferings.mockResolvedValueOnce(fakeOfferings);

    const mod = loadModule();
    mod.initRevenueCat("user-123");

    // Simulate paywall pattern: wait then fetch
    const resultPromise = mod
      .waitForRevenueCat()
      .then(() => mod.getOfferings());

    // Init still pending — getOfferings should not have been called yet
    expect(mockGetOfferings).not.toHaveBeenCalled();

    resolveLogIn();
    const result = await resultPromise;

    expect(mockGetOfferings).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fakeOfferings);
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
