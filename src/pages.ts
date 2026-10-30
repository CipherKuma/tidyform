const css = `
:root{--ink:#14201b;--muted:#5d6b64;--bg:#f6f3ec;--card:#fff;--line:#e3ded1;--brand:#1f6f54;--brand-ink:#fff}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--brand)}.wrap{max-width:960px;margin:0 auto;padding:0 20px}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 0}
.logo{font-weight:700;font-size:20px;letter-spacing:-.02em;text-decoration:none;color:var(--ink)}
nav a{margin-left:20px;text-decoration:none;color:var(--muted)}nav a:hover{color:var(--ink)}
.hero{padding:56px 0 40px}h1{font-size:clamp(34px,6vw,56px);line-height:1.05;letter-spacing:-.03em;margin:0 0 16px;max-width:14em}
.lead{font-size:19px;color:var(--muted);max-width:34em}.btn{display:inline-block;background:var(--brand);color:var(--brand-ink);padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;border:0;font-size:16px;cursor:pointer}
.btn.alt{background:transparent;color:var(--ink);border:1px solid var(--line);margin-left:8px}
pre{background:#14201b;color:#e8f3ee;padding:16px;border-radius:12px;overflow:auto;font-size:14px}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin:32px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}.card h3{margin:0 0 6px}
.price{font-size:44px;font-weight:700;letter-spacing:-.03em}.price small{font-size:16px;color:var(--muted);font-weight:500}
ul{padding-left:18px;color:var(--muted)}footer{padding:40px 0;color:var(--muted);font-size:14px}
form.demo{display:grid;gap:10px;max-width:420px}input,textarea{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff}
`;

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="Tidyform is a form backend for indie sites: point your HTML form at us, get submissions by email."><style>${css}</style></head><body><div class="wrap"><header><a class="logo" href="/">Tidyform</a><nav><a href="/pricing">Pricing</a><a href="/checkout">Start free trial</a></nav></header>${body}<footer>Tidyform, a form backend for indie sites. Demo product built for Open HQ. <a href="https://github.com/CipherKuma/tidyform">Source</a></footer></div></body></html>`;

export const landing = () => shell("Tidyform: forms for indie sites", `
<section class="hero"><h1>Forms for your site. No backend.</h1>
<p class="lead">Point any HTML form at Tidyform. Submissions land in your inbox, spam is filtered, and nothing to host.</p>
<p><a class="btn" href="/checkout">Start free trial</a><a class="btn alt" href="/pricing">See pricing</a></p>
<pre>&lt;form action="https://tidyform.example/api/submit" method="post"&gt;
  &lt;input name="email" type="email" required&gt;
  &lt;textarea name="message"&gt;&lt;/textarea&gt;
  &lt;button&gt;Send&lt;/button&gt;
&lt;/form&gt;</pre></section>
<section class="grid">
<div class="card"><h3>Inbox delivery</h3><p>Every submission arrives as a clean email, with the sender's address set as reply-to.</p></div>
<div class="card"><h3>Spam filtering</h3><p>Honeypot field and rate limits catch the bots before they reach you.</p></div>
<div class="card"><h3>Works anywhere</h3><p>Static sites, Notion embeds, a hand-built portfolio: if it can post a form, it works.</p></div>
</section>
<section class="card" style="max-width:480px"><h3>Try it</h3><form class="demo" id="f"><input name="name" placeholder="Your name"><input name="email" type="email" placeholder="you@yourdomain.com" required><textarea name="message" rows="3" placeholder="Say hello" required></textarea><input name="website" style="display:none" tabindex="-1" autocomplete="off"><button class="btn">Send test submission</button><span id="out" role="status"></span></form></section>
<script>document.getElementById("f").addEventListener("submit",async e=>{e.preventDefault();const r=await fetch("/api/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});const j=await r.json();document.getElementById("out").textContent=r.ok?"Received: "+j.id:j.error})</script>`);

export const pricing = () => shell("Pricing: Tidyform", `
<section class="hero"><h1>One plan. Twelve dollars.</h1><p class="lead">Unlimited forms, 5,000 submissions a month, email delivery and spam filtering.</p></section>
<section class="card" style="max-width:420px"><div class="price">$12<small> / month</small></div>
<ul><li>Unlimited forms and domains</li><li>5,000 submissions per month</li><li>Spam filtering and rate limits</li><li>Email support, answered within a day</li></ul>
<p><a class="btn" href="/checkout">Start free trial</a></p></section>`);

export const checkout = () => shell("Checkout: Tidyform", `
<section class="hero"><h1>Start your 14-day trial</h1><p class="lead">Tidyform Pro, $12 per month after the trial. Cancel any time.</p></section>
<section class="card" style="max-width:420px"><h3>Order summary</h3><p>Tidyform Pro, monthly</p><p class="price">$12<small> / month</small></p>
<p>Test mode: use card 4242 4242 4242 4242.</p><p><a class="btn" href="/checkout/start">Continue to payment</a></p></section>`);

export const notFound = () => shell("Not found", `<section class="hero"><h1>Page not found</h1><p class="lead"><a href="/">Back home</a></p></section>`);
