// @MX:NOTE: [AUTO] 페이월 시트. square-minimalism 테마. FREE vs PREMIUM 비교,
// PREMIUM 카드 내부에 구독 플랜 선택, 하단 고정 CTA.
// @MX:SPEC: SPEC-MOBILE-006

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { PurchasesPackage, CustomerInfo } from "react-native-purchases";
import {
  getOfferings,
  restorePurchases,
  getPlanFromCustomerInfo,
  syncPlanToSupabase,
} from "../src/lib/revenue-cat";
import { useSubscription } from "../src/hooks/useSubscription";
import PurchaseButton from "../src/components/paywall/PurchaseButton";

// --- Design tokens (square minimalism) ---
const C = {
  bg: "#F2F2F2",
  surface: "#FFFFFF",
  border: "#111111",
  borderLight: "#E0E0E0",
  text: "#111111",
  textMuted: "#888888",
  textInverse: "#FFFFFF",
  accent: "#111111",
};

const FREE_FEATURES = [
  "기본 쉐도잉 기능",
  "유튜브 영상 스크립트 보기",
  "녹음 및 재생",
];
const PREMIUM_FEATURES = [
  "AI 학습 팁 생성",
  "AI 발음 분석 및 점수",
  "문장 저장 무제한",
  "모든 Free 기능 포함",
];

interface SubOption {
  label: string;
  description: string;
  fallbackPrice: string;
  pkg: PurchasesPackage | null;
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { plan: currentPlan, refresh } = useSubscription();
  const [options, setOptions] = useState<SubOption[]>([
    {
      label: "월간",
      description: "매월 자동 갱신",
      fallbackPrice: "₩9,900/월",
      pkg: null,
    },
    {
      label: "3개월",
      description: "3개월마다 갱신",
      fallbackPrice: "₩24,900/3개월",
      pkg: null,
    },
    {
      label: "연간",
      description: "매년 갱신 · 가장 저렴",
      fallbackPrice: "₩89,000/년",
      pkg: null,
    },
  ]);
  const [selectedIndex, setSelectedIndex] = useState(2);
  const [isRestoring, setIsRestoring] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOfferings()
      .then((offerings) => {
        if (!offerings?.current) return;
        const packages = offerings.current.availablePackages;
        setOptions((prev) =>
          prev.map((opt, i) => {
            let matched: PurchasesPackage | null = null;
            for (const pkg of packages) {
              const id = pkg.product.identifier.toLowerCase();
              if (i === 0 && (id.includes("monthly") || id.includes("month_1")))
                matched = pkg;
              if (
                i === 1 &&
                (id.includes("quarterly") ||
                  id.includes("month_3") ||
                  id.includes("three_month"))
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
            return matched ? { ...opt, pkg: matched } : opt;
          }),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePurchaseSuccess = useCallback(
    async (info: CustomerInfo) => {
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
      Alert.alert(
        "복원 완료",
        plan === "PREMIUM"
          ? "Premium 플랜이 복원되었습니다."
          : "복원할 구독 내역이 없습니다.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "구매 내역을 복원하지 못했습니다.";
      Alert.alert("복원 실패", message);
    } finally {
      setIsRestoring(false);
    }
  }, [refresh]);

  const isPremium = currentPlan === "PREMIUM";

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>인풋영어{"\n"}PREMIUM</Text>
        <Text style={styles.subtitle}>
          AI 기능으로 영어 쉐도잉을 더 효과적으로
        </Text>

        {/* ── Free card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>FREE</Text>
            {!isPremium && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>현재 플랜</Text>
              </View>
            )}
          </View>
          {FREE_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureDash}>—</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* ── Premium card (with plan selector inside) ── */}
        <View style={[styles.card, styles.premiumCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabelPremium}>PREMIUM</Text>
            {isPremium && (
              <View style={[styles.currentBadge, styles.currentBadgePremium]}>
                <Text
                  style={[
                    styles.currentBadgeText,
                    styles.currentBadgeTextPremium,
                  ]}
                >
                  현재 플랜
                </Text>
              </View>
            )}
          </View>

          {PREMIUM_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.featureTextPremium}>{f}</Text>
            </View>
          ))}

          {/* Plan selector (only for free users) */}
          {!isPremium && (
            <View style={styles.planSelector}>
              <View style={styles.planDivider} />
              <Text style={styles.planSelectorLabel}>구독 플랜 선택</Text>

              {loading ? (
                <ActivityIndicator
                  style={{ marginVertical: 16 }}
                  color={C.text}
                />
              ) : (
                options.map((opt, i) => {
                  const selected = selectedIndex === i;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.optionRow,
                        selected && styles.optionRowSelected,
                      ]}
                      onPress={() => setSelectedIndex(i)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <View style={styles.optionLeft}>
                        <View
                          style={[
                            styles.radio,
                            selected && styles.radioSelected,
                          ]}
                        >
                          {selected && <View style={styles.radioDot} />}
                        </View>
                        <View>
                          <Text style={styles.optionLabel}>{opt.label}</Text>
                          <Text style={styles.optionDesc}>
                            {opt.description}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.optionPrice}>
                        {opt.fallbackPrice}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>

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

      {/* ── Fixed bottom CTA ── */}
      {!isPremium && (
        <View
          style={[
            styles.ctaContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <PurchaseButton
            pkg={options[selectedIndex]?.pkg ?? null}
            onSuccess={handlePurchaseSuccess}
          />
          <Text style={styles.ctaHint}>언제든지 해지 가능</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  closeText: {
    fontSize: 18,
    color: C.textMuted,
    fontWeight: "400",
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Title
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: C.text,
    letterSpacing: 1,
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: C.textMuted,
    letterSpacing: 0.2,
    marginBottom: 24,
  },

  // Cards shared
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 20,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: C.textMuted,
  },

  // Premium card
  premiumCard: {
    borderColor: C.border,
    borderWidth: 2,
  },
  cardLabelPremium: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: C.text,
  },

  // Current plan badge
  currentBadge: {
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currentBadgePremium: {
    borderColor: C.border,
    backgroundColor: C.text,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: C.textMuted,
  },
  currentBadgeTextPremium: {
    color: C.textInverse,
  },

  // Features
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureDash: {
    fontSize: 14,
    color: C.borderLight,
    width: 16,
  },
  featureText: {
    fontSize: 14,
    color: C.textMuted,
    flex: 1,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    width: 16,
  },
  featureTextPremium: {
    fontSize: 14,
    color: C.text,
    flex: 1,
  },

  // Plan selector inside premium card
  planSelector: {
    marginTop: 8,
  },
  planDivider: {
    height: 1,
    backgroundColor: C.borderLight,
    marginBottom: 16,
  },
  planSelectorLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: C.textMuted,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  optionRowSelected: {
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: C.text,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.text,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.1,
  },
  optionDesc: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.2,
  },

  // Restore
  restoreButton: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  restoreText: {
    color: C.textMuted,
    fontSize: 12,
    letterSpacing: 0.5,
    textDecorationLine: "underline",
  },

  // Fixed CTA
  ctaContainer: {
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  ctaHint: {
    fontSize: 11,
    color: C.textMuted,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
