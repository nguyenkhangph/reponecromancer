// Minimal node:test reporter that emits one JSON line per finished test (suites excluded).
export default async function* reporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data;
    if (d.details?.type === 'suite') continue;
    const err = d.details?.error;
    let message = null;
    if (err) {
      const cause = err.cause ?? err;
      message = String(cause?.message ?? cause).split('\n').slice(0, 8).join('\n');
    }
    yield JSON.stringify({ name: d.name, ok: event.type === 'test:pass', durationMs: d.details?.duration_ms ?? null, error: message }) + '\n';
  }
}
