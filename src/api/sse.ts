/**
 * 读取 SSE `data:` JSON 事件。onEvent 返回 true 时提前结束。
 */
export async function consumeSseJson<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => boolean | void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.replace(/^data:\s?/, "").trim();
          if (!raw) continue;

          let event: T;
          try {
            event = JSON.parse(raw) as T;
          } catch {
            continue;
          }

          if (onEvent(event)) return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
