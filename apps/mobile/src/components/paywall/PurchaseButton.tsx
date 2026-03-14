// @MX:NOTE: [AUTO] Purchase CTA button wrapping RevenueCat purchasePackage.
// Silently ignores user-cancelled purchases; shows Alert for other errors.
// @MX:SPEC: SPEC-MOBILE-006

import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import type { PurchasesPackage, CustomerInfo } from "react-native-purchases";
import { purchasePackage } from "@/lib/revenue-cat";

// PurchasesErrorCode value for user cancellation
const PURCHASE_CANCELLED_CODE = "PURCHASE_CANCELLED_ERROR";

interface PurchaseButtonProps {
  pkg: PurchasesPackage | null;
  onSuccess: (info: CustomerInfo) => void;
  onError?: (e: Error) => void;
  disabled?: boolean;
}

export default function PurchaseButton({
  pkg,
  onSuccess,
  onError,
  disabled = false,
}: PurchaseButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = useCallback(async () => {
    if (!pkg) return;
    setIsLoading(true);
    try {
      const { customerInfo } = await purchasePackage(pkg);
      onSuccess(customerInfo);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Check for cancellation - RevenueCat wraps codes in the error object
      const errWithCode = err as { code?: string; userCancelled?: boolean };
      const isCancelled =
        errWithCode.userCancelled === true ||
        errWithCode.code === PURCHASE_CANCELLED_CODE;

      if (!isCancelled) {
        Alert.alert(
          "구매 실패",
          error.message || "구매 중 오류가 발생했습니다.",
        );
        onError?.(error);
      }
      // Cancelled: silent - no alert needed
    } finally {
      setIsLoading(false);
    }
  }, [pkg, onSuccess, onError]);

  const isDisabled = disabled || isLoading || !pkg;

  const label = "구독 시작하기";

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={isLoading ? "구매 처리 중" : label}
      accessibilityState={{ disabled: isDisabled }}
    >
      <Text style={styles.buttonText}>{isLoading ? "처리 중..." : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#111111",
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
});
