import { useMemo, useState } from "react";

function colLabel(index: number) {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function Spreadsheet({
  props,
}: {
  props: {
    columns: string[];
    rows: string[][];
    caption: string | null;
  };
}) {
  const [headers, setHeaders] = useState(() =>
    props.columns.length ? [...props.columns] : ["A", "B", "C"],
  );
  const [grid, setGrid] = useState(() => {
    const width = Math.max(props.columns.length, 1);
    const rows =
      props.rows.length > 0
        ? props.rows.map((row) => {
            const next = [...row];
            while (next.length < width) next.push("");
            return next.slice(0, width);
          })
        : [Array.from({ length: width }, () => "")];
    return rows;
  });
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);

  const csv = useMemo(() => {
    const escape = (value: string) => {
      if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
      return value;
    };
    return [headers, ...grid]
      .map((row) => row.map(escape).join(","))
      .join("\n");
  }, [headers, grid]);

  function updateCell(r: number, c: number, value: string) {
    setGrid((rows) =>
      rows.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row,
      ),
    );
  }

  function updateHeader(c: number, value: string) {
    setHeaders((cols) => cols.map((col, i) => (i === c ? value : col)));
  }

  function addRow() {
    setGrid((rows) => [
      ...rows,
      Array.from({ length: headers.length }, () => ""),
    ]);
  }

  function addColumn() {
    setHeaders((cols) => [...cols, colLabel(cols.length)]);
    setGrid((rows) => rows.map((row) => [...row, ""]));
  }

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${props.caption ?? "sheet"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {props.caption ? (
        <div className="text-sm text-muted-foreground">{props.caption}</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border px-2 py-0.5 text-xs"
          onClick={addRow}
        >
          Add row
        </button>
        <button
          type="button"
          className="rounded-full border px-2 py-0.5 text-xs"
          onClick={addColumn}
        >
          Add column
        </button>
        <button
          type="button"
          className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"
          onClick={downloadCsv}
        >
          Download CSV
        </button>
      </div>
      <div className="max-h-[360px] overflow-auto rounded-lg border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              <th className="w-10 border-b border-r px-2 py-1 text-left text-xs text-muted-foreground">
                #
              </th>
              {headers.map((header, c) => (
                <th key={c} className="border-b border-r p-0">
                  <input
                    className="w-full min-w-24 bg-transparent px-2 py-1 font-medium outline-none focus:bg-background"
                    value={header}
                    onChange={(event) => updateHeader(c, event.target.value)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r} className="odd:bg-background even:bg-muted/20">
                <td className="border-r px-2 py-1 text-xs text-muted-foreground">
                  {r + 1}
                </td>
                {row.map((cell, c) => {
                  const isActive = active?.r === r && active?.c === c;
                  return (
                    <td key={c} className="border-r border-t p-0">
                      <input
                        className={`w-full min-w-24 bg-transparent px-2 py-1 outline-none ${
                          isActive ? "bg-primary/10" : "focus:bg-background"
                        }`}
                        value={cell}
                        onFocus={() => setActive({ r, c })}
                        onChange={(event) =>
                          updateCell(r, c, event.target.value)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
