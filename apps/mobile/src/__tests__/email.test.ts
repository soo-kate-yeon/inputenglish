import { normalizeEmail } from "@/lib/email";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  a@b.com ")).toBe("a@b.com");
  });

  it("lowercases the address", () => {
    expect(normalizeEmail("A@B.CoM")).toBe("a@b.com");
  });

  it("handles already-clean input", () => {
    expect(normalizeEmail("a@b.com")).toBe("a@b.com");
  });

  it("strips tab/newline whitespace from autofill", () => {
    expect(normalizeEmail("\tUser@Example.com\n")).toBe("user@example.com");
  });
});
