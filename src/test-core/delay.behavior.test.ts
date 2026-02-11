import { describe, it, expect, vi } from "vitest";
import { delay } from "../utils/async";

describe("delay behavior", () => {
  it("resolves after the specified time", async () => {
    vi.useFakeTimers();

    const promise = delay(1000);
    vi.advanceTimersByTime(1000);

    await expect(promise).resolves.toBeUndefined();

    vi.useRealTimers();
  });
});
