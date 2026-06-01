export const COLORS = {
  gorse: "#F4A300",
  driftwood: "#2E8BFF",
  deepGreen: "#0b3d2e",
  panel: "#0f1a17",
  gold: "#d9b24a",
};

export const themeCss = `
:root{
  --gorse:${COLORS.gorse}; --driftwood:${COLORS.driftwood};
  --deep-green:${COLORS.deepGreen}; --panel:${COLORS.panel}; --gold:${COLORS.gold};
  --bevel: inset 0 1px 0 rgba(255,255,255,.25), inset 0 -2px 4px rgba(0,0,0,.5);
  --emboss: 1px 1px 0 #000, -1px -1px 0 rgba(255,255,255,.15);
}
*{box-sizing:border-box} html,body,#root{margin:0;height:100%;background:var(--deep-green);color:#fff;
  font-family:"Arial Black",Impact,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
.head{font-style:italic;text-transform:uppercase;letter-spacing:.5px;text-shadow:var(--emboss)}
.panel{background:linear-gradient(180deg,#15302a,#0a1714);border:1px solid #2a4a40;border-radius:12px;box-shadow:var(--bevel)}
.btn{font:inherit;border:none;border-radius:10px;padding:14px 18px;color:#1a1205;font-weight:900;
  background:linear-gradient(180deg,#ffd877,var(--gold));box-shadow:var(--bevel);text-transform:uppercase}
.btn:active{transform:translateY(1px)}
`;
