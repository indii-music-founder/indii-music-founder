import { describe, it, expect } from "vitest";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

describe("json type safety", () => {
  it("accepts valid JSON structures", () => {
    const value: JsonValue = {
      name: "indii",
      count: 3,
      ok: true,
      nested: [1, 2, { a: null }],
    };

    expect(value).toBeDefined();
  });
});
