type RewriteOptions<T> = {
  model: {
    generateContent: (prompt: string) => Promise<{
      response: { text: () => string };
    }>;
  };
  payload: T;
  fieldPaths: string[];
  instructions: string;
};

function hasHangul(text: string): boolean {
  return /[가-힣]/.test(text);
}

function englishLetterCount(text: string): number {
  const matches = text.match(/[A-Za-z]/g);
  return matches ? matches.length : 0;
}

function shouldRewriteText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (hasHangul(trimmed)) return false;
  return englishLetterCount(trimmed) >= 4;
}

function getValueAtPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current == null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      return current[Number(key)];
    }
    if (typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function setValueAtPath(payload: unknown, path: string, value: unknown): void {
  const keys = path.split(".");
  let current = payload as Record<string, unknown>;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const nextKey = keys[index + 1];

    if (Array.isArray(current) && /^\d+$/.test(key)) {
      const next = current[Number(key)];
      current = next as Record<string, unknown>;
      continue;
    }

    if (!(key in current) || current[key] == null) {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }

    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (Array.isArray(current) && /^\d+$/.test(lastKey)) {
    current[Number(lastKey)] = value;
    return;
  }
  current[lastKey] = value;
}

function payloadNeedsRewrite(payload: unknown, fieldPaths: string[]): boolean {
  return fieldPaths.some((path) => {
    const value = getValueAtPath(payload, path);
    if (typeof value === "string") {
      return shouldRewriteText(value);
    }
    if (Array.isArray(value)) {
      return value.some(
        (item) => typeof item === "string" && shouldRewriteText(item),
      );
    }
    return false;
  });
}

export async function rewriteCopyToKoreanIfNeeded<T>({
  model,
  payload,
  fieldPaths,
  instructions,
}: RewriteOptions<T>): Promise<T> {
  if (!payloadNeedsRewrite(payload, fieldPaths)) {
    return payload;
  }

  const prompt = `
너는 영어 학습 앱의 에디터 보조자다.
아래 JSON에서 지정한 필드만 자연스러운 한국어 UX writing으로 다시 써라.

중요 규칙:
- 지정한 필드 외의 값은 바꾸지 마라
- 숫자, 인덱스, id, enum 값은 절대 바꾸지 마라
- 영어 설명문을 한국어 서비스 문구처럼 짧고 자연스럽게 바꿔라
- 고유명사, 인명, 프로그램명은 필요하면 유지해도 된다
- 결과는 반드시 JSON만 반환해라

대상 필드:
${fieldPaths.join("\n")}

추가 지시:
${instructions}

원본 JSON:
${JSON.stringify(payload, null, 2)}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const cleaned = responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const localized = JSON.parse(cleaned) as T;
  const nextPayload = JSON.parse(JSON.stringify(payload)) as T;

  for (const path of fieldPaths) {
    const localizedValue = getValueAtPath(localized, path);
    if (localizedValue !== undefined) {
      setValueAtPath(nextPayload, path, localizedValue);
    }
  }

  return nextPayload;
}

export function containsEnglishHeavyText(
  value: string | undefined | null,
): boolean {
  if (!value) return false;
  return shouldRewriteText(value);
}
