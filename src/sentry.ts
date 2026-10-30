// Dependency-free Sentry reporting: posts an error event to the project's envelope endpoint using the DSN.
export interface SentryEnv { SENTRY_DSN?: string; RELEASE?: string }

export async function captureException(env: SentryEnv, err: unknown, request: Request): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    const dsn = new URL(env.SENTRY_DSN);
    const projectId = dsn.pathname.replace(/\//g, "");
    const e = err instanceof Error ? err : new Error(String(err));
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const url = new URL(request.url);
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      server_name: "openhq-tidyform",
      release: env.RELEASE ?? "unknown",
      environment: "production",
      tags: { route: url.pathname, runtime: "cloudflare-workers" },
      request: { url: request.url, method: request.method },
      exception: { values: [{ type: e.name, value: e.message, stacktrace: stack(e) }] },
    };
    const body = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: env.SENTRY_DSN }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");
    await fetch(`${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/`, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.username}, sentry_client=tidyform/1.0` },
      body,
    });
  } catch {
    // reporting must never break the request
  }
}

function stack(e: Error) {
  const frames = (e.stack ?? "").split("\n").slice(1).map((l) => {
    const m = l.match(/at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
    return m ? { function: m[1] ?? "<anonymous>", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: true } : null;
  }).filter(Boolean).reverse();
  return { frames };
}
