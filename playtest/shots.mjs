// shots.mjs — captures the four judged screenshots as real renders of the
// running game in headless Chromium (staging hooks reach real game states;
// nothing is edited or composited). Cover candidates are captured as a
// burst and the best frame is chosen after visual inspection.
// Usage: node playtest/shots.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/hatch/workspace/makefun/shots-tool/node_modules/playwright-core");
const EXE = "/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL = "file://" + ROOT + "/game/index.html";
const TMP = "/tmp/sb-shots";
fs.mkdirSync(TMP, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });

async function capture(shot, outName, settleMs, tweak) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL + "?shot=" + shot);
  await page.waitForFunction(() => window.SB && window.SB.state, null, { timeout: 20000 });
  await sleep(settleMs);
  if (tweak) await page.evaluate(tweak);
  await sleep(120);
  const file = path.join(TMP, outName);
  await page.screenshot({ path: file });
  await page.close();
  console.log(outName + " captured" + (errs.length ? " PAGE ERRORS: " + errs.join(" | ") : ""));
  return file;
}

// Cover burst: cops converge over time; take three moments, pick by eye.
await capture("cover", "cover-a.png", 1000);
await capture("cover", "cover-b.png", 1700);
await capture("cover", "cover-c.png", 2400);
await capture("street", "street.png", 2200);
await capture("drive", "drive.png", 1500);
await capture("start", "start.png", 2000);

await browser.close();
console.log("raw captures in " + TMP);
