# Tidyform

A small form backend for indie sites. Demo product for Open HQ, running on Cloudflare Pages
(https://tidyform.pages.dev).

- `/` landing, `/pricing`, `/checkout` and `/checkout/start`, `POST /api/submit`, `/health`
- The contact form (`/api/submit`) delivers each message to the support inbox through Composio's Gmail connection,
  with subject `[Tidyform support] ...` and `Reply-To` set to the customer.
- A release built with `--break` makes `/checkout` throw. The error is reported to Sentry (secret `SENTRY_DSN`) and
  the site returns a 500. Roll back to the previous Pages deployment to recover.
- Optional Stripe sandbox Checkout: secrets `STRIPE_SECRET_KEY` (test key) and `STRIPE_PRICE_ID`.

```bash
node deploy.mjs --secrets                 # healthy release; --secrets pushes COMPOSIO_API_KEY, SENTRY_DSN, STRIPE_* from the environment
node deploy.mjs --break --release v1.1.0  # the bad release
```

`wrangler dev`-style local run: `wrangler deploy --dry-run -c wrangler.build.toml --outdir .build`, copy
`.build/index.js` to `dist/_worker.js`, then `wrangler pages dev dist`.
