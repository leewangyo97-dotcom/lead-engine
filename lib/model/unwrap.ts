/**
 * The model's answer, out of Claude Code's `--output-format json` envelope.
 *
 * `claude -p --output-format json` prints one object, `{ type: "result",
 * is_error, result, … }`, where `result` is the text the model wrote. That text
 * should be the JSON the apply scripts read. Models also wrap it in a ```json
 * fence or put a sentence before it, so both are tolerated here, and nothing else
 * is: the apply script validates what comes out.
 */
export function unwrapClaudeResult(raw: string): string {
  let envelope: { is_error?: boolean; subtype?: string; result?: unknown };
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error("Claude Code printed something that is not JSON");
  }

  if (envelope.is_error || typeof envelope.result !== "string") {
    // An expired login arrives as subtype "success" with is_error set, so the
    // subtype is only named when it says something.
    const kind = envelope.subtype && envelope.subtype !== "success" ? ` (${envelope.subtype})` : "";
    const said = typeof envelope.result === "string" ? `: ${envelope.result.slice(0, 200)}` : " with no result";
    throw new Error(`Claude Code reported an error${kind}${said}`);
  }

  const text = envelope.result.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}
