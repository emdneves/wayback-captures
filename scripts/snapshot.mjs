// scripts/snapshot.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.env.SNAPSHOT_URL;
if (!url) {
  console.error("SNAPSHOT_URL is required");
  process.exit(1);
}

// ISO timestamp safe for folder names
const ts = new Date().toISOString().replaceAll(":", "-");
const outDir = path.join("public", ts);

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

// Browser-like context (helps with Cloudflare)
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});

const page = await context.newPage();
page.setDefaultNavigationTimeout(90_000);

function looksLikeChallenge(html) {
  return /cloudflare|cf-chl|challenge|turnstile/i.test(html);
}

async function attemptLoad(maxAttempts = 3) {
  let lastErr = null;

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle" });
      const status = resp?.status() ?? null;

      const html = await page.content();
      if (looksLikeChallenge(html)) {
        throw new Error("Cloudflare challenge detected in HTML");
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

function safeSlug(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 60);
}

try {
  const { status, html } = await attemptLoad(3);

  const title = await page.title();
  const finalUrl = page.url();

  // Save rendered HTML
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");

  // Save full-page screenshot
  await page.screenshot({
    path: path.join(outDir, "screenshot.png"),
    fullPage: true,
  });

  // Save section screenshots
  const sectionsDir = path.join(outDir, "sections");
  fs.mkdirSync(sectionsDir, { recursive
