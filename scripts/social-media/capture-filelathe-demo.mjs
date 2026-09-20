#!/usr/bin/env node
/**
 * Capture Filelathe social stills + demo videos.
 *
 * Demo beat: tracker Play → invent mini-app → Show saved mini-apps.
 * Playwright video is silent; we decode the MOD with chiptune3 and adelay
 * the WAV so music starts when Play is clicked.
 *
 * Usage:
 *   pnpm demo:capture
 *   FILELATHE_URL=http://localhost:5174 pnpm demo:capture
 *
 * MOD render needs Vite (mod-render.html). Defaults to FILELATHE_URL when local,
 * otherwise http://localhost:5174 — override with RENDER_URL.
 *
 * Outputs → ~/Downloads/filelathe-demo/
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const fixturesDir = path.join(root, "scripts/fixtures");
const publicDemoDir = path.join(root, "public/demo");
const tmpDir = path.join(root, "tmp", "filelathe-demo");
const outDir = path.join(os.homedir(), "Downloads", "filelathe-demo");

const siteUrl = (process.env.FILELATHE_URL ?? "https://filelathe.com").replace(
  /\/$/,
  "",
);
const renderBase = (
  process.env.RENDER_URL ??
  (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")
    ? siteUrl
    : "http://localhost:5174")
).replace(/\/$/, "");

const MOD_URL =
  process.env.FILELATHE_DEMO_MOD_URL ??
  "https://api.modarchive.org/downloads.php?moduleid=171872";
const MOD_SOURCE = process.env.FILELATHE_DEMO_MOD ?? null;
const defaultBasename = "demian11.mod";
const modBasename = MOD_SOURCE
  ? path.basename(MOD_SOURCE)
  : defaultBasename;
const modPath = path.join(fixturesDir, modBasename);
const publicModPath = path.join(publicDemoDir, modBasename);
const ednPath = path.join(fixturesDir, "orbit-config.edn");
const trackerWavPath = path.join(tmpDir, "tracker-demo.wav");

fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(fixturesDir, { recursive: true });
fs.mkdirSync(publicDemoDir, { recursive: true });

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function ensureMod() {
  if (MOD_SOURCE) {
    if (!fs.existsSync(MOD_SOURCE) || fs.statSync(MOD_SOURCE).size < 1000) {
      throw new Error(`Demo module not found: ${MOD_SOURCE}`);
    }
    fs.copyFileSync(MOD_SOURCE, modPath);
    console.log(`Using module: ${MOD_SOURCE} → ${modBasename}`);
  } else if (!(fs.existsSync(modPath) && fs.statSync(modPath).size > 1000)) {
    console.log(`Downloading sample MOD → ${modPath}`);
    run("curl", ["-fsSL", MOD_URL, "-o", modPath]);
  } else {
    console.log(`Using fixture: ${modPath}`);
  }
  fs.copyFileSync(modPath, publicModPath);
}

function ensureEdn() {
  if (fs.existsSync(ednPath)) return;
  fs.writeFileSync(
    ednPath,
    [
      ";; Filelathe invent demo — sparse EDN-ish config",
      '{:app "filelathe" :format :edn :widgets [{:id 1 :label "orbit"} {:id 2 :label "lathe"}]}',
      "",
    ].join("\n"),
  );
}

async function waitForWindowCount(page, minCount, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const marked = await page.locator("[data-filelathe-window]").count();
    const legacy = await page
      .locator(
        ".pointer-events-auto.absolute.flex.flex-col.overflow-hidden.rounded-xl.border",
      )
      .count();
    if (Math.max(marked, legacy) >= minCount) return;
    await page.waitForTimeout(250);
  }
  const dump = path.join(tmpDir, `debug-windows-${Date.now()}.png`);
  await page.screenshot({ path: dump, fullPage: true }).catch(() => undefined);
  throw new Error(`Expected ≥${minCount} floating windows (see ${dump})`);
}

async function waitForWindow(page, timeout = 120_000) {
  await waitForWindowCount(page, 1, timeout);
}

async function uploadFile(page, filePath) {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath);
}

async function clickTrackerPlay(page) {
  const marked = page.locator("[data-tracker-play]").first();
  if ((await marked.count()) > 0) {
    await marked.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForFunction(() => {
      const btn = document.querySelector("[data-tracker-play]");
      return btn instanceof HTMLButtonElement && !btn.disabled;
    }, { timeout: 60_000 });
    await marked.click();
    return;
  }
  const play = page.getByRole("button", { name: /^Play$/ }).first();
  await play.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll("button")];
    const btn = buttons.find((b) => b.textContent?.trim() === "Play");
    return btn instanceof HTMLButtonElement && !btn.disabled;
  }, { timeout: 60_000 });
  await play.click();
}

/**
 * Decode the demo MOD to WAV via /mod-render.html (chiptune3 decodeAll).
 */
