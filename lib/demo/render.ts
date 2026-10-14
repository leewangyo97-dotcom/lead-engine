import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { nounFor } from "../places/email-message";
import { publicDomain } from "../places/public-institution";

/**
 * The one-page demo website for a business that has none: "show, don't tell".
 *
 * Asked for on 14 Oct, after 48 first messages and no reply. An offer to build
 * something asks an owner to imagine it. A page that already exists, with their
 * own name and phone number on it, only asks them to look.
 *
 * Every fact on the page comes from their public map listing: name, kind of
 * business, town, address, phone, email. Nothing else is claimed. There are no
 * services, prices, hours or reviews, because none of those are known. Those
 * spaces are drawn as placeholders, labelled as such. The page says at the top,
 * in plain words, that it is a demo and not their website, and it asks search
 * engines not to index it, so it can never pass for them in a search.
 */
export interface DemoPlace {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  addressLine: string | null;
  website: string | null;
  email: string | null;
  phoneE164: string | null;
  whatsappE164: string | null;
  lat: number | null;
  lon: number | null;
  status?: string | null;
}

export const PORTFOLIO = "https://joshuasenining.dev/";
const WHATSAPP = "+63 915 858 7388";

/** Why a business cannot have a demo, or null when it can. */
export function demoIneligible(place: Pick<DemoPlace, "website" | "email" | "status">): string | null {
  if (place.website) return "they already have a website";
  if (place.status === "do_not_contact") return "on the do-not-contact list";
  if (publicDomain(place.email)) return "a public body, not a prospect";
  return null;
}

/** "bay-dental-studio-ab12cd": readable, and unique by the id it ends with. */
export function demoSlug(place: Pick<DemoPlace, "id" | "name">): string {
  const words = place.name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${words || "demo"}-${place.id.slice(0, 6).toLowerCase()}`;
}

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function displayPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

function directions(place: DemoPlace): string {
  const query =
    place.lat != null && place.lon != null
      ? `${place.lat},${place.lon}`
      : [place.name, place.addressLine, place.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** The buttons a visitor would press, best first, from what the listing has. */
function actions(place: DemoPlace): string[] {
  const out: string[] = [];
  if (place.whatsappE164) {
    out.push(`<a class="btn primary" href="https://wa.me/${place.whatsappE164.replace(/\D/g, "")}">Message us on WhatsApp</a>`);
  }
  if (place.phoneE164) {
    out.push(
      `<a class="btn ${out.length ? "ghost" : "primary"}" href="tel:${esc(place.phoneE164)}">Call ${esc(displayPhone(place.phoneE164))}</a>`,
    );
  }
  if (place.email) {
    out.push(`<a class="btn ${out.length ? "ghost" : "primary"}" href="mailto:${esc(place.email)}">Email us</a>`);
  }
  out.push(`<a class="btn ghost" href="${esc(directions(place))}">Get directions</a>`);
  return out;
}

export function renderDemo(place: DemoPlace): { slug: string; html: string } {
  const name = esc(place.name.trim());
  const kind = capitalised(nounFor(place.category ?? ""));
  const where = place.city ? ` · ${esc(place.city)}` : "";
  const address = place.addressLine ?? place.city;
  const placeholder = (text: string) => `<div class="placeholder">${text}</div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${name}: website demo</title>
<style>
:root{--ink:#16181f;--muted:#5d6272;--line:#e5e6ee;--bg:#f6f6fa;--card:#fff;--accent:#5847eb;--on:#fff}
*{box-sizing:border-box}
body{margin:0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
.demo{background:var(--ink);color:#fff;font-size:13px;padding:8px 16px;text-align:center}
.demo a{color:#cfc8ff}
.wrap{max-width:880px;margin:0 auto;padding:0 20px}
header{background:var(--card);border-bottom:1px solid var(--line)}
.hero{padding:48px 0 40px}
.kind{color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:0}
h1{font-size:clamp(30px,6vw,46px);line-height:1.12;margin:8px 0 12px}
.lead{color:var(--muted);font-size:18px;margin:0 0 24px;max-width:34em}
.cta{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-block;padding:14px 22px;border-radius:12px;font-weight:600;text-decoration:none}
.btn.primary{background:var(--accent);color:var(--on)}
.btn.ghost{background:var(--card);color:var(--ink);border:1px solid var(--line)}
section{padding:36px 0;border-top:1px solid var(--line)}
h2{font-size:22px;margin:0 0 14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.placeholder{border:2px dashed #cdd0dc;border-radius:12px;padding:24px;color:var(--muted);background:#fbfbfd;min-height:120px}
footer{padding:32px 0 48px;color:var(--muted);font-size:14px}
footer a{color:var(--accent)}
</style>
</head>
<body>
<div class="demo">A free demo made for ${name} by Joshua Senining (<a href="${PORTFOLIO}">joshuasenining.dev</a>). This is not their official website.</div>
<header>
<div class="wrap hero">
<p class="kind">${esc(kind)}${where}</p>
<h1>${name}</h1>
<p class="lead">See what we offer and get in touch in one tap.</p>
<div class="cta">${actions(place).join("")}</div>
</div>
</header>
<main class="wrap">
<section>
<h2>Services and prices</h2>
<div class="grid">${placeholder("Your services go here.")}${placeholder("Your prices go here.")}</div>
</section>
<section>
<h2>Photos</h2>
<div class="grid">${placeholder("A photo of your place.")}${placeholder("A photo of your team.")}${placeholder("A photo of your work.")}</div>
</section>
<section>
<h2>Find us</h2>
<p>${address ? esc(address) : "Your address goes here."}</p>
<a class="btn ghost" href="${esc(directions(place))}">Open in Google Maps</a>
</section>
</main>
<footer class="wrap">
This demo was built from your public map listing. Want it live, with your own photos, services and prices?
Reply to my email, or message me on WhatsApp at ${WHATSAPP}.
<br>Joshua Senining, web and app developer in the Philippines · <a href="${PORTFOLIO}">joshuasenining.dev</a>
</footer>
</body>
</html>
`;
  return { slug: demoSlug(place), html };
}
