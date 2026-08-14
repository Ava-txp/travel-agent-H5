export const SLOW_TTFT_MS = 8_000;
export const CONNECT_TIMEOUT_MS = 12_000;
export const CHUNK_IDLE_MS = 15_000;
export const ELAPSED_TICK_MS = 500;

export const totalTimeoutMs = (days: number) =>
  30_000 + Math.max(days, 1) * 20_000;