async function renderTrackerWav(browser) {
  const renderUrl = `${renderBase}/mod-render.html?mod=/demo/${encodeURIComponent(modBasename)}&max=40`;
  console.log(`Rendering tracker audio: ${renderUrl}`);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(renderUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(
    () =>
      window.__MOD_RENDER_READY__ === true ||
      typeof window.__MOD_RENDER_ERROR__ === "string",
    { timeout: 180_000 },
  );
  const err = await page.evaluate(() => window.__MOD_RENDER_ERROR__ ?? null);
  if (err) {
    await context.close();
    throw new Error(`MOD render failed: ${err}`);
  }

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.evaluate(() => {
      window.__downloadModWav__?.();
    }),
  ]);
  await download.saveAs(trackerWavPath);
  await context.close();

  if (!fs.existsSync(trackerWavPath) || fs.statSync(trackerWavPath).size < 1000) {
    throw new Error("Tracker WAV missing or too small");
  }
  console.log(`Tracker WAV: ${trackerWavPath}`);
  fs.copyFileSync(trackerWavPath, path.join(outDir, "tracker-demo.wav"));
}

/** Mux silent screen capture with tracker WAV, delayed until Play was clicked. */
function muxVideoWithTracker(stagedWebm, cfg, audioDelayMs) {
  const { width, height } = cfg.viewport;
  const delay = Math.max(0, Math.round(audioDelayMs));
  const fadeInAt = (delay / 1000).toFixed(3);
  console.log(`  audio delay ${delay}ms (music starts on Play)`);
  run("ffmpeg", [
    "-y",
    "-i",
    stagedWebm,
    "-i",
    trackerWavPath,
    "-filter_complex",
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=#f7f5ef,format=yuv420p[v];[1:a]adelay=${delay}:all=1,afade=t=in:st=${fadeInAt}:d=0.25,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    cfg.mp4,
  ]);
}

