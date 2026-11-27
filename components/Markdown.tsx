// Small, safe Markdown for agenda and library text: headings, nested lists (checkboxes become
// plain bullets), paragraphs and **bold**. Renders text nodes only, so imported content cannot
// inject markup.
import { Fragment } from "react";

type Item = { text: string; children: Item[] };
type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "list"; ordered: boolean; items: Item[] };

const LIST = /^(\s*)(?:([-*+]|--)|(\d+)[.)])\s+(?:\[[ xX]\]\s*)?(.*)$/;

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  let list: { ordered: boolean; items: Item[] } | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\t/g, "  ");
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      list = null;
      blocks.push({ kind: "hr" });
      continue;
    }
    const q = line.trim().match(/^>\s?(.*)$/);
    if (q) {
      flush();
      list = null;
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "quote") last.text += " " + q[1];
      else blocks.push({ kind: "quote", text: q[1] });
      continue;
    }
    const h = line.trim().match(/^#{1,6}\s+(.*)$/);
    const li = line.match(LIST);
    if (h) {
      flush();
      list = null;
      blocks.push({ kind: "h", text: h[1] });
    } else if (li && li[4].trim()) {
      flush();
      const depth = li[2] === "--" ? 1 : Math.floor(li[1].length / 2);
      const item: Item = { text: li[4].trim(), children: [] };
      if (!list || (depth === 0 && list.ordered !== Boolean(li[3]))) {
        list = { ordered: Boolean(li[3]), items: [] };
        blocks.push({ kind: "list", ...list });
      }
      const parent = depth > 0 ? list.items[list.items.length - 1] : null;
      (parent ? parent.children : list.items).push(item);
    } else if (!li) {
      list = null;
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/** **bold** as <b>, everything else as text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p.replace(/\*\*/g, "")}</Fragment>
      )}
    </>
  );
}

function List({ ordered, items }: { ordered: boolean; items: Item[] }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag>
      {items.map((it, i) => (
        <li key={i}>
          <Inline text={it.text} />
          {it.children.length > 0 && <List ordered={false} items={it.children} />}
        </li>
      ))}
    </Tag>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose">
      {parse(text).map((b, i) =>
        b.kind === "h" ? (
          <h3 key={i}><Inline text={b.text} /></h3>
        ) : b.kind === "hr" ? (
          <hr key={i} />
        ) : b.kind === "quote" ? (
          <blockquote key={i}><Inline text={b.text} /></blockquote>
        ) : b.kind === "p" ? (
          <p key={i}><Inline text={b.text} /></p>
        ) : (
          <List key={i} ordered={b.ordered} items={b.items} />
        )
      )}
    </div>
  );
}
