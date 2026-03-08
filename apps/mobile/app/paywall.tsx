// @MX:NOTE: [AUTO] 페이월 모달. FREE vs PREMIUM 2단계 플랜, 3가지 구독 기간 패키지 표시.
// RevenueCat offerings에서 monthly/quarterly/annual 패키지를 로드해 표시.
// @MX:SPEC: SPEC-MOBILE-006

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import type { PurchasesPackage, CustomerInfo } from "react-native-purchases";
import PlanCard from "../src/components/paywall/PlanCard";
import PurchaseButton from "../src/components/paywall/PurchaseButton";
import {
  getOfferings,
  restorePurchases,
  getPlanFromCustomerInfo,
  syncPlanToSupabase,
} from "../src/lib/revenue-cat";
import { useSubscription } from "../src/hooks/useSubscription";

const FREE_FEATURES = [
  "기본 쉐도잉 기능",
  "유튜브 영상 스크립트 보기",
  "녹음 및 재생",
];
const PREMIUM_FEATURES = [
  ...FREE_FEATURES,
  "AI 학습 팁 생성",
  "AI 발음 분석 및 점수",
  "문장 저장 무제한",
];

interface SubscriptionOption {
  label: string;
  description: string;
  fallbackPrice: string;
  pkg: PurchasesPackage | null;
}

export default function PaywallScreen() {
  const { plan: currentPlan, refresh } = useSubscription();
  const [options, setOptions] = useState<SubscriptionOption[]>([
    {
      label: "월간",
      description: "매월 자동 갱신",
      fallbackPrice: "₩9,900/월",
      pkg: null,
    },
    {
      label: "3개월",
      description: "3개월마다 자동 갱신",
      fallbackPrice: "₩24,900/3개월",
      pkg: null,
    },
    {
      label: "연간",
      description: "매년 자동 갱신 · 가장 저렴",
      fallbackPrice: "₩89,000/년",
      pkg: null,
    },
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const [offeringsLoading, setOfferingsLoading] = useState(true);

  useEffect(() => {
    getOfferings()
      .then((offerings) => {
        if (!offerings?.current) return;
        const packages = offerings.current.availablePackages;

        setOptions((prev) =>
          prev.map((opt, i) => {
            // Match by RevenueCat PackageType or product identifier
            let matched: PurchasesPackage | null = null;
            for (const pkg of packages) {
              const id = pkg.product.identifier.toLowerCase();
              if (i === 0 && (id.includes("monthly") || id.includes("month_1")))
                matched = pkg;
              if (
                i === 1 &&
                (id.includes("quarterly") || id.includes("month_3"))
              )
                matched = pkg;
              if (
                i === 2 &&
                (id.includes("annual") ||
                  id.includes("yearly") ||
                  id.includes("year_1"))
              )
                matched = pkg;
            }
            if (!matched) return opt;
            return {
              ...opt,
              // fallbackPrice 유지 (원화 고정값 사용)
              pkg: matched,
            };
          }),
        );
      })
      .finally(() => setOfferingsLoading(false));
  }, []);

  const handlePurchaseSuccess = useCallback(
    async (info: CustomerInfo) => {
      console.log(
        "[Paywall] purchase success, entitlements:",
        Object.keys(info.entitlements.active),
      );
      const plan = getPlanFromCustomerInfo(info);
      await syncPlanToSupabase(plan);
      await refresh();
      Alert.alert("구독 완료!", "Premium 플랜이 활성화되었습니다.", [
        { text: "확인", onPress: () => router.back() },
      ]);
    },
    [refresh],
  );

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const info = await restorePurchases();
      const plan = getPlanFromCustomerInfo(info);
      await syncPlanToSupabase(plan);
      await refresh();
      const message =
        plan === "PREMIUM"
          ? "Premium 플랜이 복원되었습니다."
          : "복원할 구독 내역이 없습니다.";
      Alert.alert("복원 완료", message);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "구매 내역을 복원하지 못했습니다.";
      Alert.alert("복원 실패", message);
    } finally {
      setIsRestoring(false);
    }
  }, [refresh]);

  const selectedOption = options[selectedIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>닫기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shadowoo Premium</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          AI 기능으로 영어 쉐도잉을 더 효과적으로
        </Text>

        {/* Plan comparison */}
        <PlanCard
          plan="FREE"
          features={FREE_FEATURES}
          isCurrentPlan={currentPlan === "FREE"}
        />
        <PlanCard
          plan="PREMIUM"
          features={PREMIUM_FEATURES}
          isCurrentPlan={currentPlan === "PREMIUM"}
        />

        {/* Subscription options - only shown for FREE plan users */}
        {currentPlan === "FREE" ? (
          <View style={styles.optionsSection}>
            <Text style={styles.optionsSectionTitle}>구독 플랜 선택</Text>

            {offeringsLoading ? (
              <ActivityIndicator
                style={{ marginVertical: 16 }}
                color="#007AFF"
              />
            ) : (
              options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.optionRow,
                    selectedIndex === i && styles.optionRowSelected,
                  ]}
                  onPress={() => setSelectedIndex(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedIndex === i }}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.radio,
                        selectedIndex === i && styles.radioSelected,
                      ]}
                    >
                      {selectedIndex === i ? (
                        <View style={styles.radioDot} />
                      ) : null}
                    </View>
                    <View>
                      <Text style={styles.optionLabel}>{opt.label}</Text>
                      <Text style={styles.optionDescription}>
                        {opt.description}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.optionPrice}>{opt.fallbackPrice}</Text>
                </TouchableOpacity>
              ))
            )}

            <PurchaseButton
              pkg={selectedOption?.pkg ?? null}
              onSuccess={handlePurchaseSuccess}
            />
          </View>
        ) : null}

        {/* Restore */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isRestoring}
          accessibilityRole="button"
          accessibilityLabel="구매 내역 복원"
        >
          <Text style={styles.restoreText}>
            {isRestoring ? "복원 중..." : "구매 내역 복원"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  backText: { fontSize: 16, color: "#007AFF", fontWeight: "500" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 16, paddingBottom: 48 },
  subtitle: {
    fontSize: 15,
    color: "#6C6C70",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  optionsSection: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  optionsSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  optionRowSelected: {
    backgroundColor: "#EBF4FF",
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#C6C6C8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#007AFF" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#007AFF",
  },
  optionLabel: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  optionDescription: { fontSize: 12, color: "#8E8E93", marginTop: 1 },
  optionPrice: { fontSize: 14, fontWeight: "600", color: "#3C3C43" },
  restoreButton: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  restoreText: {
    color: "#8E8E93",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