async function captureStill(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(siteUrl + "/", { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(800);

  const heroPath = path.join(tmpDir, "filelathe_hero.png");
  await page.screenshot({ path: heroPath, fullPage: false });

  await uploadFile(page, ednPath);
  await waitForWindow(page);
  await page.waitForTimeout(1500);

  const inventStill = path.join(tmpDir, "filelathe_invent_still.png");
  await page.screenshot({ path: inventStill, fullPage: false });

  return { heroPath, inventStill };
}

/**
 * Demo beat:
 * 1) Drop tracker → Play (music starts here)
 * 2) Invent a mini-app from unknown file
 * 3) Minimize tracker, expand invent, click its tabs
 * 4) Minimize invent, then open "Show saved mini-apps"
 */
async function clickInventedTabs(page) {
  // Get the invent window out of the tracker’s shadow.
  await minimizeWindowMatching(page, /\.mod|Tracker|demian/i);
  await page.waitForTimeout(400);

  const inventWin = page
    .locator("[data-filelathe-window]")
    .filter({ hasText: /orbit-config|\.edn/i })
    .first();
  await inventWin.waitFor({ state: "visible", timeout: 30_000 });

  // Focus + expand so tabs and pane changes are obvious on camera
  await inventWin.locator(".cursor-grab, .touch-none").first().click({
    force: true,
  }).catch(() => inventWin.click({ position: { x: 40, y: 14 }, force: true }));
  await page.waitForTimeout(300);
  const expandBtn = inventWin.getByRole("button", {
    name: /^(Expand|Maximize)$/i,
  });
  if ((await expandBtn.count()) > 0) {
    await expandBtn.first().click({ force: true });
    await page.waitForTimeout(700);
  }

  // Wait for json-render Tabs (or Accordion) to mount inside the invent chrome
  await inventWin
    .getByRole("tab")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);

  // Prefer explicit labels from common invent Specs (Text/Hex/Structure)
  const preferred = ["Hex", "Structure", "Text", "Overview", "Edit", "Raw", "Preview"];
  const named = [];
  for (const name of preferred) {
    const t = inventWin.getByRole("tab", { name: new RegExp(`^${name}$`, "i") });
    if ((await t.count()) > 0) named.push({ name, loc: t.first() });
  }

  let tabs = inventWin.getByRole("tab");
  let count = await tabs.count();
  console.log(`  invented tabs: ${count}${named.length ? ` (named: ${named.map((n) => n.name).join(", ")})` : ""}`);

  if (count === 0 && named.length === 0) {
    // Accordion / button-group fallback
    const triggers = inventWin.locator('[data-slot="accordion-trigger"]');
    const tCount = await triggers.count();
    console.log(`  invented accordion triggers: ${tCount}`);
    for (let i = 0; i < Math.min(tCount, 4); i++) {
      await triggers.nth(i).scrollIntoViewIfNeeded();
      await triggers.nth(i).click({ force: true });
      await page.waitForTimeout(1400);
    }
    return;
  }

  const sequence =
    named.length >= 2
      ? [...named, named[0]] // Hex → Structure → Text (or whatever), then back
      : Array.from({ length: count }, (_, i) => ({
          name: `tab ${i}`,
          loc: tabs.nth(i),
        })).concat(
          count > 1 ? [{ name: "tab 0", loc: tabs.nth(0) }] : [],
        );

  for (const { name, loc } of sequence) {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ force: true });
    await loc
      .waitFor({ state: "visible", timeout: 2_000 })
      .catch(() => undefined);
    // Give Radix a tick to flip data-state / panel
    await page.waitForTimeout(200);
    const state = await loc.getAttribute("data-state").catch(() => null);
    const selected = await loc.getAttribute("aria-selected").catch(() => null);
    console.log(`  → tab "${name}" state=${state ?? "?"} selected=${selected ?? "?"}`);
    // Snapshot each pane so we can verify the switch landed
    await page.screenshot({
      path: path.join(tmpDir, `tab-${name.toLowerCase()}.png`),
      fullPage: false,
    });
    await page.waitForTimeout(1500);
  }
}

async function minimizeWindowMatching(page, pattern) {
  const win = page
    .locator("[data-filelathe-window]")
    .filter({ hasText: pattern })
    .first();
  if ((await win.count()) === 0) return false;
  // Already minimized? title bar still shows Minimize vs Restore
  const restore = win.getByRole("button", { name: /^Restore$/i });
  if ((await restore.count()) > 0) return true;
  const btn = win.getByRole("button", { name: /^Minimize$/i });
  if ((await btn.count()) === 0) return false;
  await btn.click({ force: true });
  await page.waitForTimeout(350);
  return true;
}

