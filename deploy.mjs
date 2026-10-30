#!/usr/bin/env node
// Builds Tidyform and deploys it to the Cloudflare Pages project "tidyform" (tidyform.pages.dev).
//   node deploy.mjs                       healthy release
//   node deploy.mjs --break               release whose /checkout throws (and reports to Sentry)
//   node deploy.mjs --release v1.1.0 --message "checkout rewrite"
//   node deploy.mjs --secrets             also push COMPOSIO_API_KEY / SENTRY_DSN / STRIPE_* from the environment
// Uses wrangler's existing Cloudflare login (or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment).
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const val = (flag, fb) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fb);
const broken = args.includes("--break");
const release = val("--release", broken ? "v1.1.0" : "v1.0.0");
const message = val("--message", broken ? `Release ${release}: checkout rewrite` : `Release ${release}`);
const PROJECT = "tidyform";
const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { cwd: here, stdio: "inherit", ...opts });

rmSync(join(here, ".build"), { recursive: true, force: true });
rmSync(join(here, "dist"), { recursive: true, force: true });
run("wrangler", ["deploy", "--dry-run", "-c", "wrangler.build.toml", "--outdir", ".build",
  "--define", `__BREAK_CHECKOUT__:${broken}`, "--define", `__RELEASE__:${JSON.stringify(release)}`]);
mkdirSync(join(here, "dist"), { recursive: true });
cpSync(join(here, ".build", "index.js"), join(here, "dist", "_worker.js"));

const list = spawnSync("wrangler", ["pages", "project", "list"], { cwd: here, encoding: "utf8" });
if (!list.stdout?.includes(PROJECT)) run("wrangler", ["pages", "project", "create", PROJECT, "--production-branch", "main"]);

if (args.includes("--secrets")) {
  for (const name of ["COMPOSIO_API_KEY", "SENTRY_DSN", "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"]) {
    if (!process.env[name]) continue;
    spawnSync("wrangler", ["pages", "secret", "put", name, "--project-name", PROJECT], { cwd: here, input: process.env[name], stdio: ["pipe", "inherit", "inherit"] });
  }
}
run("wrangler", ["pages", "deploy", "dist", "--project-name", PROJECT, "--branch", "main", "--commit-message", message, "--commit-dirty=true"]);
process.stdout.write(`\nDeployed ${release}${broken ? " (BROKEN checkout)" : ""} to https://${PROJECT}.pages.dev\n`);
if (!existsSync(join(here, "dist", "_worker.js"))) process.exit(1);
