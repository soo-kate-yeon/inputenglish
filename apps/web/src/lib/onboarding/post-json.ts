// @MX:NOTE: [AUTO] Shared client-side POST-JSON helper for the onboarding flow
//   (band-seed / finalize-band / select-course all want identical error semantics:
//   throw on non-ok status, parse JSON on success).

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
