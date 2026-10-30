# Tidyform

A small form backend for indie sites. Demo product for Open HQ: a Cloudflare Worker serving a landing page,
pricing, a checkout flow and a form endpoint.

- `/` landing, `/pricing`, `/checkout` (summary) and `/checkout/start` (payment step), `POST /api/submit`, `/health`
- `BREAK_CHECKOUT=true` makes `/checkout` and `/checkout/start` throw. The error is reported to Sentry (set the `SENTRY_DSN` secret)
  and the Worker returns a 500. Roll back to the previous Worker version to recover.
- Optional Stripe sandbox Checkout: set secrets `STRIPE_SECRET_KEY` (test key) and `STRIPE_PRICE_ID`.

```bash
npm install
npx wrangler deploy                                   # healthy release
npx wrangler secret put SENTRY_DSN
npx wrangler deploy --var BREAK_CHECKOUT:true --var RELEASE:v1.1.0   # the bad release
```
