import tlds from "tlds";

/**
 * Addresses that cannot be delivered because the domain is mistyped.
 *
 * Found on 15 Oct: We Love Trees' address on file ends in ".xom", copied from
 * the map listing, where nobody checks what is typed. Two kinds are caught: a
 * top-level domain that does not exist (checked against IANA's list, the `tlds`
 * package), and a known slip on a free-mail domain ("gmial.com"), whose ending
 * is real. The address is flagged, never corrected: a corrected address is a
 * guess, and guesses are not sent (DECISIONS, 14 Oct). The suggestion is for a
 * person to check and fix by hand.
 */
const TLDS = new Set(tlds);

// What a mistyped ending almost certainly meant. Only for the hint.
const TLD_SLIPS: Record<string, string> = {
  xom: "com",
  cpm: "com",
  vom: "com",
  con: "com",
  cim: "com",
  cmo: "com",
  ocm: "com",
  comm: "com",
  coom: "com",
  ccom: "com",
  clm: "com",
  nte: "net",
  ner: "net",
  nett: "net",
  ogr: "org",
  orh: "org",
  rog: "org",
  prg: "org",
};

// Free-mail domains typed wrong on a real ending. Small businesses use these a lot.
const DOMAIN_SLIPS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "iclod.com": "icloud.com",
};

export interface Mistyped {
  domain: string;
  /** The domain it was probably meant to be, when the slip is a known one. */
  suggestion: string | null;
}

export function mistypedEmail(email: string | null | undefined): Mistyped | null {
  const domain = email?.split("@")[1]?.trim().toLowerCase().replace(/\.$/, "");
  // No domain at all is a different problem, and other checks own it.
  if (!domain || !domain.includes(".")) return null;
  if (DOMAIN_SLIPS[domain]) return { domain, suggestion: DOMAIN_SLIPS[domain] };
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (TLDS.has(tld) || tld.startsWith("xn--")) return null;
  const meant = TLD_SLIPS[tld];
  return { domain, suggestion: meant ? `${domain.slice(0, -tld.length)}${meant}` : null };
}

export function mistypedReason(m: Mistyped): string {
  return `the address looks mistyped (${m.domain}${m.suggestion ? `, probably ${m.suggestion}` : ""}), so it would bounce`;
}
