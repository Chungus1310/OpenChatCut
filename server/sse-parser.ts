/**
 * Tolerant SSE (Server-Sent Events) parser for streaming LLM responses.
 *
 * Adapted from llm-providers.js lines 233-281:
 * - Robust against chunk boundary splits across double newlines or single lines.
 * - Handles optional nested `data:` prefixes defensively.
 * - Gracefully handles `[DONE]` sentinels and silently ignores malformed non-JSON lines.
 */

export interface SSEParserOptions {
  onEvent: (jsonChunk: unknown) => void | Promise<void>;
  onDone?: () => void | Promise<void>;
}

/**
 * Parses an SSE byte stream (e.g. from fetch Response.body) and dispatches parsed JSON chunks.
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  options: SSEParserOptions | ((jsonChunk: unknown) => void | Promise<void>)
): Promise<void> {
  const onEvent = typeof options === 'function' ? options : options.onEvent;
  const onDone = typeof options === 'object' ? options.onDone : undefined;

  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split by double newline blocks per SSE spec
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block) continue;
        const lines = block.split(/\r?\n/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;
          let payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') {
            if (onDone) await onDone();
            return;
          }
          if (payload.startsWith('data:')) payload = payload.slice(5).trim();
          try {
            const json = JSON.parse(payload);
            await onEvent(json);
          } catch {
            // Silently ignore non-JSON payload chunks
          }
        }
      }
    }

    // Process any trailing data block
    const trailing = buffer.trim();
    if (trailing.startsWith('data:')) {
      let payload = trailing.slice(5).trim();
      if (payload && payload !== '[DONE]') {
        try {
          const json = JSON.parse(payload);
          await onEvent(json);
        } catch {
          // Ignore non-JSON
        }
      } else if (payload === '[DONE]' && onDone) {
        await onDone();
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // noop
    }
  }
}
