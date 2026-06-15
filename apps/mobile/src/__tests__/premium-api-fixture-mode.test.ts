const mockGetSession = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

describe("premium API fixture mode", () => {
  const originalFetch = global.fetch;
  const originalDevDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "__DEV__",
  );

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env["EXPO_PUBLIC_WEB_API_URL"];
    delete process.env["INPUTENGLISH_WEB_API_URL"];
    delete process.env["EXPO_PUBLIC_PREMIUM_FIXTURE_MODE"];
    delete process.env["INPUTENGLISH_PREMIUM_FIXTURE_MODE"];
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    global.fetch = jest.fn() as unknown as typeof fetch;
    Object.defineProperty(globalThis, "__DEV__", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalDevDescriptor) {
      Object.defineProperty(globalThis, "__DEV__", originalDevDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).__DEV__;
    }
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("loads today's golden session fixture without auth or network calls", async () => {
    const { fetchTodayPremiumSession } = require("../lib/premium-api");
    const {
      jonnyKimPremiumSessionFixture,
    } = require("../fixtures/premium-session");

    const payload = await fetchTodayPremiumSession();

    expect(payload.entitlement).toEqual({
      hasAccess: true,
      plan: "FREE",
      reason: "trial",
      trialEndsAt: null,
    });
    expect(payload.session?.id).toBe(jonnyKimPremiumSessionFixture.id);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("loads the golden session detail fixture by id without auth or network calls", async () => {
    const { fetchPremiumSessionById } = require("../lib/premium-api");
    const {
      jonnyKimPremiumSessionFixture,
    } = require("../fixtures/premium-session");

    const payload = await fetchPremiumSessionById(
      jonnyKimPremiumSessionFixture.id,
    );

    expect(payload.session?.id).toBe(jonnyKimPremiumSessionFixture.id);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("keeps the golden curation visible in dev when the configured API is production", async () => {
    process.env["INPUTENGLISH_WEB_API_URL"] = "https://inputenglish.vercel.app";
    const { fetchTodayPremiumSession } = require("../lib/premium-api");
    const {
      jonnyKimPremiumSessionFixture,
    } = require("../fixtures/premium-session");

    const payload = await fetchTodayPremiumSession();

    expect(payload.session?.id).toBe(jonnyKimPremiumSessionFixture.id);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("allows explicit fixture mode only in development", async () => {
    process.env["INPUTENGLISH_WEB_API_URL"] = "https://api.inputenglish.test";
    process.env["INPUTENGLISH_PREMIUM_FIXTURE_MODE"] = "true";
    const { fetchTodayPremiumSession } = require("../lib/premium-api");
    const {
      jonnyKimPremiumSessionFixture,
    } = require("../fixtures/premium-session");

    const payload = await fetchTodayPremiumSession();

    expect(payload.session?.id).toBe(jonnyKimPremiumSessionFixture.id);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not let explicit fixture mode bypass the production premium API", async () => {
    Object.defineProperty(globalThis, "__DEV__", {
      value: false,
      configurable: true,
      writable: true,
    });
    process.env["INPUTENGLISH_WEB_API_URL"] = "https://api.inputenglish.test";
    process.env["INPUTENGLISH_PREMIUM_FIXTURE_MODE"] = "true";
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token-1" } },
      error: null,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          entitlement: {
            hasAccess: true,
            plan: "PREMIUM",
            reason: "premium",
            trialEndsAt: null,
          },
          session: null,
        }),
      ),
    });
    const { fetchTodayPremiumSession } = require("../lib/premium-api");

    const payload = await fetchTodayPremiumSession();

    expect(payload.session).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.inputenglish.test/api/premium/today",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      }),
    );
  });

  it("does not serve fixture content in production when the web API URL is missing", async () => {
    Object.defineProperty(globalThis, "__DEV__", {
      value: false,
      configurable: true,
      writable: true,
    });
    const { fetchTodayPremiumSession } = require("../lib/premium-api");

    await expect(fetchTodayPremiumSession()).rejects.toThrow(
      "EXPO_PUBLIC_WEB_API_URL is not configured",
    );
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uses the configured premium API in production instead of fixture data", async () => {
    Object.defineProperty(globalThis, "__DEV__", {
      value: false,
      configurable: true,
      writable: true,
    });
    process.env["INPUTENGLISH_WEB_API_URL"] = "https://api.inputenglish.test";
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token-1" } },
      error: null,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          entitlement: {
            hasAccess: true,
            plan: "PREMIUM",
            reason: "premium",
            trialEndsAt: null,
          },
          session: null,
        }),
      ),
    });
    const { fetchTodayPremiumSession } = require("../lib/premium-api");

    const payload = await fetchTodayPremiumSession();

    expect(payload.entitlement).toEqual({
      hasAccess: true,
      plan: "PREMIUM",
      reason: "premium",
      trialEndsAt: null,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.inputenglish.test/api/premium/today",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      }),
    );
  });
});
