/**
 * The workflow a decision-maker moves through on /people. Its own file so the
 * page's client components can read it without pulling in the database.
 */
export const STATUSES = ["new", "contacted", "replied", "qualified", "not_interested", "do_not_contact"] as const;
export type PersonStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<PersonStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  qualified: "Qualified",
  not_interested: "Not interested",
  do_not_contact: "Do not contact",
};

export const isStatus = (value: unknown): value is PersonStatus => STATUSES.includes(value as PersonStatus);
