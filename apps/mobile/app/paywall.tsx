// @MX:NOTE: [AUTO] 페이월 시트. podcast-ambient dark modal 테마. 프리미엄 혜택 단독 강조,
// 구독 플랜 선택기 (절약 뱃지 포함), 하단 고정 CTA.
// @MX:SPEC: SPEC-MOBILE-006

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Linking,
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
import { colors, font, palette, radius, spacing } from "../src/theme";

// --- Design tokens (podcast-ambient · dark modal context) ---
// Opaque colors reference palette/colors; glass surfaces use rgba overrides.
const C = {
  bg: palette.neutral900,
  surface: "rgba(255, 255, 255, 0.07)",
  surfaceSelected: "rgba(255, 255, 255, 0.13)",
  border: "rgba(255, 255, 255, 0.10)",
  borderSelected: "rgba(212, 168, 67, 0.55)",
  text: palette.white,
  textSecondary: "rgba(255, 255, 255, 0.65)",
  textMuted: "rgba(255, 255, 255, 0.38)",
  accent: colors.warning, // #D4A843 — warm amber
  accentBg: "rgba(212, 168, 67, 0.16)",
  accentBorder: "rgba(212, 168, 67, 0.32)",
  ctaBtn: palette.white,
  ctaBtnText: palette.neutral900,
  divider: "rgba(255, 255, 255, 0.08)",
};

// Horizontal gutter — sits between spacing.md (16) and spacing.lg (24)
const PH = 20;

const PREMIUM_FEATURES = [
  "모든 영상 무제한 청취",
  "문장 저장 및 복습 무제한",
  "광고 없는 집중 학습 환경",
];

