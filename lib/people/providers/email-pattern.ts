import { guessEmail, inferPattern } from "../email-pattern";
import { emptyFindings, type Findings, type PeopleProvider } from "./types";

/**
 * Fills in addresses for people found without one, from the format of the
 * addresses the company itself published (see ../email-pattern.ts).
 *
 * It needs at least one published (name, address) pair on the domain to learn
 * from; with none it guesses nothing. It also needs the domain to receive mail.
 * Everything it adds is "guessed": research only, never copied or sent.
 */
export const emailPatternProvider: PeopleProvider = {
  name: "email_pattern",

  disabledReason: (company) => (company.domain ? null : "no domain to apply a pattern to"),

  async run(company, soFar, ctx): Promise<Findings> {
    const out = emptyFindings();
    const domain = company.domain!;
    const known = soFar.people
      .filter((p) => p.email && p.emailStatus === "verified")
      .map((p) => ({ name: p.name, email: p.email! }));
    const learned = inferPattern(known, domain);
    if (!learned) return out;
    if (!(await ctx.hasMx(domain))) return out;

    for (const person of soFar.people) {
      if (person.email) continue;
      const email = guessEmail(person.name, domain, learned.pattern);
      if (!email) continue;
      out.people.push({
        name: person.name,
        email,
        emailStatus: "guessed",
        facts: [
          {
            field: "email",
            value: email,
            // Not a page: the pattern, and how many published addresses taught it.
            sourceUrl: null,
            sourceType: "email_pattern",
          },
          {
            field: "emailPattern",
            value: `${learned.pattern} (from ${learned.matches} published address${learned.matches === 1 ? "" : "es"})`,
            sourceUrl: null,
            sourceType: "email_pattern",
          },
        ],
      });
    }
    return out;
  },
};
