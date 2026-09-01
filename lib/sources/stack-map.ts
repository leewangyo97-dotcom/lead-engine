/**
 * Canonical stack tokens: lowercase, singular, one spelling per technology.
 * `React Native`, `RN` and `react native` must all become `react-native`, or
 * the rubric's stack weights match nothing and every score is quietly wrong.
 */
const ALIASES: Record<string, string> = {
  "react native": "react-native",
  reactnative: "react-native",
  rn: "react-native",
  reactjs: "react",
  "react.js": "react",
  nextjs: "next",
  "next.js": "next",
  nodejs: "node",
  "node.js": "node",
  js: "javascript",
  ts: "typescript",
  postgresql: "postgres",
  psql: "postgres",
  golang: "go",
  "vue.js": "vue",
  vuejs: "vue",
  k8s: "kubernetes",
  gcp: "google-cloud",
  ai: "ml",
  "machine learning": "ml",
  llms: "llm",
  "react-native-cli": "react-native",
  "objective c": "objective-c",
};

/** Recognised on their own; anything else in a posting is noise. */
const KNOWN = new Set([
  "typescript",
  "javascript",
  "react",
  "react-native",
  "next",
  "node",
  "python",
  "django",
  "flask",
  "fastapi",
  "go",
  "rust",
  "ruby",
  "rails",
  "java",
  "kotlin",
  "swift",
  "objective-c",
  "flutter",
  "dart",
  "php",
  "laravel",
  "elixir",
  "scala",
  "c++",
  "c#",
  ".net",
  "vue",
  "svelte",
  "angular",
  "graphql",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "kafka",
  "aws",
  "google-cloud",
  "azure",
  "kubernetes",
  "docker",
  "terraform",
  "tailwind",
  "llm",
  "ml",
  "supabase",
  "firebase",
  "vercel",
]);

export function canonicaliseStack(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const raw of tokens) {
    const t = raw.toLowerCase().trim().replace(/[.,;:)（(]+$/g, "");
    if (!t) continue;
    const mapped = ALIASES[t] ?? t;
    if (KNOWN.has(mapped)) out.add(mapped);
  }
  // "React Native" contains "React", so both match. They are not the same skill
  // and the more specific one is what the posting actually said.
  if (out.has("react-native")) out.delete("react");
  if (out.has("next")) out.delete("javascript");

  return [...out].sort();
}

/** Scans free text for known stack tokens. Multi-word aliases first. */
export function extractStack(text: string): string[] {
  // A period is kept because ".net" and "node.js" need it, but a sentence-final
  // one has to go: without this, "React Native." never matched the two-word
  // alias and silently degraded to plain "react".
  const lower = ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .replace(/\.(?=\s|$)/g, " ")} `;
  const found: string[] = [];

  for (const alias of Object.keys(ALIASES)) {
    if (lower.includes(` ${alias} `)) found.push(alias);
  }
  for (const known of KNOWN) {
    if (lower.includes(` ${known} `)) found.push(known);
  }
  return canonicaliseStack(found);
}
