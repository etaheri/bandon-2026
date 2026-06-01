export const COLORS = {
  gorse: "#F4A300",
  driftwood: "#2E8BFF",
  deepGreen: "#0b3d2e",
  panel: "#0f1a17",
  gold: "#d9b24a",
};

// Global "broadcast" design system — 2000s EA-Sports game intro meets WeatherSTAR
// retro broadcast. Every screen inherits: the radial dunes-green backdrop, the
// CRT scanline overlay, chunky gold 3D buttons, embossed panels, chrome titles,
// a consistent top bar, section dividers, and the shared tee-card/seat blocks.
// Home layers its hero/versus/ticker on top of these (see homeCss.ts).
export const themeCss = `
:root{
  --gorse:${COLORS.gorse}; --driftwood:${COLORS.driftwood};
  --deep-green:${COLORS.deepGreen}; --panel:${COLORS.panel}; --gold:${COLORS.gold};
  --line:#2c5749;
  --chrome:linear-gradient(180deg,#ffffff 0%,#ffe9a8 36%,#e8b54a 50%,#b9842a 58%,#ffe28f 76%,#ffffff 100%);
  --bevel: inset 0 1px 0 rgba(255,255,255,.22), inset 0 -2px 4px rgba(0,0,0,.5);
  --emboss: 1px 1px 0 #000, -1px -1px 0 rgba(255,255,255,.15);
  --good:#7CFFB2; --bad:#ff9a9a;
}
*{box-sizing:border-box}
html,body,#root{margin:0;min-height:100%}
body{background:#06241a;color:#eafff4;-webkit-tap-highlight-color:transparent;
  font-family:"Arial Black",Impact,system-ui,sans-serif;}
#root{min-height:100dvh;
  background:radial-gradient(130% 90% at 50% -15%, #15493c 0%, #0b3d2e 42%, #06251b 100%);}

/* ---- type helpers ---- */
.head{font-style:italic;text-transform:uppercase;letter-spacing:.5px;text-shadow:var(--emboss)}
.chrome{font-family:Impact,"Arial Black",sans-serif;font-style:italic;font-weight:900;
  text-transform:uppercase;letter-spacing:-.5px;
  background:var(--chrome);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 2px 0 rgba(0,0,0,.8)) drop-shadow(0 3px 6px rgba(0,0,0,.5));}

/* ---- surfaces ---- */
.panel{background:linear-gradient(180deg,#143a2e,#0a1d16);border:1px solid var(--line);
  border-radius:14px;box-shadow:0 6px 18px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.08)}

/* ---- buttons: chunky gold EA 3D ---- */
.btn{font:inherit;cursor:pointer;border:none;border-radius:11px;padding:13px 16px;color:#1a1205;
  font-family:Impact,"Arial Black",sans-serif;font-style:italic;font-weight:900;letter-spacing:.5px;
  text-transform:uppercase;
  background:linear-gradient(180deg,#ffe9a8,#ffce4d 50%,#d9a93a);
  box-shadow:0 4px 0 #8a6418, 0 6px 12px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.7);
  transition:transform .08s, box-shadow .08s}
.btn:active{transform:translateY(3px);
  box-shadow:0 1px 0 #8a6418, 0 3px 8px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.7)}
.btn:disabled{cursor:default;opacity:.4;box-shadow:0 4px 0 #5e4715, inset 0 1px 0 rgba(255,255,255,.4)}
.btn.ghost{color:#eafff4;background:linear-gradient(180deg,#16342a,#0c2018);
  border:1px solid #3a6b58;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.btn.ghost:active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.btn.dark{color:#eafff4;background:linear-gradient(180deg,#2a3340,#161b22);
  box-shadow:0 3px 0 #0a0d12, inset 0 1px 0 rgba(255,255,255,.12)}
.btn.dark:active{transform:translateY(2px);box-shadow:0 1px 0 #0a0d12, inset 0 1px 0 rgba(255,255,255,.12)}

/* ---- inputs ---- */
input,select,textarea{font:inherit;font-weight:700;color:#eafff4;background:#0b1f18;
  border:1px solid var(--line);border-radius:10px;padding:11px 12px}
input::placeholder{color:#6f9586}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--gold);
  box-shadow:0 0 0 2px rgba(217,178,74,.25)}

/* ---- page wrapper + top bar ---- */
.bc-page{position:relative;min-height:100dvh;padding:16px 14px 28px;max-width:760px;margin:0 auto}
.bc-topbar{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.bc-topbar .sp{flex:1}
.bc-back{flex:0 0 auto;width:42px;height:42px;border-radius:11px;cursor:pointer;border:1px solid #3a6b58;
  background:linear-gradient(180deg,#16342a,#0c2018);color:var(--gold);
  line-height:0;display:grid;place-items:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);transition:transform .08s,border-color .15s}
.bc-back:hover{border-color:var(--gold)} .bc-back:active{transform:translateY(2px)}
.bc-screen-title{margin:0;font-family:Impact,"Arial Black",sans-serif;font-style:italic;font-weight:900;
  font-size:clamp(24px,7vw,36px);line-height:1.08;text-transform:uppercase;letter-spacing:-.5px;
  /* italic overhang + clip-text need right padding or the last letter is shaved */
  padding-right:.14em;
  background:var(--chrome);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 2px 0 rgba(0,0,0,.7))}

/* ---- section divider header ---- */
.bc-h{display:flex;align-items:center;gap:10px;margin:20px 2px 10px;
  font-family:"Arial Narrow",Impact,sans-serif;font-weight:900;font-style:italic;font-size:15px;
  letter-spacing:2px;text-transform:uppercase;color:#9fd9bf}
.bc-h::after{content:"";flex:1;height:2px;border-radius:2px;
  background:linear-gradient(90deg,rgba(217,178,74,.6),rgba(217,178,74,0))}

/* ---- staggered entrance ---- */
.bc-fade{opacity:0;transform:translateY(12px);animation:bc-in .5s cubic-bezier(.2,.9,.3,1) both}
@keyframes bc-in{to{opacity:1;transform:none}}

/* ---- CRT scanline + flicker + vignette overlay (rendered once, app-wide) ---- */
.bc-crt{position:fixed;inset:0;pointer-events:none;z-index:60;
  box-shadow:inset 0 0 140px 30px rgba(0,0,0,.5)}
.bc-crt::before{content:"";position:absolute;inset:0;mix-blend-mode:soft-light;opacity:.5;
  background:repeating-linear-gradient(to bottom,
    rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.5) 3px, rgba(0,0,0,0) 4px);
  animation:bc-scan 9s linear infinite, bc-flicker 5s steps(40) infinite}
.bc-crt::after{content:"";position:absolute;left:0;right:0;height:32%;top:0;
  background:linear-gradient(to bottom, transparent, rgba(150,255,210,.04), transparent);
  animation:bc-band 7s linear infinite}
@keyframes bc-scan{from{background-position:0 0}to{background-position:0 8px}}
@keyframes bc-flicker{0%,100%{opacity:.46}48%{opacity:.5}50%{opacity:.38}52%{opacity:.5}}
@keyframes bc-band{0%{transform:translateY(-120%)}100%{transform:translateY(420%)}}

/* ---- tags ---- */
.bc-tag{font-family:"Arial Narrow",Impact,sans-serif;font-weight:900;font-style:italic;font-size:11px;
  letter-spacing:1px;text-transform:uppercase;border-radius:5px;padding:2px 7px;white-space:nowrap}
.bc-tag.counts{background:var(--gold);color:#1a1205}
.bc-tag.warm{background:#244a3d;color:#bfe6d4;border:1px solid #366}
.bc-tag.send{background:#2d3b66;color:#cfe0ff}
.bc-tag.x2{background:#7a1f1f;color:#ffd9d9}
.bc-tag.now{background:#ff3b3b;color:#fff}

/* ---- shared tee card ---- */
.bc-card{border-radius:16px;border:1px solid var(--line);overflow:hidden;
  background:linear-gradient(180deg,#123528,#0a1d16);
  box-shadow:0 6px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08);
  display:flex;flex-direction:column}
.bc-card.live{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold),0 8px 22px rgba(0,0,0,.4)}
.bc-card-top{padding:11px 12px 8px;border-bottom:1px solid #1d4133}
.bc-tags{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap}
.bc-card-course{font-family:Impact,"Arial Black",sans-serif;font-style:italic;font-weight:900;
  font-size:21px;line-height:1;text-transform:uppercase;text-shadow:var(--emboss)}
.bc-card-day{font-family:"Arial Narrow",Impact,sans-serif;font-weight:900;font-style:italic;font-size:12px;
  letter-spacing:1.2px;color:var(--gold);margin-top:3px}
.bc-card-body{padding:9px 10px 11px;display:grid;gap:7px}

/* ---- tee group row + seats ---- */
.bc-tee{border-radius:11px;background:rgba(0,0,0,.26);border:1px solid #244a3d;padding:8px 10px}
.bc-tee.mine{border-color:var(--gold);background:rgba(217,178,74,.1)}
.bc-tee-time{display:flex;align-items:center;gap:7px;margin-bottom:5px;
  font-family:"Arial Narrow",Impact,sans-serif;font-weight:900;font-style:italic;font-size:14px;
  letter-spacing:.6px;color:#bfe6d4;text-transform:uppercase}
.bc-tee.mine .bc-tee-time{color:var(--gold)}
.bc-tee-time .crs{margin-left:auto;font-size:11px;opacity:.55;letter-spacing:.5px;color:#cfeede}
.bc-seats{display:flex;flex-wrap:wrap;gap:4px 12px}
.bc-seat{display:flex;align-items:center;gap:6px;font-family:"Arial Narrow",Impact,sans-serif;font-weight:700;
  font-size:14px;color:#eafff4}
.bc-seat .pip{width:8px;height:8px;border-radius:2px;flex:0 0 auto;box-shadow:0 0 6px rgba(0,0,0,.4)}
.bc-seat.me{font-weight:900}
.bc-seat.me .nm{color:var(--gold)}

/* ---- score-change pop/flash (leaderboard broadcast feel) ---- */
@keyframes bc-pop{0%{transform:scale(1)}30%{transform:scale(1.18)}100%{transform:scale(1)}}
.bc-flash{animation:bc-pop .6s ease-out;text-shadow:0 0 10px currentColor}
@keyframes bc-pulse{0%,100%{filter:none}40%{filter:brightness(1.5) saturate(1.4)}}
.bc-pulse{animation:bc-pulse .9s ease-out}

@media (prefers-reduced-motion: reduce){
  .bc-crt::before{animation:none;opacity:.4}
  .bc-crt::after{display:none}
  .bc-fade{animation:none;opacity:1;transform:none}
  .bc-flash{animation:none;text-shadow:none}
  .bc-pulse{animation:none;filter:none}
}
`;
