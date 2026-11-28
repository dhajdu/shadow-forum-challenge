// Small, safe Markdown for agenda and library text: headings, nested lists (checkboxes become
// plain bullets), paragraphs, tables (two-column tables read as term and detail), <br/> line
// breaks, **bold** and http(s) links. Renders text nodes only, so imported content cannot inject markup.
import { Fragment } from "react";

type Item = { text: string; children: Item[] };
type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "list"; ordered: boolean; items: Item[] }
  | { kind: "table"; rows: string[][] };

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
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      list = null;
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue; // header separator row
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "table") last.rows.push(cells);
      else blocks.push({ kind: "table", rows: [cells] });
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

/** **bold** as <b>, [text](https://…) as a link, everything else as text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
        const a = p.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
        if (a) return <a key={i} href={a[2]} target="_blank" rel="noreferrer">{a[1]}</a>;
        return <Fragment key={i}>{p.replace(/\*\*/g, "")}</Fragment>;
      })}
    </>
  );
}

/** A cell's text split on <br/>: one line each, blank runs become a gap. */
function Lines({ text }: { text: string }) {
  const lines = text.split(/<br\s*\/?>/i).map((l) => l.trim());
  return (
    <>
      {lines.map((l, i) =>
        l ? <span key={i} className="md-line"><Inline text={l} /></span> : i > 0 && lines[i - 1] ? <span key={i} className="md-gap" /> : null
      )}
    </>
  );
}

function Table({ rows }: { rows: string[][] }) {
  // two columns: a term and its detail (the Constitution); wider: a real table
  if (rows.every((r) => r.length === 2)) {
    return (
      <dl className="md-terms">
        {rows.map(([k, v], i) => (
          <div key={i}>
            <dt><Lines text={k} /></dt>
            <dd><Lines text={v} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  const [head, ...body] = rows;
  return (
    <div className="md-table">
      <table>
        <thead><tr>{head.map((c, i) => <th key={i}><Lines text={c} /></th>)}</tr></thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}><Lines text={c} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
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

export function Markdown({ text, title }: { text: string; title?: string }) {
  const blocks = parse(text.replace(/<br\s*\/?>/gi, (m, o: number, s: string) => (s.lastIndexOf("|", o) > s.lastIndexOf("\n", o) ? m : "\n")));
  // an imported doc often repeats its own title as the first heading
  if (title && blocks[0]?.kind === "h" && blocks[0].text.trim().toLowerCase() === title.trim().toLowerCase()) blocks.shift();
  return (
    <div className="prose">
      {blocks.map((b, i) =>
        b.kind === "h" ? (
          <h3 key={i}><Inline text={b.text} /></h3>
        ) : b.kind === "hr" ? (
          <hr key={i} />
        ) : b.kind === "quote" ? (
          <blockquote key={i}><Inline text={b.text} /></blockquote>
        ) : b.kind === "table" ? (
          <Table key={i} rows={b.rows} />
        ) : b.kind === "p" ? (
          <p key={i}><Inline text={b.text} /></p>
        ) : (
          <List key={i} ordered={b.ordered} items={b.items} />
        )
      )}
    </div>
  );
}
