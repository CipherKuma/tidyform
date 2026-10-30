// Delivers a contact-form submission to the support inbox through Composio's Gmail connection.
// Subject carries the "[Tidyform support] " prefix and Reply-To is the customer, so the inbox sees it honestly.
// Uses the Gmail API send endpoint via Composio's session proxy (Composio's send tool has no Reply-To field).
export interface ContactEnv {
  COMPOSIO_API_KEY?: string; // Worker secret
  COMPOSIO_USER_ID?: string; // default "openhq-demo"
  SUPPORT_INBOX?: string; // default jedionchain@gmail.com
}
export interface Submission { name: string; email: string; subject: string; message: string }

const API = "https://backend.composio.dev";
let session: Promise<string> | null = null;

async function composio(env: ContactEnv, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(API + path, { ...init, headers: { "x-api-key": env.COMPOSIO_API_KEY!, "content-type": "application/json" } });
  if (!res.ok) throw new Error(`delivery backend returned ${res.status}`);
  return res.json();
}

function getSession(env: ContactEnv): Promise<string> {
  if (!session) {
    const user = env.COMPOSIO_USER_ID ?? "openhq-demo";
    session = (async () => {
      const accts = await composio(env, `/api/v3/connected_accounts?user_ids=${encodeURIComponent(user)}&toolkit_slugs=gmail&statuses=ACTIVE`);
      const id = accts.items?.[0]?.id;
      if (!id) throw new Error("no active Gmail connection");
      const s = await composio(env, "/api/v3.1/tool_router/session", {
        method: "POST",
        body: JSON.stringify({ user_id: user, toolkits: { enable: ["gmail"] }, connected_accounts: { gmail: id }, proxy_execute: { enable: true }, manage_connections: { enable: false }, workbench: { enable: false }, search: { enable: false } }),
      });
      return s.session_id as string;
    })().catch((e) => { session = null; throw e; });
  }
  return session;
}

const clean = (v: string, max: number) => v.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64url = (s: string) => b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encodeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export function buildMime(to: string, sub: Submission): string {
  const name = clean(sub.name, 80);
  const email = clean(sub.email, 200);
  const subject = clean(sub.subject, 120) || clean(sub.message, 70);
  const replyTo = name ? `${encodeWord(name.replace(/["<>]/g, ""))} <${email}>` : email;
  const body = `New message from the Tidyform contact form.\n\nFrom: ${name || "(no name)"} <${email}>\n\n${sub.message}\n`;
  return [
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeWord(`[Tidyform support] ${subject}`)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}

export async function sendSupportMail(env: ContactEnv, sub: Submission): Promise<string> {
  if (!env.COMPOSIO_API_KEY) throw new Error("delivery is not configured");
  const sid = await getSession(env);
  const raw = b64url(buildMime(env.SUPPORT_INBOX ?? "jedionchain@gmail.com", sub));
  const r = await composio(env, `/api/v3.1/tool_router/session/${sid}/proxy_execute`, {
    method: "POST",
    body: JSON.stringify({ toolkit_slug: "gmail", endpoint: "/gmail/v1/users/me/messages/send", method: "POST", body: { raw } }),
  });
  if (r.status && r.status >= 300) throw new Error(`Gmail send failed (${r.status})`);
  return `sub_${String(r.data?.id ?? crypto.randomUUID()).slice(0, 10)}`;
}
