export function createFetchWithTimeout(timeoutMs = 10000): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signals = [controller.signal];
    if (init?.signal) signals.push(init.signal);
    const signal = typeof AbortSignal.any === 'function' 
      ? AbortSignal.any(signals) 
      : signals[0]; // fallback
    try {
      return await fetch(input, { ...init, signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}
