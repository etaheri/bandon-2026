// Landing-page ("broadcast") styles. Injected once by Home on mount.
// 2000s EA-Sports game-intro meets WeatherSTAR retro broadcast: chrome title,
// CRT scanlines + faint flicker, team-vs-team versus card, a horizontal tee-time
// rail, and a fixed bottom ticker crawling every tee time of the week.
//
// Motion is deliberately restrained: a single staggered load, one chrome sheen
// pass, a slow scanline drift, and the ticker crawl. Everything animated is
// disabled under prefers-reduced-motion with a good static fallback.
//
// Shared primitives (CRT overlay, .bc-fade, .bc-h, .bc-card*, .bc-tag*, .bc-tee*,
// .bc-seat*) live in theme.ts so every screen inherits them; this file holds only
// the Home-specific hero / versus / featured / CTA / ticker pieces.

export const homeCss = `
.bc-stage{
  position:relative;min-height:100dvh;color:#eafff4;
  padding:16px 14px 96px;overflow-x:hidden;
  background:
    radial-gradient(130% 90% at 50% -15%, #15493c 0%, #0b3d2e 42%, #06251b 100%);
}

/* ---- hero ---- */
.bc-hero{position:relative;border-radius:18px;overflow:hidden;border:1px solid #2c5749;
  box-shadow:0 14px 38px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.18);}
.bc-hero-bg{position:absolute;inset:0;background:#08231a url(/hero-dunes.jpg) center 32%/cover;
  transform:scale(1.04);}
.bc-hero-bg::after{content:"";position:absolute;inset:0;background:
  linear-gradient(180deg, rgba(6,37,27,.02) 0%, rgba(6,37,27,.06) 34%, rgba(6,37,27,.42) 62%, rgba(6,37,27,.88) 85%, rgba(6,37,27,.98) 100%);}
.bc-hero-in{position:relative;padding:18px 16px 16px;min-height:340px;
  display:flex;flex-direction:column;justify-content:flex-end;gap:9px;}

.bc-bug{position:absolute;top:12px;right:12px;width:64px;height:64px;border-radius:50%;
  background:radial-gradient(circle at 50% 38%, #ffffff, #f1e7cd);border:2px solid var(--gold);
  box-shadow:0 5px 14px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.8);
  display:grid;place-items:center;overflow:hidden;}
.bc-bug img{width:80%;height:auto;display:block}

.bc-kicker{font-family:"Arial Narrow",Impact,sans-serif;font-weight:900;font-style:italic;
  font-size:13px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);
  text-shadow:var(--emboss);margin:0;}
.bc-title{margin:0;font-family:Impact,"Arial Black",sans-serif;font-style:italic;font-weight:900;
  font-size:clamp(42px,14vw,80px);line-height:.82;letter-spacing:-1.5px;text-transform:uppercase;
  background:linear-gradient(180deg,#ffffff 0%,#ffe9a8 36%,#e8b54a 50%,#b9842a 58%,#ffe28f 76%,#ffffff 100%);
  background-size:100% 220%;-webkit-background-clip:text;background-clip:text;color:transparent;
  -webkit-text-stroke:1px rgba(0,0,0,.25);
  filter:drop-shadow(0 2px 0 rgba(0,0,0,.85)) drop-shadow(0 4px 7px rgba(0,0,0,.55));
  animation:bc-chrome 1.1s ease-out both;}
.bc-title small{display:block;font-size:.42em;letter-spacing:1px;-webkit-text-stroke:0;
  color:transparent;}
@keyframes bc-chrome{from{background-position:0 -90px}to{background-position:0 0}}

.bc-sub{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-family:"Arial Narrow",Impact;
  font-weight:900;font-style:italic;font-size:15px;letter-spacing:.6px;text-transform:uppercase;
  color:#cfeede;text-shadow:0 1px 3px rgba(0,0,0,.7);}
.bc-sub .g{color:var(--gorse)} .bc-sub .d{color:var(--driftwood)}
.bc-sub .x{opacity:.55}

.bc-status{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;
  background:rgba(0,0,0,.5);border:1px solid #2c5749;border-radius:999px;padding:7px 13px;
  font-family:"Arial Narrow",Impact;font-weight:900;font-size:13px;letter-spacing:1.6px;
  text-transform:uppercase;backdrop-filter:blur(2px);}
.bc-status b{color:var(--gold)}
.bc-dot{width:9px;height:9px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 9px #ff3b3b;
  animation:bc-blink 1.3s steps(2,jump-none) infinite;}
.bc-dot.up{background:var(--gorse);box-shadow:0 0 9px var(--gorse)}
@keyframes bc-blink{50%{opacity:.2}}

/* ---- versus card ---- */
.bc-vs{display:grid;grid-template-columns:1fr auto 1fr;gap:9px;align-items:stretch;}
.bc-team{padding:12px 11px;border-radius:15px;border:1px solid;position:relative;overflow:hidden;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);}
.bc-team.gorse{border-color:rgba(244,163,0,.7);
  background:linear-gradient(180deg,rgba(244,163,0,.18),rgba(244,163,0,.02));}
.bc-team.drift{border-color:rgba(46,139,255,.7);
  background:linear-gradient(180deg,rgba(46,139,255,.18),rgba(46,139,255,.02));}
.bc-team h3{margin:0 0 8px;font-family:Impact,"Arial Black";font-style:italic;font-weight:900;
  font-size:22px;letter-spacing:.5px;text-transform:uppercase;text-shadow:var(--emboss);}
.bc-team.gorse h3{color:var(--gorse)} .bc-team.drift h3{color:var(--driftwood)}
.bc-team ul{list-style:none;margin:0;padding:0;display:grid;gap:5px;}
.bc-team li{font-family:"Arial Narrow",Impact;font-weight:700;font-size:15px;letter-spacing:.3px;
  color:#eafff4;display:flex;align-items:center;gap:7px;white-space:nowrap;}
.bc-team li .hc{margin-left:auto;font-size:12px;opacity:.6}
.bc-team li.me{font-weight:900}
.bc-team li.me::after{content:"YOU";margin-left:auto;font-size:10px;letter-spacing:1px;
  color:#1a1205;background:var(--gold);border-radius:4px;padding:1px 5px;font-style:italic;}
.bc-team li.me .hc{display:none}
.bc-vsbadge{align-self:center;justify-self:center;width:48px;height:48px;border-radius:50%;
  display:grid;place-items:center;font-family:Impact;font-style:italic;font-weight:900;font-size:20px;
  color:#1a1205;background:linear-gradient(180deg,#ffe28f,var(--gold));
  box-shadow:0 4px 10px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.7);
  border:2px solid rgba(0,0,0,.25);}

/* ---- featured (on the tee) ---- */
.bc-feat{border-radius:16px;border:1px solid #2c5749;overflow:hidden;
  background:linear-gradient(180deg,#143a2e,#0a1f17);box-shadow:inset 0 1px 0 rgba(255,255,255,.1);}
.bc-feat-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;
  padding:12px 14px 8px;}
.bc-feat-top .c{font-family:Impact,"Arial Black";font-style:italic;font-weight:900;
  font-size:clamp(20px,6vw,28px);text-transform:uppercase;text-shadow:var(--emboss);line-height:1;}
.bc-feat-top .day{font-family:"Arial Narrow",Impact;font-weight:900;font-style:italic;font-size:13px;
  letter-spacing:1.4px;color:var(--gold);white-space:nowrap;}
.bc-feat-grid{padding:0 10px 12px;display:grid;gap:8px;}

/* ---- schedule rail (home only; cards/tees/seats come from the global theme) ---- */
.bc-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;
  padding:2px 2px 12px;margin:0 -2px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;}
.bc-rail::-webkit-scrollbar{height:7px}
.bc-rail::-webkit-scrollbar-thumb{background:#2c5749;border-radius:99px}
.bc-rail .bc-card{flex:0 0 84%;max-width:320px;scroll-snap-align:start;}

/* ---- CTAs ---- */
.bc-cta{display:grid;gap:11px;margin-top:22px;}
.bc-start{font:inherit;cursor:pointer;border:none;border-radius:13px;padding:17px 18px;
  font-family:Impact,"Arial Black";font-style:italic;font-weight:900;font-size:21px;letter-spacing:1px;
  text-transform:uppercase;color:#1a1205;
  background:linear-gradient(180deg,#ffe9a8,#ffce4d 50%,#d9a93a);
  box-shadow:0 6px 0 #8a6418,0 9px 18px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.8);
  display:flex;align-items:center;justify-content:center;gap:12px;transition:transform .08s, box-shadow .08s;}
.bc-start:active{transform:translateY(4px);box-shadow:0 2px 0 #8a6418,0 4px 10px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.8)}
.bc-start .arw{animation:bc-arw 1s ease-in-out infinite}
@keyframes bc-arw{0%,100%{transform:translateX(0);opacity:.85}50%{transform:translateX(5px);opacity:1}}
.bc-row{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
.bc-ghost{font:inherit;cursor:pointer;border:1px solid #3a6b58;border-radius:12px;padding:14px;
  font-family:Impact,"Arial Black";font-style:italic;font-weight:900;font-size:15px;letter-spacing:.6px;
  text-transform:uppercase;color:#eafff4;background:linear-gradient(180deg,#16342a,#0c2018);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);transition:transform .08s,border-color .15s;}
.bc-ghost:active{transform:translateY(2px)}
.bc-ghost:hover{border-color:var(--gold)}

.bc-foot{text-align:center;margin-top:22px;font-family:Impact,"Arial Black";font-style:italic;
  font-weight:900;letter-spacing:2px;text-transform:uppercase;font-size:13px;
  color:transparent;background:linear-gradient(180deg,#7fae9b,#3f6b58 100%);
  -webkit-background-clip:text;background-clip:text;opacity:.8;}

/* ---- bottom ticker ---- */
.bc-ticker{position:fixed;left:0;right:0;bottom:0;height:36px;z-index:55;display:flex;align-items:stretch;
  background:linear-gradient(180deg,#0b2018,#06120c);border-top:2px solid var(--gold);overflow:hidden;
  box-shadow:0 -4px 16px rgba(0,0,0,.5);}
.bc-ticker-lbl{flex:0 0 auto;display:flex;align-items:center;padding:0 12px;z-index:2;
  background:linear-gradient(180deg,#ffe28f,var(--gold));color:#1a1205;
  font-family:Impact,"Arial Black";font-style:italic;font-weight:900;font-size:14px;letter-spacing:1px;
  text-transform:uppercase;box-shadow:4px 0 10px rgba(0,0,0,.5);}
.bc-ticker-win{position:relative;flex:1;overflow:hidden;}
.bc-ticker-track{position:absolute;top:0;left:0;height:100%;display:flex;align-items:center;
  white-space:nowrap;will-change:transform;animation:bc-marquee 42s linear infinite;}
@keyframes bc-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.bc-tick{display:inline-flex;align-items:center;gap:7px;padding:0 16px;
  font-family:"Arial Narrow",Impact;font-weight:700;font-size:14px;letter-spacing:.4px;color:#d6f1e4;
  border-right:1px solid rgba(255,255,255,.07);}
.bc-tick b{color:var(--gold);font-style:italic}
.bc-tick .live{color:#ff6b6b}
.bc-tick .dot{width:6px;height:6px;border-radius:50%;background:#3f6b58}

@media (min-width:560px){
  .bc-card{flex-basis:46%}
  .bc-hero-in{min-height:420px}
}

/* ---- respect reduced motion: kill all looping/transform motion, keep it gorgeous & static ---- */
@media (prefers-reduced-motion: reduce){
  .bc-crt::before{animation:none;opacity:.4}
  .bc-crt::after{display:none}
  .bc-fade{animation:none;opacity:1;transform:none}
  .bc-title{animation:none;background-position:0 0}
  .bc-dot{animation:none}
  .bc-start .arw{animation:none}
  .bc-ticker-track{animation:none}
  .bc-ticker-win{overflow-x:auto}
}
`;
