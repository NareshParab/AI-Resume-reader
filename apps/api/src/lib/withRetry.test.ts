import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./withRetry.js";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately on the first successful attempt", async () => {
    const op = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(op);
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries with default delays and succeeds on the second attempt", async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");

    const promise = withRetry(op);
    // Default first retry delay is 5000 ms
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("throws after all attempts are exhausted (default 3 attempts)", async () => {
    const op = vi.fn().mockRejectedValue(new Error("always fails"));

    const promise = withRetry(op);
    // Attach a no-op catch early so Node doesn't flag an unhandled rejection
    // before the assertion below handles it.
    promise.catch(() => undefined);
    // Advance through both default retry delays: 5000 ms + 10000 ms
    await vi.advanceTimersByTimeAsync(5000 + 10000);

    await expect(promise).rejects.toThrow("always fails");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("honours custom retry delays", async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const promise = withRetry(op, [60_000, 120_000]);

    // No success before first delay
    await vi.advanceTimersByTimeAsync(59_999);
    expect(op).toHaveBeenCalledTimes(1);

    // After first delay the second attempt fires
    await vi.advanceTimersByTimeAsync(1);
    expect(op).toHaveBeenCalledTimes(2);

    // After second delay the third attempt fires and succeeds
    await vi.advanceTimersByTimeAsync(120_000);
    const result = await promise;
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry non-retryable auth/config errors (401)", async () => {
    const op = vi.fn().mockRejectedValue(
      new Error("Error fetching: [401 Unauthorized] API key not valid.")
    );

    const promise = withRetry(op);
    // No timer advance needed — should throw synchronously without waiting
    await expect(promise).rejects.toThrow("401 Unauthorized");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry 400 Bad Request errors", async () => {
    const op = vi.fn().mockRejectedValue(
      new Error("Error fetching: [400 Bad Request] Invalid request")
    );

    await expect(withRetry(op)).rejects.toThrow("400 Bad Request");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry 403 Forbidden errors", async () => {
    const op = vi.fn().mockRejectedValue(
      new Error("Error fetching: [403 Forbidden] permission_denied")
    );

    await expect(withRetry(op)).rejects.toThrow("403 Forbidden");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("DOES retry 429 rate-limit errors (retryable)", async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error("Error fetching: [429 Too Many Requests]"))
      .mockResolvedValue("ok");

    const promise = withRetry(op);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("DOES retry 503 Service Unavailable errors (retryable)", async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error("Error fetching: [503 Service Unavailable]"))
      .mockResolvedValue("ok");

    const promise = withRetry(op);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("DOES retry timeout errors (retryable)", async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error("Candidate scoring timed out after 90000ms"))
      .mockResolvedValue("ok");

    const promise = withRetry(op);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });
});
