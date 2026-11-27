// Small, safe Markdown for agenda and library text: headings, lists and paragraphs.
// Renders text nodes only (no HTML), so imported content cannot inject markup.
type Block =
  | { kind: "h"; text: string }
  | { kind: "ol" | "ul"; items: string[] }
  | { kind: "p"; text: string };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      blocks.push({ kind: "p", text: "" });
      continue;
    }
    const h = line.match(/^#{1,6}\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (h) blocks.push({ kind: "h", text: h[1] });
    else if (ol || ul) {
      const kind = ol ? "ol" : "ul";
      const text = (ol ?? ul)![1];
      if (last && last.kind === kind) last.items.push(text);
      else blocks.push({ kind, items: [text] });
    } else if (last && last.kind === "p" && last.text) last.text += " " + line;
    else blocks.push({ kind: "p", text: line });
  }
  return blocks.filter((b) => b.kind !== "p" || b.text);
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose">
      {parse(text).map((b, i) =>
        b.kind === "h" ? (
          <h3 key={i}>{b.text}</h3>
        ) : b.kind === "p" ? (
          <p key={i}>{b.text}</p>
        ) : b.kind === "ol" ? (
          <ol key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ol>
        ) : (
          <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
        )
      )}
    </div>
  );
}
