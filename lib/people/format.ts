// In Joshua's time zone, fixed, so the server and the browser print the same
// thing (see lib/places/contact-status.ts). Shared by /people's server page and
// its client parts, so it stays free of anything server-only.
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });
const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

export const formatDay = (d: Date | string) => DAY.format(new Date(d));
export const formatWhen = (d: Date | string) => WHEN.format(new Date(d));
