import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import PaywallScreen from "../../app/paywall";

const mockGetOfferings = jest.fn();
const mockRestorePurchases = jest.fn();
const mockGetPlanFromCustomerInfo = jest.fn();
const mockSyncPlanToSupabase = jest.fn();
const mockRefresh = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../src/hooks/useSubscription", () => ({
  useSubscription: () => ({
    plan: "FREE",
    canUseAI: false,
    isLoading: false,
    refresh: mockRefresh,
  }),
}));

jest.mock("../../src/lib/revenue-cat", () => ({
  getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
  restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
  getPlanFromCustomerInfo: (...args: unknown[]) =>
    mockGetPlanFromCustomerInfo(...args),
  findPremiumMonthlyPackage: (
    packages: Array<{ product: { identifier: string } }>,
  ) =>
    packages.find((pkg) => {
      const id = pkg.product.identifier.toLowerCase();
      return id.includes("monthly") || id.includes("month_1");
    }) ?? null,
  syncPlanToSupabase: (...args: unknown[]) => mockSyncPlanToSupabase(...args),
}));

jest.mock("../../src/components/paywall/PurchaseButton", () => {
  const React = require("react");
  const { Text, TouchableOpacity } = require("react-native");
  return function MockPurchaseButton({
    pkg,
  }: {
    pkg: { product: { identifier: string } } | null;
  }) {
    return React.createElement(
      TouchableOpacity,
      {
        accessibilityRole: "button",
        accessibilityLabel: "구독 시작하기",
        accessibilityState: { disabled: !pkg },
      },
      React.createElement(Text, null, "구독 시작하기"),
      React.createElement(
        Text,
        null,
        `purchase-package:${pkg?.product.identifier ?? "none"}`,
      ),
    );
  };
});

describe("Premium paywall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue(null);
  });

  it("shows the premium monthly price and 7-day trial fallback", async () => {
    const { getAllByText, getByText } = render(<PaywallScreen />);

    await waitFor(() => {
      expect(getByText("7일 무료 체험")).toBeTruthy();
    });

    expect(getAllByText("₩25,900 / 월").length).toBeGreaterThan(0);
    expect(
      getByText("7일 무료 체험 후 월 ₩25,900, 언제든지 해지 가능"),
    ).toBeTruthy();
    expect(getByText("구독 시작하기")).toBeTruthy();
  });

  it("uses only the monthly RevenueCat package when mixed packages are returned", async () => {
    mockGetOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          {
            product: {
              identifier: "premium_quarterly",
              priceString: "₩69,000",
            },
          },
          {
            product: { identifier: "premium_monthly", priceString: "₩25,900" },
          },
          {
            product: { identifier: "premium_yearly", priceString: "₩249,000" },
          },
        ],
      },
    });

    const { getByText, queryByText } = render(<PaywallScreen />);

    await waitFor(() => {
      expect(getByText("purchase-package:premium_monthly")).toBeTruthy();
    });

    expect(queryByText("purchase-package:premium_quarterly")).toBeNull();
    expect(queryByText("purchase-package:premium_yearly")).toBeNull();
  });

  it("does not attach a purchase package when RevenueCat returns no monthly plan", async () => {
    mockGetOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          {
            product: {
              identifier: "premium_quarterly",
              priceString: "₩69,000",
            },
          },
          {
            product: { identifier: "premium_yearly", priceString: "₩249,000" },
          },
        ],
      },
    });

    const { getByText } = render(<PaywallScreen />);

    await waitFor(() => {
      expect(getByText("purchase-package:none")).toBeTruthy();
    });
    expect(
      getByText(
        "상품 정보를 불러올 수 없습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
  });
});
