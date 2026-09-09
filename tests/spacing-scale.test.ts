import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spacing utilities that name a key the scale does not have produce no CSS.
 *
 * `tailwind.config.ts` REPLACES Tailwind's spacing scale with thirteen keys.
 * Anything outside them — a default that used to work like `py-16`, or a
 * fractional one like `py-0.5` and `h-1.5` — silently emits nothing. Nothing
 * warns: the class stays in the markup, the element loses the padding, and it
 * reads as a design choice rather than a bug.
 *
 * That is not hypothetical. Ten of these were found and fixed by hand in one
 * audit, and three more (`py-0.5` on every count badge and kbd key, `h-1.5` on
 * the lead page's overlap dot, `py-16` on the empty inbox) were still live
 * afterwards. Reading the rendered CSS is the only way to catch them, so this
 * reads the config instead and refuses the class name.
 *
 * Arbitrary values (`h-[6px]`, `w-[220px]`) are the escape hatch and are not
 * checked — they always emit.
 */
const CONFIG = "tailwind.config.ts";
const ROOTS = ["app"];

/** Utilities whose numeric argument comes from `theme.spacing`. */
const PREFIXES = [
  "p", "px", "py", "pt", "pr", "pb", "pl",
  "m", "mx", "my", "mt", "mr", "mb", "ml",
  "w", "h", "size", "min-w", "min-h",
  "gap", "gap-x", "gap-y", "space-x", "space-y",
  "inset", "inset-x", "inset-y", "top", "right", "bottom", "left",
];

/** The keys defined in the config's `spacing` block. */
function spacingKeys(): Set<string> {
  const text = readFileSync(CONFIG, "utf8");
  const block = text.match(/spacing:\s*\{([\s\S]*?)\n\s*\},/);
  if (!block) throw new Error("no spacing block in tailwind.config.ts");
  return new Set([...block[1].matchAll(/^\s*"?([\w.]+)"?:\s*"/gm)].map((m) => m[1]));
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/**
 * Comments out, before anything is matched.
 *
 * The scan reads raw source, and prose collides with the pattern: a comment
 * saying "the top-25 queue only lists new" was reported as a dead `top-25`
 * class. A CSS check that fails on an English sentence teaches people to
 * reword comments, which is the wrong lesson.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(new RegExp("//[^\\n]*", "g"), " ");
}

/** Every `<prefix>-<number>` class in a file, with any responsive prefix dropped. */
function spacingClasses(source: string): string[] {
  const pattern = new RegExp(
    String.raw`(?<![\w-])(?:-)?(?:(?:sm|md|lg|xl|hover|focus|group-hover):)*(` +
      PREFIXES.join("|") +
      String.raw`)-(\d+(?:\.\d+)?)(?![\w.[-])`,
    "g",
  );
  return [...stripComments(source).matchAll(pattern)].map((m) => `${m[1]}-${m[2]}`);
}

describe("the spacing scale", () => {
  const keys = spacingKeys();

  it("is the replaced thirteen-key scale, not Tailwind's default", () => {
    expect(keys.size).toBe(13);
    expect(keys.has("0")).toBe(true);
    expect(keys.has("12")).toBe(true);
    // The default scale's fractional keys are gone; catching their absence here
    // is what makes the check below meaningful.
    expect(keys.has("0.5")).toBe(false);
    expect(keys.has("16")).toBe(false);
  });

  it("has a key for every spacing class the app uses", () => {
    const dead: string[] = [];

    for (const file of ROOTS.flatMap(tsxFiles)) {
      const source = readFileSync(file, "utf8");
      for (const cls of spacingClasses(source)) {
        const key = cls.slice(cls.lastIndexOf("-") + 1);
        if (!keys.has(key)) dead.push(`${file}: ${cls}`);
      }
    }

    // Named rather than counted: the failure has to say which class in which
    // file, or the next person has to rediscover this by measuring elements in
    // a browser, which is how it was found the first time.
    expect(dead).toEqual([]);
  });
});
