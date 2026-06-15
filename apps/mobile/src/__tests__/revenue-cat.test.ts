import { Platform } from "react-native";

// ---- Mock react-native-purchases ----
const mockConfigure = jest.fn();
const mockLogIn = jest.fn().mockResolvedValue(undefined);
const mockGetOfferings = jest.fn();
const mockGetCustomerInfo = jest.fn();
const mockRestorePurchases = jest.fn();
const mockPurchasePackage = jest.fn();
const mockSupabase = {
  auth: { getSession: jest.fn() },
  from: jest.fn(),
};

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
  supabase: mockSupabase,
}));

// Re-import fresh module per test to reset module-level state
function loadModule() {
  jest.resetModules();
  return require("../lib/revenue-cat") as typeof import("../lib/revenue-cat");
}

beforeEach(() => {
  jest.resetAllMocks();
  mockLogIn.mockResolvedValue(undefined);
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
    mockConfigure.mockImplementationOnce(() => {
      throw new Error("invalid API key");
    });
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

describe("findPremiumMonthlyPackage", () => {
  it("selects the monthly package from a mixed offering", () => {
    const mod = loadModule();
    const monthly = { product: { identifier: "premium_monthly" } } as any;
    const result = mod.findPremiumMonthlyPackage([
      { product: { identifier: "premium_quarterly" } },
      monthly,
      { product: { identifier: "premium_yearly" } },
    ] as any);

    expect(result).toBe(monthly);
  });

  it("returns null when the offering has no monthly premium package", () => {
    const mod = loadModule();

    expect(
      mod.findPremiumMonthlyPackage([
        { product: { identifier: "premium_quarterly" } },
        { product: { identifier: "premium_yearly" } },
      ] as any),
    ).toBeNull();
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

describe("syncPlanToSupabase", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env["INPUTENGLISH_WEB_API_URL"] = "https://api.inputenglish.test";
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env["INPUTENGLISH_WEB_API_URL"];
    global.fetch = originalFetch;
  });

  it("syncs entitlement through the server premium API with the user bearer token", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token-1",
          user: { id: "user-1" },
        },
      },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        plan: "PREMIUM",
        source: "revenuecat",
      }),
    });

    const mod = loadModule();
    await mod.syncPlanToSupabase("PREMIUM");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.inputenglish.test/api/premium/entitlement/sync",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ expectedClientPlan: "PREMIUM" }),
      }),
    );
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("does not write plan directly from the client when the server sync fails", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token-1",
          user: { id: "user-1" },
        },
      },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: "RevenueCat subscriber lookup failed",
      }),
    });

    const mod = loadModule();
    await expect(mod.syncPlanToSupabase("PREMIUM")).resolves.toBeUndefined();

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
