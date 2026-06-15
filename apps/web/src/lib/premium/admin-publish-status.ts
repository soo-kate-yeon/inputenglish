export interface PremiumAdminFailureStatus {
  message: string;
  issues: string[];
}

export function normalizePremiumAdminFailure(
  payload: unknown,
  fallbackMessage: string,
): PremiumAdminFailureStatus {
  if (!payload || typeof payload !== "object") {
    return { message: fallbackMessage, issues: [] };
  }

  const record = payload as Record<string, unknown>;
  const message =
    typeof record.error === "string" && record.error.trim()
      ? record.error
      : fallbackMessage;
  const issues = Array.isArray(record.issues)
    ? record.issues.filter(
        (issue): issue is string => typeof issue === "string",
      )
    : [];

  return { message, issues };
}
