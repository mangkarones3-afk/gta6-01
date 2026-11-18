// cover.mjs — re-stages the cover screenshot as a genuine police box-in.
// Starts from the game's own ?shot=cover staging (mission 1, El Mercado,
// player in a car, wanted active), then repositions the player car and the
// four staged police cars into a contact box-in on the sign-dense market
// street and burst-captures the moment so the best frame can be picked by
// eye. Nothing is composited: every frame is a live render of the game.
// Usage: node playtest/cover.mjs [outDir]

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/hatch/workspace/makefun/shots-tool/node_modules/playwright-core");
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL = "file://" + ROOT + "/game/index.html";
const OUT = process.argv[2] || "/tmp/sb-cover-burst";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(URL + "?shot=cover");
await page.waitForFunction(() => window.SB && window.SB.state, null, { timeout: 20000 });
await sleep(400);

const pre = await page.evaluate(() => {
  const SB = window.SB;
  return {
    playerCar: SB.world.playerCar ? { x: SB.world.playerCar.x, y: SB.world.playerCar.y, color: SB.world.playerCar.color, len: SB.world.playerCar.len } : null,
    cops: SB.wanted.S.cops.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), color: c.color })),
    stars: SB.state().wanted.stars,
  };
});
console.log("pre-stage:", JSON.stringify(pre));

// The dispatch line posts on the organic star increase and then stays up
// for a few seconds of world time (S.dispatch.until). So: first park the
// heat mid-3-star band and let the staging's own converging units ram the
// player at the spawn point — that crosses into 4 stars and posts the
// dispatch. The moment it posts, teleport the player to the market street
// and build the box-in around him inside the dispatch window: two of the
// surviving units ride in contact alongside (the wanted system keeps
// those; head-on units in the player's lane get recycled within a frame
// or two), and three fresh units are staged angled/front and rear so they
// close in during the burst while the flankers stay pinned.
await page.evaluate(() => { window.SB.wanted.S.heat = 250; window.SB.wanted.S.stars = 3; });
let posted = null;
for (let i = 0; i < 50 && !posted; i++) {
  await sleep(100);
  posted = await page.evaluate(() => {
    const S = window.SB.wanted.S;
    return S.dispatch && S.dispatch.text ? { until: S.dispatch.until, now: window.SB.world.time, stars: S.stars } : null;
  });
}
console.log("dispatch posted:", JSON.stringify(posted));
if (!posted) { console.log("dispatch never posted — aborting"); await browser.close(); process.exit(1); }

const stage = await page.evaluate(() => {
  const SB = window.SB;
  const PX = 905, PY = 326;
  SB.teleport(PX, PY);
  const cops = SB.wanted.S.cops;
  const place = (c, x, y, heading) => {
    if (!c) return;
    c.x = x; c.y = y; c.heading = heading;
    if ("velFwd" in c) c.velFwd = 0;
    if ("vel" in c) c.vel = 0;
    c.route = []; c.routeT = 0; c.stuckFor = 0; c.reverseFor = 0;
  };
  place(cops[0], PX, PY - 3.4, 0);             // north flank, parallel
  place(cops[1], PX, PY + 3.4, 0);             // south flank, parallel
  SB.stageCop(PX + 13, PY - 6, 2.79);          // front cover, angled in
  SB.stageCop(PX - 13, PY + 6, -0.35);         // rear cover, angled in
  SB.stageCop(PX + 13, PY + 6, -2.79);         // fifth unit, front-south
  SB.wanted.S.heat = 285;
  SB.wanted.S.stars = 4;
  return SB.wanted.S.cops.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }));
});
console.log("staged cops:", JSON.stringify(stage));

for (let i = 0; i < 24; i++) {
  await sleep(i === 0 ? 150 : 60);
  const st = await page.evaluate(() => {
    const SB = window.SB;
    const s = SB.state();
    const S = SB.wanted.S;
    return {
      bust: Math.round(s.wanted.bust * 100) / 100, stars: s.wanted.stars, heat: Math.round(S.heat),
      dispatch: !!(S.dispatch && S.dispatch.text), dispLeft: S.dispatch ? Math.round((S.dispatch.until - SB.world.time) * 10) / 10 : 0,
      cops: SB.wanted.S.cops.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
      player: { x: Math.round(SB.player.x), y: Math.round(SB.player.y) },
    };
  });
  await page.screenshot({ path: path.join(OUT, "cover-" + i + ".png") });
  console.log("frame", i, JSON.stringify(st));
}
console.log(errs.length ? "PAGE ERRORS: " + errs.join(" | ") : "no page errors");
await browser.close();
console.log("burst in " + OUT);
