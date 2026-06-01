export function Stepper({ value, par, onChange }: { value: number | null; par: number; onChange: (v: number) => void }) {
  const v = value ?? par;
  const tap = (d: number) => onChange(Math.max(1, Math.min(20, v + d)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
      <button className="btn" style={{ fontSize: 40, width: 88, height: 88 }} onClick={() => tap(-1)} aria-label="minus">−</button>
      <div className="head" style={{ fontSize: 72, minWidth: 110, textAlign: "center" }}>{value ?? "–"}</div>
      <button className="btn" style={{ fontSize: 40, width: 88, height: 88 }} onClick={() => tap(1)} aria-label="plus">＋</button>
    </div>
  );
}
