/**
 * Normalize an email for authentication: strip surrounding whitespace (often
 * appended by keyboard autofill) and lowercase it. Supabase stores emails
 * lowercased, so this keeps client input consistent and avoids spurious
 * "Invalid login credentials" / "Unable to validate email" errors.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
