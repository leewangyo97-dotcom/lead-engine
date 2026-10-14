import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPT_OUT } from "./email-message";
import { contentScore, parseSpamReport, spamSamples, TEST_ARTIFACTS, toEml } from "./spam-check";

/**
 * The parts of `pnpm spam:check` that need no Docker. The two fixtures are real
 * `spamassassin -t -L` output (4.0.1, 13 Oct): the app's no-website email, and a
 * deliberately spammy one written to prove the check can fail.
 */
const fixture = (name: string) => readFileSync(`lib/places/__fixtures__/${name}`, "utf8");

describe("parseSpamReport", () => {
  it("reads the score and each rule from real output", () => {
    const verdict = parseSpamReport(fixture("spamassassin-spam.txt"))!;
    expect(verdict.score).toBe(6.1);
    expect(verdict.required).toBe(5);
    expect(verdict.rules).toContainEqual({
      points: 2.7,
      name: "DEAR_FRIEND",
      description: "BODY: Dear Friend? That's not very dear!",
    });
  });

  it("reads the table once, though a message over the line prints it twice", () => {
    const names = parseSpamReport(fixture("spamassassin-spam.txt"))!.rules.map((r) => r.name);
    expect(names.length).toBe(new Set(names).size);
  });

  it("returns null for output that is not a report", () => {
    expect(parseSpamReport("docker: Cannot connect to the Docker daemon")).toBeNull();
  });
});

describe("contentScore", () => {
  it("leaves out only the test artifacts, so a spammy message still fails", () => {
    expect(contentScore(parseSpamReport(fixture("spamassassin-spam.txt"))!)).toBe(5.1);
  });

  it("scores the app's own email at zero, with the missing Gmail headers set aside", () => {
    const verdict = parseSpamReport(fixture("spamassassin-clean.txt"))!;
    expect(verdict.rules.map((r) => r.name)).toContain("FORGED_GMAIL_RCVD");
    expect(Object.keys(TEST_ARTIFACTS)).toEqual(["FORGED_GMAIL_RCVD"]);
    expect(contentScore(verdict)).toBe(0);
  });
});

describe("toEml", () => {
  it("writes a plain-text message from a gmail.com address, headers then body", () => {
    const eml = toEml({ subject: "A quick idea", body: "Hi there." });
    const [head, body] = eml.split("\r\n\r\n");
    expect(head).toMatch(/^From: Joshua Senining <sender@gmail\.com>\r\n/);
    expect(head).toContain("Subject: A quick idea");
    expect(head).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(body.trim()).toBe("Hi there.");
  });

  it("encodes a subject that is not plain ASCII", () => {
    const eml = toEml({ subject: "A quick idea for Café Sol", body: "Hi." });
    expect(eml).toContain(`Subject: =?UTF-8?B?${Buffer.from("A quick idea for Café Sol").toString("base64")}?=`);
  });
});

describe("spamSamples", () => {
  it("covers every kind of email the app writes, each with the way out and one link", () => {
    const samples = spamSamples();
    expect(samples.map((s) => s.label)).toEqual([
      "no website",
      "demo",
      "heavy page",
      "hard to read",
      "page jumps",
      "not measured",
      "enhanced draft",
      "follow-up 1",
      "follow-up 2",
    ]);
    for (const { email } of samples) {
      expect(email.body).toContain(OPT_OUT);
      expect(email.body.split("joshuasenining.dev").length - 1).toBe(1);
    }
  });
});
