import { BackButton } from "../ui/BackButton";

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section className="panel" style={{ padding: 16, marginBottom: 14 }}>
      <h2 className="head" style={{ margin: "0 0 8px", color: "var(--gold)", fontSize: 18 }}>{title}</h2>
      <div style={{ display: "grid", gap: 8, fontFamily: '"Arial Narrow", Impact, sans-serif', fontWeight: 700, lineHeight: 1.45 }}>
        {children}
      </div>
    </section>
  );
}

export function Rules() {
  return (
    <div className="bc-page">
      <div className="bc-topbar">
        <BackButton />
        <h1 className="bc-screen-title">How It Works</h1>
        <span className="sp" />
      </div>

      <Section title="The Format">
        <p style={{ margin: 0 }}>
          Eight players, two teams — <b style={{ color: "var(--gorse)" }}>Gorse</b> vs{" "}
          <b style={{ color: "var(--driftwood)" }}>Driftwood</b> — over six counting rounds (Thu–Sat) at Bandon Dunes.
          It's a Ryder-Cup-style team match: every round is worth cup points, and the team that wins the cup wins the trip.
        </p>
      </Section>

      <Section title="How Scoring Works — Net Stableford">
        <p style={{ margin: 0 }}>You earn <b>points per hole</b> based on your <b>net</b> score (gross minus handicap strokes):</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Eagle (net) = 4 · Birdie = 3 · Par = 2 · Bogey = 1 · Double or worse = 0</li>
        </ul>
        <p style={{ margin: 0 }}>
          Handicap strokes use a <b>75% allowance</b>: your playing handicap = round(course handicap × 0.75).
          You receive strokes on the hardest holes first (by stroke index). Above 18, you get a second stroke on the hardest holes.
        </p>
        <p style={{ margin: 0 }}>
          Your round result is your points versus a <b>flat quota of 36</b>. The board prorates the quota by how many holes
          you've played, so mid-round numbers are fair: <b>result = points so far − 36 × (holes played ÷ 18)</b>.
          Plus is good. A pick-up counts as a played hole worth 0 points.
        </p>
      </Section>

      <Section title="Worked Example">
        <p style={{ margin: 0 }}>
          Matt plays off 16 (playing handicap 16). On a par-4 with stroke index 3, he receives <b>1 stroke</b> (16 ≥ 3).
          He shoots a gross <b>5</b> → net <b>4</b> → that's a net par → <b>2 points</b>.
        </p>
        <p style={{ margin: 0 }}>
          Do that for all 18 holes and add them up. If he finishes with <b>34 points</b>, his round result is
          <b> 34 − 36 = −2</b>. Through 9 holes with 18 points, the prorated quota is 18, so he'd be <b>even (0)</b>.
        </p>
      </Section>

      <Section title="How the Cup Is Won">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Each round, the team with the better <b>combined result</b> wins <b>1 cup point</b>. Ties split <b>0.5 / 0.5</b>.</li>
          <li>The <b>Saturday afternoon finale (Round 6) is worth double — 2 points</b>.</li>
          <li><b>7 points</b> are available in total. <b>First to 4 wins the cup; 3.5 retains it.</b></li>
          <li>The board tracks clinch state — <b>CLINCHED / RETAINS / ALIVE / MUST WIN FINALE / ELIMINATED</b> — like a real broadcast.</li>
        </ul>
      </Section>

      <Section title="The Crowns">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>🏆 <b>Player of the Trip</b> — best cumulative round result across all counting rounds.</li>
          <li><b>Daily Low Round</b> — best single round result each day.</li>
        </ul>
      </Section>

      <Section title="The Bandon Book (Prop Predictions)">
        <p style={{ margin: 0 }}>Side action for bragging rights — no money, no odds. Just call it.</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Anyone can post a <b>prop</b>: a subject (e.g. "Bruce's first tee shot") and two or more outcomes.</li>
          <li>Everyone gets <b>one pick per prop</b>. Once you tap an outcome it's locked — no changing your mind.</li>
          <li>The commish <b>locks</b> the prop before the event, then <b>resolves</b> it by picking the winner.</li>
          <li>You score <b>+1 for every correct call</b>. The standings rank everyone by correct picks.</li>
          <li>Titles: 🔮 The Oracle (most correct) · 🎯 Sharpshooter (best hit rate) · 🚽 Tank Job (most wrong).</li>
        </ul>
        <p style={{ margin: 0, opacity: .7 }}>Find it on the home screen — tap <b>The Book 🎲</b>.</p>
      </Section>

      <div className="bc-foot" style={{ textAlign: "center", opacity: .6, marginTop: 8 }}>
        Bandon Sports — It's In The Game
      </div>
    </div>
  );
}
