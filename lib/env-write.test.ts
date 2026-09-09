import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setLocalEnv } from "./env-write";

const file = (contents?: string) => {
  const path = join(mkdtempSync(join(tmpdir(), "envw-")), ".env.local");
  if (contents !== undefined) writeFileSync(path, contents);
  return path;
};

describe("setLocalEnv", () => {
  it("replaces an existing value in place", () => {
    const path = file('A="1"\nGOOGLE_REFRESH_TOKEN="old"\nB="2"\n');
    expect(setLocalEnv("GOOGLE_REFRESH_TOKEN", "new", path)).toBe("updated");

    const out = readFileSync(path, "utf8");
    expect(out).toContain('GOOGLE_REFRESH_TOKEN="new"');
    expect(out).not.toContain("old");
    // Everything else survives, in order.
    expect(out.indexOf('A="1"')).toBeLessThan(out.indexOf("GOOGLE_REFRESH_TOKEN"));
    expect(out).toContain('B="2"');
  });

  it("appends when the key is absent", () => {
    const path = file('DATABASE_URL="postgres://x"\n');
    expect(setLocalEnv("GOOGLE_REFRESH_TOKEN", "new", path)).toBe("added");
    expect(readFileSync(path, "utf8")).toBe(
      'DATABASE_URL="postgres://x"\nGOOGLE_REFRESH_TOKEN="new"\n',
    );
  });

  it("does not mangle a file with no trailing newline", () => {
    const path = file('A="1"');
    setLocalEnv("B", "2", path);
    expect(readFileSync(path, "utf8")).toBe('A="1"\nB="2"\n');
  });

  it("leaves a commented-out entry alone and adds a real one", () => {
    // A commented line is documentation. Overwriting it would lose the note and
    // still leave the variable unset.
    const path = file('# GOOGLE_REFRESH_TOKEN="paste here"\n');
    expect(setLocalEnv("GOOGLE_REFRESH_TOKEN", "new", path)).toBe("added");

    const out = readFileSync(path, "utf8");
    expect(out).toContain('# GOOGLE_REFRESH_TOKEN="paste here"');
    expect(out).toContain('GOOGLE_REFRESH_TOKEN="new"');
  });

  it("does not confuse a key that contains the name", () => {
    const path = file('OLD_GOOGLE_REFRESH_TOKEN="other"\n');
    setLocalEnv("GOOGLE_REFRESH_TOKEN", "new", path);

    const out = readFileSync(path, "utf8");
    expect(out).toContain('OLD_GOOGLE_REFRESH_TOKEN="other"');
    expect(out).toContain('\nGOOGLE_REFRESH_TOKEN="new"');
  });

  it("creates the file when there is none", () => {
    const path = join(mkdtempSync(join(tmpdir(), "envw-")), ".env.local");
    expect(setLocalEnv("K", "v", path)).toBe("added");
    expect(readFileSync(path, "utf8")).toBe('K="v"\n');
  });
});
