import { describe, it, expect, vi } from "vitest";
import { delay, retry } from "./async";

describe("src/utils/async", () => {
  it("delay waits at least the requested time (fake timers)", async () => {
    vi.useFakeTimers();

    const done = vi.fn();
    const p = delay(50).then(done);

    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    await p;

    expect(done).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("retry returns immediately when fn succeeds", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await retry(fn, 3, 10);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retry retries failures then succeeds with exponential backoff", async () => {
    vi.useFakeTimers();

    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("nope-1"))
      .mockRejectedValueOnce(new Error("nope-2"))
      .mockResolvedValueOnce("ok");

    const promise = retry(fn, 3, 10);

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBe("ok");

    vi.useRealTimers();
  });

  it("retry throws once retries are exhausted", async () => {
    vi.useFakeTimers();

    const err = new Error("final");
    const fn = vi.fn(async () => {
      throw err;
    });

    await expect(retry(fn, 0, 10)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

