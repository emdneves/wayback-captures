// scripts/snapshot.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.env.SNAPSHOT_URL;
if (!url) {
  console.error("SNAPSHOT_URL is required");
  process.exit(1);
}

function looksLikeChallenge(html) {
  return /cloudflare|cf-chl|challenge|turnstile/i.test(html);
}

function slugifyTitle(title) {
  return String(title || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function utcStampForFolder(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}-${mi}-${ss}`;
}

const now = new Date();
const ts = utcStampForFolder(now);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});

const page = await context.newPage();
page.setDefaultNavigationTimeout(90_000);

async function attemptLoad(maxAttempts = 3) {
  let lastErr = null;

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle" });
      const status = resp?.status() ?? null;

      const html = await page.content();
      if (looksLikeChallenge(html)) {
        throw new Error("Cloudflare challenge detected");
      }

      return { status, html };
    } catch (e) {
      lastErr = e;
      console.log(`Attempt ${i}/${maxAttempts} failed: ${e.message}`);
      if (i < maxAttempts) {
        await page.waitForTimeout(3000);
      }
    }
  }

  throw lastErr;
}

try {
  const { status, html } = await attemptLoad(3);

  const title = await page.title();
  const finalUrl = page.url();

  const titleSlug = slugifyTitle(title) || "untitled";
  const folderName = `${ts}--${titleSlug}`;
  const outDir = path.join("captures", folderName);

  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");

  await page.screenshot({
    path: path.join(outDir, "screenshot.png"),
    fullPage: true,
  });

  const meta = {
    timestamp_utc: now.toISOString(),
    requested_url: url,
    final_url: finalUrl,
    http_status: status,
    title,
    folder: folderName,
  };

  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  console.log("Snapshot saved:", outDir);
  console.log(meta);
} finally {
  await browser.close();
}
