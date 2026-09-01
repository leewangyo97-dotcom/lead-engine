export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-content flex-col justify-center gap-5 px-7">
      {/* Display sizes carry WONK 1 / SOFT 40 — the hand in the work. Never below 20px. */}
      <h1
        className="font-display text-display-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 32, 'SOFT' 40, 'WONK' 1" }}
      >
        Lead Engine
      </h1>
      <p className="max-w-prose text-body text-secondary">
        Phase 0 — skeleton. Foundations are wired; the inbox lands in Phase 4
        (<code className="font-mono text-data">docs/04-UI-SPEC.md</code>).
      </p>
      <p className="text-body-sm text-muted">
        Database health:{" "}
        <a className="text-accent underline underline-offset-2 hover:text-accent-hover" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
