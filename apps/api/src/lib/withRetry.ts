function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const retryDelays = [5000, 10000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retryDelays.length) {
        throw error;
      }
      const retryDelay = retryDelays[attempt];
      if (retryDelay === undefined) {
        throw error;
      }
      await delay(retryDelay);
    }
  }

  throw new Error("Retry operation failed unexpectedly.");
}