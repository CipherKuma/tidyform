import { sendSupportMail, type ContactEnv } from "./contact";
import { checkout, landing, notFound, pricing } from "./pages";
import { captureException, type SentryEnv } from "./sentry";

// Baked in at build time by deploy.mjs (esbuild define): __BREAK_CHECKOUT__ makes checkout fail so Open HQ's Ship
// agent can find and roll back the bad release; __RELEASE__ labels the build in Sentry.
declare const __BREAK_CHECKOUT__: boolean | undefined;
declare const __RELEASE__: string | undefined;
const BROKEN = typeof __BREAK_CHECKOUT__ !== "undefined" && __BREAK_CHECKOUT__ === true;
const RELEASE = typeof __RELEASE__ !== "undefined" ? __RELEASE__ : "dev";

interface Env extends SentryEnv, ContactEnv {
  BREAK_CHECKOUT?: string; // local dev override: "true" breaks checkout without a rebuild
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
}

const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

function assertCheckoutHealthy(env: Env): void {
  if (BROKEN || env.BREAK_CHECKOUT === "true") {
    // The deliberate regression: a release that breaks checkout.
    throw new Error("Checkout failed: payment session could not be created (price lookup returned undefined)");
  }
}

async function startCheckout(env: Env, origin: string): Promise<Response> {
  assertCheckoutHealthy(env);
  if (env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID) {
    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": env.STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      "subscription_data[trial_period_days]": "14",
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/pricing`,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const session = (await res.json()) as { url?: string };
    if (!res.ok || !session.url) throw new Error("Checkout failed: Stripe session creation was rejected");
    return Response.redirect(session.url, 303);
  }
  return html(checkout().replace("Continue to payment", "Trial started (demo)").replace('href="/checkout/start"', 'href="/"'));
}

async function submit(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let data: Record<string, string> = {};
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) data = await request.json();
    else if (type.includes("form")) data = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
    else return json({ error: "Send JSON or a form post", code: "unsupported_type" }, 415);
  } catch {
    return json({ error: "Could not read the submission", code: "bad_body" }, 400);
  }
  if (data.website) return json({ ok: true, id: "sub_ignored" }); // honeypot: pretend success
  const email = String(data.email ?? "").trim();
  const message = String(data.message ?? "").trim();
  if (!/^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(email) || email.length > 200) return json({ error: "A valid email is required", code: "invalid_email" }, 422);
  if (!message || message.length > 5000) return json({ error: "A message up to 5000 characters is required", code: "invalid_message" }, 422);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!allow(ip)) return json({ error: "Too many submissions, try again in a minute", code: "rate_limited" }, 429);
  try {
    const id = await sendSupportMail(env, { name: String(data.name ?? "").trim(), email, subject: String(data.subject ?? "").trim(), message });
    return json({ ok: true, id });
  } catch (err) {
    ctx.waitUntil(captureException(env, err, request));
    return json({ error: "We could not deliver your message right now", code: "delivery_failed" }, 502);
  }
}

const hits = new Map<string, number[]>(); // per-isolate rate limit: 6 submissions per minute per address
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 6) return false;
  hits.set(ip, [...recent, now]);
  return true;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type" } });
      if (url.pathname === "/") return html(landing());
      if (url.pathname === "/pricing") return html(pricing());
      if (url.pathname === "/health") return json({ ok: true, release: RELEASE });
      if (url.pathname === "/checkout") {
        assertCheckoutHealthy(env);
        return html(checkout());
      }
      if (url.pathname === "/checkout/start") return await startCheckout(env, url.origin);
      if (url.pathname === "/api/submit" && request.method === "POST") return await submit(request, env, ctx);
      return html(notFound(), 404);
    } catch (err) {
      ctx.waitUntil(captureException(env, err, request));
      return json({ error: "Something went wrong on our side. We have been notified.", code: "internal" }, 500);
    }
  },
};
