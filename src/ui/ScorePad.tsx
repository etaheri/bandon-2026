import { useState } from "react";

/** Par-relative tap pad. Tapping a number commits it (parent auto-advances). "+" reveals higher numbers. */
export function ScorePad({ par, value, onSelect }: { par: number; value: number | null; onSelect: (gross: number) => void }) {
  const [extra, setExtra] = useState(0);
  const lo = Math.max(1, par - 2);
  const hi = Math.min(20, par + 4 + extra);
  const nums: number[] = [];
  for (let n = lo; n <= hi; n++) nums.push(n);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {nums.map(n => {
          const isPar = n === par;
          const selected = value === n;
          return (
            <button key={n} onClick={() => onSelect(n)} aria-label={`score ${n}`}
              style={{
                fontFamily: "inherit", fontWeight: 900, fontSize: 28, padding: "18px 0", borderRadius: 12, border: "none",
                color: selected ? "#1a1205" : "#fff",
                background: selected ? "var(--gold)" : isPar ? "#1f3b34" : "#13231f",
                boxShadow: "var(--bevel)", outline: isPar && !selected ? "2px solid var(--gold)" : "none",
              }}>
              {n}{isPar ? <div style={{ fontSize: 10, opacity: .7 }}>PAR</div> : null}
            </button>
          );
        })}
        {hi < 20 && (
          <button onClick={() => setExtra(e => e + 4)} aria-label="higher scores"
            style={{ fontFamily: "inherit", fontWeight: 900, fontSize: 28, padding: "18px 0", borderRadius: 12, border: "none",
              color: "#fff", background: "#0f1a17", boxShadow: "var(--bevel)" }}>+</button>
        )}
      </div>
    </div>
  );
}
