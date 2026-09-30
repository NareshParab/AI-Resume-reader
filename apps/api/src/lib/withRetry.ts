function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns true for errors that should never be retried — misconfigurations,
 * invalid requests, and auth failures will produce the same result on every
 * attempt and burning retries against them wastes quota and time.
 */
function isNonRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  // 400 Bad Request, 401 Unauthorized, 403 Forbidden — retrying won't help
  return (
    msg.includes("[400 bad request]") ||
    msg.includes("[401 unauthorized]") ||
    msg.includes("[403 forbidden]") ||
    msg.includes("api key not valid") ||
    msg.includes("api_key_invalid") ||
    msg.includes("invalid api key") ||
    msg.includes("permission_denied")
  );
}

/**
 * Retries `operation` up to `retryDelays.length + 1` times total.
 *
 * @param operation    Factory that returns a fresh Promise on each call.
 * @param retryDelays  Milliseconds to wait before each retry attempt.
 *                     Defaults to [5000, 10000] (5 s, 10 s) — suitable for
 *                     transient network errors.
 *                     For Gemini free-tier rate-limit recovery pass
 *                     [60_000, 120_000] (1 min, 2 min).
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retryDelays: number[] = [5000, 10000]
): Promise<T> {
  for (let attempt = 0; attempt < retryDelays.length + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Never retry config/auth/bad-request errors — same outcome every time
      if (isNonRetryable(error)) {
        throw error;
      }

      const retryDelay = retryDelays[attempt];
      if (retryDelay === undefined) {
        // No more retries — this was the last attempt
        throw error;
      }

      const label = error instanceof Error ? error.message : String(error);
      console.warn(
        `[withRetry] Attempt ${(attempt + 1).toString()} failed (${label}). ` +
        `Retrying in ${(retryDelay / 1000).toString()} s…`
      );
      await delay(retryDelay);
    }
  }

  throw new Error("Retry operation failed unexpectedly.");
}
