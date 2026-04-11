/** Map Supabase auth errors to user-friendly Korean messages. */
export function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("User already registered"))
    return "이미 가입된 이메일입니다.";
  if (msg.includes("Invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (msg.includes("Email not confirmed"))
    return "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.";
  if (msg.includes("rate limit"))
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  if (msg.includes("Unable to validate email"))
    return "올바른 이메일 형식이 아닙니다.";
  if (msg.includes("Password should be at least"))
    return "비밀번호는 최소 6자 이상이어야 합니다.";
  if (msg.includes("Signups not allowed"))
    return "현재 회원가입이 제한되어 있습니다.";
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("Network request failed") ||
    msg.includes("network")
  )
    return "네트워크 연결을 확인해주세요.";

  return msg;
}