async function runDemoScene(page, videoEpochMs) {
  await page.goto(siteUrl + "/", { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(900);

  // 1) Tracker module first
  await uploadFile(page, modPath);
  await waitForWindowCount(page, 1);
  await page.waitForTimeout(1000);
  await clickTrackerPlay(page);
  const audioDelayMs = Date.now() - videoEpochMs;
  console.log(`  Play clicked @ ${audioDelayMs}ms`);
  await page.waitForTimeout(5500);

  // 2) Invent UI for an unknown format
  await uploadFile(page, ednPath);
  await waitForWindowCount(page, 2, 180_000);
  // Wait until invent body has settled (tabs or content)
  await page.waitForTimeout(2800);

  // 3) Click through invented mini-app tabs (tracker minimized inside)
  await clickInventedTabs(page);

  // 4) Minimize invent so the saved-apps panel is visible
  await minimizeWindowMatching(page, /orbit-config|\.edn/i);
  await minimizeWindowMatching(page, /\.mod|Tracker|demian/i);
  const minimizeButtons = page.getByRole("button", { name: /^Minimize$/i });
  const nMin = await minimizeButtons.count();
  for (let i = 0; i < nMin; i++) {
    await minimizeButtons.nth(i).click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(700);

  // 5) Expand saved mini-apps — show the local Haiku save
  const showSaved = page.getByRole("button", {
    name: /Show saved mini-apps/i,
  });
  await showSaved.waitFor({ state: "visible", timeout: 30_000 });
  await showSaved.scrollIntoViewIfNeeded();
  await showSaved.click({ force: true });
  const refresh = page.getByRole("button", { name: /^Refresh$/i });
  if ((await refresh.count()) > 0) {
    await refresh.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(5500);

  return { audioDelayMs };
}

async function recordVideos(browser) {
  const configs = [
    {
      name: "horizontal",
      viewport: { width: 1280, height: 720 },
      mp4: path.join(outDir, "filelathe_demo_horizontal.mp4"),
    },
    {
      name: "square",
      viewport: { width: 1080, height: 1080 },
      mp4: path.join(outDir, "filelathe_demo_square.mp4"),
    },
    {
      name: "vertical",
      viewport: { width: 1080, height: 1920 },
      mp4: path.join(outDir, "filelathe_demo_vertical.mp4"),
    },
  ];

  for (const cfg of configs) {
    console.log(`Recording ${cfg.name}…`);
    const context = await browser.newContext({
      viewport: cfg.viewport,
      deviceScaleFactor: 1,
      recordVideo: {
        dir: tmpDir,
        size: cfg.viewport,
      },
    });
    const page = await context.newPage();
    const videoEpochMs = Date.now();
    const { audioDelayMs } = await runDemoScene(page, videoEpochMs);
    await page.close();
    await context.close();

    const webms = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith(".webm"))
      .map((f) => ({
        f,
        t: fs.statSync(path.join(tmpDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.t - a.t);
    const latest = webms[0]?.f;
    if (!latest) throw new Error(`No webm for ${cfg.name}`);
    const staged = path.join(tmpDir, `${cfg.name}.webm`);
    fs.renameSync(path.join(tmpDir, latest), staged);

    muxVideoWithTracker(staged, cfg, audioDelayMs);
    console.log(`Video: ${cfg.mp4}`);
  }
}

async function main() {
  ensureEdn();
  ensureMod();

  console.log(`Capture URL: ${siteUrl}`);
  console.log(`Render URL base: ${renderBase}`);
  const browser = await chromium.launch({ headless: true });

  await renderTrackerWav(browser);

  const stillContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const stillPage = await stillContext.newPage();
  const stills = await captureStill(stillPage);
  await stillContext.close();

  fs.copyFileSync(stills.heroPath, path.join(outDir, "filelathe_hero.png"));
  fs.copyFileSync(
    stills.inventStill,
    path.join(outDir, "filelathe_demo_still.png"),
  );

  run("ffmpeg", [
    "-y",
    "-i",
    stills.inventStill,
    "-frames:v",
    "1",
    "-update",
    "1",
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#f7f5ef",
    "-q:v",
    "2",
    path.join(outDir, "filelathe_demo_thumbnail.jpg"),
  ]);

  const og = path.join(root, "public/og.png");
  if (fs.existsSync(og)) {
    fs.copyFileSync(og, path.join(outDir, "og.png"));
  }

  await recordVideos(browser);
  await browser.close();

  console.log("\nReady-to-upload folder:", outDir);
  console.log("Posts plan: scripts/social-media/filelathe-launch-posts.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
