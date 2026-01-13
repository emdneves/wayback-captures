import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.env.SNAPSHOT_URL;
if (!url) {
  console.error("SNAPSHOT_URL is required");
  process.exit(1);
}

const ts = new Date().toISOString().replaceAll(":", "-");
const outDir = path.join("public", ts);

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});

const page = await context.newPage();
page.setDefaultNavigationTimeout(90000);

try {
  const resp = await page.goto(url, { waitUntil: "networkidle" });
  const status = resp?.status() ?? null;

  // Save rendered HTML
  const html = await page.content();
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");

  // Save full page screenshot
  await page.screenshot({ path: path.join(outDir, "screenshot.png"), fullPage: true });

  // Save metadata (helpful for audits)
  const title = await page.title();
  const finalUrl = page.url();

  const meta = {
    timestamp_utc: ts,
    requested_url: url,
    final_url: finalUrl,
    http_status: status,
    title,
  };

  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  console.log("Snapshot saved:", outDir);
  console.log(meta);
} finally {
  await browser.close();
}
