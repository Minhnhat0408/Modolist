import { describe, it, expect } from "vitest";
import { signInSchema } from "./zod";

describe("signInSchema", () => {
  const validData = { email: "user@example.com", password: "securepass" };

  // ─── Valid cases ─────────────────────────────────────────────────────────
  it("accepts valid email and password", () => {
    const result = signInSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts password at exactly 8 characters", () => {
    const result = signInSchema.safeParse({ ...validData, password: "12345678" });
    expect(result.success).toBe(true);
  });

  it("accepts password at exactly 32 characters", () => {
    const result = signInSchema.safeParse({ ...validData, password: "a".repeat(32) });
    expect(result.success).toBe(true);
  });

  // ─── Email validation ────────────────────────────────────────────────────
  it("rejects empty email", () => {
    const result = signInSchema.safeParse({ ...validData, email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = signInSchema.safeParse({ ...validData, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing @ in email", () => {
    const result = signInSchema.safeParse({ ...validData, email: "userdomain.com" });
    expect(result.success).toBe(false);
  });

  // ─── Password validation ─────────────────────────────────────────────────
  it("rejects empty password", () => {
    const result = signInSchema.safeParse({ ...validData, password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = signInSchema.safeParse({ ...validData, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 32 characters", () => {
    const result = signInSchema.safeParse({ ...validData, password: "a".repeat(33) });
    expect(result.success).toBe(false);
  });

  // ─── Missing fields ──────────────────────────────────────────────────────
  it("rejects missing email field", () => {
    const result = signInSchema.safeParse({ password: "securepass" });
    expect(result.success).toBe(false);
  });

  it("rejects missing password field", () => {
    const result = signInSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects empty object", () => {
    const result = signInSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  // ─── Parsed output ───────────────────────────────────────────────────────
  it("returns correct parsed values on success", () => {
    const result = signInSchema.safeParse(validData);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.password).toBe("securepass");
    }
  });
});
