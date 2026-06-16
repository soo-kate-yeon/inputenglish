/**
 * Safe haptic feedback helpers for SPEC-MOBILE-019 Pillar 3.
 *
 * Wraps expo-haptics calls in try/catch so that OS-level vibration being
 * disabled or platform unsupported (e.g., Android) never interrupts the
 * gesture flow. All calls are fire-and-forget (not awaited).
 *
 * @MX:NOTE: Wraps expo-haptics with try/catch for graceful no-op on
 *   platforms or settings where haptics are unavailable. iOS Taptic Engine
 *   already handles Reduce Motion internally; this guard is an extra safety.
 * @MX:SPEC: SPEC-MOBILE-019
 */
import * as Haptics from "expo-haptics";

/**
 * Fire-and-forget selection haptic.
 * Use for list-item selection or text cursor changes (e.g., sentence tap).
 */
export function safeSelectionAsync(): void {
  try {
    Haptics.selectionAsync();
  } catch {
    // Silently ignore — haptics are an enhancement, not a requirement.
  }
}

/**
 * Fire-and-forget impact haptic.
 * Use for toggle actions (Light) or page transitions (Medium).
 */
export function safeImpactAsync(style: Haptics.ImpactFeedbackStyle): void {
  try {
    Haptics.impactAsync(style);
  } catch {
    // Silently ignore — haptics are an enhancement, not a requirement.
  }
}

/** Fire-and-forget Light impact — use for button/nav taps. */
export function safeImpactLight(): void {
  safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Fire-and-forget Medium impact — use for page/step transitions. */
export function safeImpactMedium(): void {
  safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
