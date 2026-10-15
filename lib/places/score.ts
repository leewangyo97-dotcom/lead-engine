import type { SiteSignals } from "./extract";
import { isWhatsAppCapable } from "./phone";
import { publicDomain } from "./public-institution";
import { emailUnconfirmed } from "./contact";
import { mistypedEmail } from "./email-typo";
import { emailDomainDead, type EmailCheck } from "./email-mx";

/**
 * Scoring a prospect: how worth contacting they are, and why.
 *
 * Every point is traceable to a stated reason. A single number nobody can
 * question is a number nobody can improve — when a run produces a bad list, the
 * reasons say which weight was wrong, and that is the only way the weights ever
 * get better.
 *
 * The scale is deliberately not a probability. It is a sort order for a person
 * deciding who to message first, and it says so.
 */

export interface ScorableProspect {
  name: string;
  category?: string | null;
  city?: string | null;
  website?: string | null;
  email?: string | null;
  /** "mailto" or "text" when found on their own site; "osm" when only on the map. */
  emailConfidence?: string | null;
  /** The address bounced: worth nothing (lib/places/bounce.ts). */
  emailBounced?: boolean;
  /** Its domain has no mail server: worth nothing either (lib/places/email-mx.ts). */
  emailCheck?: EmailCheck | null;
  phoneE164?: string | null;
  whatsappE164?: string | null;
  enrichmentStatus?: string | null;
  siteSignals?: Record<string, unknown> | null;
  status?: string | null;
}

export interface ScoreResult {
  score: number;
  /** Each contribution, keyed by what it was for. Sums to the raw score. */
  reasons: Record<string, number>;
  tier: "hot" | "warm" | "cold";
}

/**
 * The weights, in one place, so a disagreement about priorities is a
 * conversation about this object rather than an argument with the code.
 */
export const WEIGHTS = {
  /** Reachability first: an unreachable prospect cannot be worked at all. */
  whatsappPublished: 30,
  mobileNumber: 25,
  email: 20,
  /** An address only the map listing holds: all three bounces on 14 Oct were these. */
  emailUnconfirmed: 8,
  landlineOnly: 5,

  /** The pitch is building websites, so not having one is the opening. */
  noWebsite: 25,
  siteNoHttps: 15,
  siteNoViewport: 15,
  /** A site with a booking flow is a business already spending on its web presence. */
  siteHasBooking: 5,

  /** Small signals that a lead is real and local rather than a stale node. */
  hasCity: 5,
  knownCategory: 5,
} as const;

/** Above this, contact today. Below the second, only when the list runs dry. */
export const HOT_AT = 60;
export const WARM_AT = 35;

export function scoreProspect(place: ScorableProspect): ScoreResult {
  const reasons: Record<string, number> = {};

  const number = place.whatsappE164 ?? place.phoneE164 ?? null;
  if (place.whatsappE164) {
    reasons.whatsappPublished = WEIGHTS.whatsappPublished;
  } else if (number && isWhatsAppCapable(number)) {
    reasons.mobileNumber = WEIGHTS.mobileNumber;
  } else if (number) {
    // A landline is a way in, but a slower one: it means a call or an email,
    // not a message answered between customers.
    reasons.landlineOnly = WEIGHTS.landlineOnly;
  }

  // A confirmed address outranks one the map listing alone holds, and a
  // bounced one counts for nothing.
  // A mistyped address (email-typo.ts) bounces like a bounced one: no email at all.
  const usableEmail =
    !!place.email && !place.emailBounced && !mistypedEmail(place.email) && !emailDomainDead(place);
  if (usableEmail) {
    if (emailUnconfirmed(place)) reasons.emailUnconfirmed = WEIGHTS.emailUnconfirmed;
    else reasons.email = WEIGHTS.email;
  }

  if (!place.website) {
    reasons.noWebsite = WEIGHTS.noWebsite;
  } else {
    const signals = (place.siteSignals ?? {}) as Partial<SiteSignals>;
    // Only what was actually measured. An unenriched site is unknown, not good,
    // and scoring it as though it passed would promote prospects nobody checked.
    if (signals.noHttps === true) reasons.siteNoHttps = WEIGHTS.siteNoHttps;
    if (signals.noViewport === true) reasons.siteNoViewport = WEIGHTS.siteNoViewport;
    if (signals.hasBookingForm === true) reasons.siteHasBooking = WEIGHTS.siteHasBooking;
  }

  if (place.city) reasons.hasCity = WEIGHTS.hasCity;
  if (place.category) reasons.knownCategory = WEIGHTS.knownCategory;

  // A public body cancels everything above it, and the reason says so on hover.
  if (publicDomain(place.email)) {
    reasons.publicInstitution = -Object.values(reasons).reduce((sum, n) => sum + n, 0);
  }

  const raw = Object.values(reasons).reduce((sum, n) => sum + n, 0);
  const score = Math.max(0, Math.min(100, raw));

  // Reachability is a gate, not a weight. A business with no phone and no email
  // cannot be contacted at all, so however good a prospect it looks on paper it
  // must never outrank one that can actually be messaged today. Someone who
  // asked not to be contacted is the same case for a stronger reason: they are
  // reachable and must not be reached.
  const reachable = !!(number || usableEmail);
  const allowed = place.status !== "do_not_contact" && !publicDomain(place.email);
  const tier =
    !reachable || !allowed ? "cold" : score >= HOT_AT ? "hot" : score >= WARM_AT ? "warm" : "cold";

  return { score, reasons, tier };
}

/**
 * Whether a score can be trusted yet.
 *
 * A prospect whose website has never been read has no site signals, so its score
 * is made of contact details alone. Saying that out loud stops the list from
 * implying a judgement it has not made.
 */
export function isScoreProvisional(place: ScorableProspect): boolean {
  return !!place.website && place.enrichmentStatus === "pending";
}
