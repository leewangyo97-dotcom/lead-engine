/**
 * Which suppression entries a prospect may take back with it.
 *
 * Declining writes the prospect's email, phone, WhatsApp number and domain to
 * the suppression list, and the list is keyed on the value rather than on the
 * prospect. That is deliberate — a "no" is from a business, not from a row — and
 * it means the identifiers are shared: 95 rows in this table carry a phone
 * number another business also has, twelve preschools answering on one council
 * switchboard among them.
 *
 * So an undo cannot simply delete what the decline wrote. Releasing that
 * switchboard number because one preschool was declined by mistake would quietly
 * un-suppress the eleven that said no properly, and the next run would message
 * them again. An entry may only go back if no other still-declined prospect owns
 * it.
 *
 * The reverse mistake is the cheaper one: an entry left behind keeps a business
 * out of the queue, which is visible and fixable. So when in doubt this keeps
 * the entry.
 */
export interface Identifier {
  kind: "email" | "phone" | "domain";
  value: string;
}

/** Case-insensitive, because the list is written lowercased. */
export function keyOf(identifier: Identifier): string {
  return `${identifier.kind}:${identifier.value.toLowerCase()}`;
}

export function releasable(
  mine: readonly Identifier[],
  heldByOtherDeclined: readonly Identifier[],
): Identifier[] {
  const held = new Set(heldByOtherDeclined.map(keyOf));
  const seen = new Set<string>();

  return mine.filter((identifier) => {
    const key = keyOf(identifier);
    // A prospect can list the same number twice — phone and WhatsApp are often
    // one line — and deleting it twice is a second pointless statement.
    if (held.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
