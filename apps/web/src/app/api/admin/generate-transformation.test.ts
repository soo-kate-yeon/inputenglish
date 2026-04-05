/**
 * TDD: SPEC-MOBILE-011 - generate-transformation API route tests
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Create a stable generateContent mock that persists across tests
const generateContent = vi.fn();

vi.mock("@google/generative-ai", () => {
  // Keep stable reference to generateContent inside factory scope
  const gc = generateContent;
  return {
    GoogleGenerativeAI: class {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_apiKey: string) {}
      getGenerativeModel(_opts: unknown) {
        return { generateContent: gc };
      }
    },
  };
});

describe("POST /api/admin/generate-transformation", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });

  it("returns a transformation set with 4 exercises for valid sentences", async () => {
    generateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            set: {
              target_pattern:
                "explain metric changes using declarative sentences",
              pattern_type: "declarative",
            },
            exercises: [
              {
                page_order: 2,
                exercise_type: "kr-to-en",
                instruction_text: "Translate into English.",
                source_korean: "매출 모멘텀이 크게 개선되었습니다.",
              },
              {
                page_order: 3,
                exercise_type: "qa-response",
                instruction_text: "Answer the question.",
                question_text: "What happened to the revenue momentum?",
              },
              {
                page_order: 4,
                exercise_type: "kr-to-en",
                instruction_text: "Translate into English.",
                source_korean: "전환율이 더 높은 기준선에서 안정화되었습니다.",
              },
              {
                page_order: 5,
                exercise_type: "dialog-completion",
                instruction_text: "Complete the dialog.",
                dialog_lines: [
                  {
                    speaker: "Manager",
                    text: "What was the key driver?",
                    is_blank: false,
                  },
                  {
                    speaker: "You",
                    text: "The conversion rate stabilized.",
                    is_blank: true,
                  },
                ],
              },
            ],
          }),
      },
    });

    const { POST } = await import("./generate-transformation/route");
    const response = await POST(
      new Request("http://localhost/api/admin/generate-transformation", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-1",
          sentences: [
            {
              id: "s1",
              text: "Revenue momentum improved significantly after the launch.",
            },
            {
              id: "s2",
              text: "The conversion rate then stabilized at a higher baseline.",
            },
          ],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.set.target_pattern).toBe(
      "explain metric changes using declarative sentences",
    );
    expect(payload.set.pattern_type).toBe("declarative");
    expect(payload.exercises).toHaveLength(4);
    expect(payload.exercises[0].page_order).toBe(2);
    expect(payload.exercises[0].exercise_type).toBe("kr-to-en");
    expect(payload.exercises[1].exercise_type).toBe("qa-response");
    expect(payload.exercises[2].page_order).toBe(4);
    expect(payload.exercises[2].exercise_type).toBe("kr-to-en");
    expect(payload.exercises[3].exercise_type).toBe("dialog-completion");
  });

  it("returns 400 when sessionId or sentences missing", async () => {
    const { POST } = await import("./generate-transformation/route");
    const response = await POST(
      new Request("http://localhost/api/admin/generate-transformation", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-1" }),
      }) as never,
    );

    expect(response.status).toBe(400);
  });

  it("returns 500 when GEMINI_API_KEY is not configured", async () => {
    delete process.env.GEMINI_API_KEY;

    const { POST } = await import("./generate-transformation/route");
    const response = await POST(
      new Request("http://localhost/api/admin/generate-transformation", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-1",
          sentences: [{ id: "s1", text: "Test." }],
        }),
      }) as never,
    );

    expect(response.status).toBe(500);
  });

  it("exercises at page_order 2 and 4 have different source_korean (AC-008)", async () => {
    generateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            set: {
              target_pattern: "explain changes declaratively",
              pattern_type: "declarative",
            },
            exercises: [
              {
                page_order: 2,
                exercise_type: "kr-to-en",
                instruction_text: "Translate.",
                source_korean: "매출 모멘텀이 개선되었습니다.",
              },
              {
                page_order: 3,
                exercise_type: "qa-response",
                instruction_text: "Answer.",
                question_text: "What changed?",
              },
              {
                page_order: 4,
                exercise_type: "kr-to-en",
                instruction_text: "Translate.",
                source_korean: "전환율이 안정화되었습니다.",
              },
              {
                page_order: 5,
                exercise_type: "dialog-completion",
                instruction_text: "Complete.",
                dialog_lines: [
                  { speaker: "A", text: "How did it go?", is_blank: false },
                  { speaker: "B", text: "It went well.", is_blank: true },
                ],
              },
            ],
          }),
      },
    });

    const { POST } = await import("./generate-transformation/route");
    const response = await POST(
      new Request("http://localhost/api/admin/generate-transformation", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-1",
          sentences: [{ id: "s1", text: "Test." }],
        }),
      }) as never,
    );

    const payload = await response.json();
    const ex2 = payload.exercises.find(
      (e: { page_order: number }) => e.page_order === 2,
    );
    const ex4 = payload.exercises.find(
      (e: { page_order: number }) => e.page_order === 4,
    );

    expect(ex2.source_korean).not.toBe(ex4.source_korean);
  });
});
