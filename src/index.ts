import { checkout, landing, notFound, pricing } from "./pages";
import { captureException, type SentryEnv } from "./sentry";

interface Env extends SentryEnv {
  BREAK_CHECKOUT?: string; // "true" makes checkout fail, so Open HQ's Ship agent can find and roll back the bad release
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
}

const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

function assertCheckoutHealthy(env: Env): void {
  if (env.BREAK_CHECKOUT === "true") {
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

async function submit(request: Request): Promise<Response> {
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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "A valid email is required", code: "invalid_email" }, 422);
  if (!message || message.length > 5000) return json({ error: "A message up to 5000 characters is required", code: "invalid_message" }, 422);
  return json({ ok: true, id: `sub_${crypto.randomUUID().slice(0, 8)}` });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type" } });
      if (url.pathname === "/") return html(landing());
      if (url.pathname === "/pricing") return html(pricing());
      if (url.pathname === "/health") return json({ ok: true, release: env.RELEASE ?? "unknown" });
      if (url.pathname === "/checkout") {
        assertCheckoutHealthy(env);
        return html(checkout());
      }
      if (url.pathname === "/checkout/start") return await startCheckout(env, url.origin);
      if (url.pathname === "/api/submit" && request.method === "POST") return await submit(request);
      return html(notFound(), 404);
    } catch (err) {
      ctx.waitUntil(captureException(env, err, request));
      return json({ error: "Something went wrong on our side. We have been notified.", code: "internal" }, 500);
    }
  },
};
