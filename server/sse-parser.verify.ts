import { deepStrictEqual, strictEqual } from 'node:assert';
import { parseSSEStream } from './sse-parser.ts';

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
}

async function runSSEParserTests(): Promise<void> {
  const events: unknown[] = [];
  let doneCalled = false;

  const stream = createMockStream([
    'data: {"message":"hello"}\n\n',
    'data: {"message":"wor',
    'ld"}\n\ndata: non-json\n\n',
    'data: [DONE]\n\n',
  ]);

  await parseSSEStream(stream, {
    onEvent: (json) => {
      events.push(json);
    },
    onDone: () => {
      doneCalled = true;
    },
  });

  deepStrictEqual(events, [
    { message: 'hello' },
    { message: 'world' },
  ]);
  strictEqual(doneCalled, true);

  console.log('sse-parser.verify: all assertions passed');
}

void runSSEParserTests();