interface SubOption {
  label: string;
  description: string;
  fallbackPrice: string;
  perMonth: string;
  badge?: string;
  pkg: PurchasesPackage | null;
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { plan: currentPlan, refresh } = useSubscription();
  const [options, setOptions] = useState<SubOption[]>([
    {
      label: "월간",
      description: "매월 자동 갱신",
      fallbackPrice: "₩9,900 / 월",
      perMonth: "₩9,900 / 월",
      pkg: null,
    },
    {
      label: "3개월",
      description: "3개월마다 갱신",
      fallbackPrice: "₩24,900 / 3개월",
      perMonth: "₩8,300 / 월",
      badge: "16% 절약",
      pkg: null,
    },
    {
      label: "연간",
      description: "매년 자동 갱신",
      fallbackPrice: "₩89,000 / 년",
      perMonth: "₩7,417 / 월",
      badge: "25% 절약",
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
    <ImageBackground
      source={require("../assets/images/paywall-bg.png")}
      style={styles.root}
      resizeMode="cover"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
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
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {"가장 좋은 영어 인풋을\n무제한으로, 매일 받아보세요"}
          </Text>
          {isPremium && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>현재 구독 중</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Premium features */}
        <View style={styles.featuresSection}>
          {PREMIUM_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        {!isPremium && (
          <View style={styles.planSection}>
            <Text style={styles.planSectionLabel}>구독 플랜 선택</Text>

            {loading ? (
              <ActivityIndicator
                style={{ marginVertical: spacing.lg }}
                color={C.accent}
              />
            ) : (
              options.map((opt, i) => {
                const selected = selectedIndex === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.optionCard,
                      selected && styles.optionCardSelected,
                    ]}
                    onPress={() => setSelectedIndex(i)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={styles.optionInner}>
                      {/* Radio */}
                      <View
                        style={[styles.radio, selected && styles.radioSelected]}
                      >
                        {selected && <View style={styles.radioDot} />}
                      </View>

                      {/* Label + badge + description */}
                      <View style={styles.optionMeta}>
                        <View style={styles.optionLabelRow}>
                          <Text
                            style={[
                              styles.optionLabel,
                              selected && styles.optionLabelSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {opt.badge && (
                            <View style={styles.savingsBadge}>
                              <Text style={styles.savingsBadgeText}>
                                {opt.badge}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.optionDesc}>{opt.description}</Text>
                      </View>

                      {/* Price */}
                      <View style={styles.optionPriceBlock}>
                        <Text
                          style={[
                            styles.optionPrice,
                            selected && styles.optionPriceSelected,
                          ]}
                        >
                          {opt.pkg
                            ? opt.pkg.product.priceString
                            : opt.fallbackPrice}
                        </Text>
                        {i > 0 && (
                          <Text style={styles.optionPerMonth}>
                            {opt.perMonth}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

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

        {/* Legal links (required by App Store 3.1.2(c)) */}
        <View style={styles.legalSection}>
          <Text style={styles.legalNotice}>
            구독은 확인 시 iTunes 계정에 청구되며, 현재 구독 기간 종료 최소
            24시간 전에 자동 갱신을 해제하지 않으면 자동으로 갱신됩니다.
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("https://inputenglish.vercel.app/terms")
              }
              accessibilityRole="link"
              accessibilityLabel="이용약관"
            >
              <Text style={styles.legalLinkText}>이용약관</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>|</Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("https://inputenglish.vercel.app/privacy")
              }
              accessibilityRole="link"
              accessibilityLabel="개인정보처리방침"
            >
              <Text style={styles.legalLinkText}>개인정보처리방침</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Fixed bottom CTA */}
      {!isPremium && (
        <View
          style={[
            styles.ctaContainer,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          <PurchaseButton
            pkg={options[selectedIndex]?.pkg ?? null}
            onSuccess={handlePurchaseSuccess}
            style={styles.ctaButton}
            textStyle={styles.ctaButtonText}
          />
          <Text style={styles.ctaHint}>언제든지 해지 가능</Text>
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ──────────────────────────────────────────
  header: {
    paddingHorizontal: PH,
    paddingBottom: spacing.sm,
  },
  closeText: {
    fontSize: font.size.md,
    color: C.textMuted,
    fontWeight: font.weight.regular,
  },

  // ── Scroll ──────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: PH,
    paddingBottom: spacing.xl,
  },

  // ── Hero ────────────────────────────────────────────
  hero: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl - spacing.sm, // 24
    gap: spacing.md,
  },
  heroTitle: {
    fontSize: font.size["2xl"], // 28
    fontWeight: font.weight.bold,
    color: C.text,
    lineHeight: font.size["2xl"] + spacing.sm, // 36
    letterSpacing: -0.3,
  },
  activeBadge: {
    alignSelf: "flex-start",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + spacing.xs, // 12
    paddingVertical: spacing.xs,
  },
  activeBadgeText: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: C.textSecondary,
    letterSpacing: 0.3,
  },

  // ── Divider ─────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: C.divider,
    marginBottom: spacing.lg,
  },

  // ── Features ────────────────────────────────────────
  featuresSection: {
    gap: spacing.md - 2, // 14
    marginBottom: spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + spacing.xs, // 12
  },
  checkIcon: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: C.accent,
    width: spacing.md,
    textAlign: "center",
  },
  featureText: {
    fontSize: font.size.md,
    color: C.textSecondary,
    flex: 1,
    lineHeight: font.size.md * 1.4, // 21
  },

  // ── Plan section ────────────────────────────────────
  planSection: {
    gap: spacing.sm + spacing.xs, // 12
  },
  planSectionLabel: {
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: 1.6,
    color: C.textMuted,
    marginBottom: spacing.xs,
  },

  // Option card
  optionCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: radius.xl, // 16
    padding: spacing.md,
  },
  optionCardSelected: {
    backgroundColor: C.surfaceSelected,
    borderColor: C.borderSelected,
  },
  optionInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + spacing.xs, // 12
  },

  // Radio
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9, // half of fixed 18px touch target
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: C.accent },
  radioDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.sm, // 4
    backgroundColor: C.accent,
  },

  // Option meta
  optionMeta: {
    flex: 1,
    gap: 2,
  },
  optionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2, // 6
  },
  optionLabel: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: C.textSecondary,
    letterSpacing: 0.1,
  },
  optionLabelSelected: { color: C.text },
  optionDesc: {
    fontSize: font.size.xs,
    color: C.textMuted,
  },

  // Savings badge
  savingsBadge: {
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 7, // between xs(4) and sm(8)
    paddingVertical: 2,
  },
  savingsBadgeText: {
    fontSize: 10, // below font.size.xs (11) intentionally
    fontWeight: font.weight.bold,
    color: C.accent,
    letterSpacing: 0.3,
  },

  // Price block
  optionPriceBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  optionPrice: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: C.textSecondary,
    letterSpacing: 0.1,
  },
  optionPriceSelected: { color: C.text },
  optionPerMonth: {
    fontSize: 10, // below font.size.xs (11) intentionally
    color: C.textMuted,
  },

  // ── Restore ─────────────────────────────────────────
  restoreButton: {
    alignSelf: "center",
    paddingVertical: spacing.md - 2, // 14
    paddingHorizontal: PH,
    marginTop: spacing.md,
  },
  restoreText: {
    color: C.textMuted,
    fontSize: font.size.xs + 1, // 12 — between xs(11) and sm(13)
    letterSpacing: 0.4,
    textDecorationLine: "underline",
  },

  // ── Legal ───────────────────────────────────────────
  legalSection: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  legalNotice: {
    fontSize: 10,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  legalLinkText: {
    fontSize: font.size.xs,
    color: C.textMuted,
    textDecorationLine: "underline",
  },
  legalDivider: {
    fontSize: font.size.xs,
    color: C.textMuted,
  },

  // ── Fixed CTA ───────────────────────────────────────
  ctaContainer: {
    borderTopWidth: 1,
    borderTopColor: C.divider,
    backgroundColor: "transparent",
    paddingHorizontal: PH,
    paddingTop: spacing.md - 2, // 14
    gap: spacing.sm,
  },
  ctaButton: {
    backgroundColor: C.ctaBtn,
    borderRadius: radius.xl - 2, // 14 — slightly tighter than xl(16)
    paddingVertical: spacing.md + 1, // 17
  },
  ctaButtonText: {
    color: C.ctaBtnText,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    letterSpacing: 0.3,
  },
  ctaHint: {
    fontSize: font.size.xs,
    color: C.textMuted,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
