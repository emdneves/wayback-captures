// scripts/build-index.mjs
import fs from "node:fs";
import path from "node:path";

const CAPTURES_DIR = "captures";
const PUBLIC_DIR = "public";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rmDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function copyDir(src, dst) {
  ensureDir(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);

    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

// Rebuild public/ fresh every time
rmDir(PUBLIC_DIR);
ensureDir(PUBLIC_DIR);

// If captures doesn't exist yet, create it so the script doesn't crash
ensureDir(CAPTURES_DIR);

// Copy captures into public
const captureDirs = fs
  .readdirSync(CAPTURES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .reverse();

for (const dir of captureDirs) {
  copyDir(path.join(CAPTURES_DIR, dir), path.join(PUBLIC_DIR, dir));
}

// Build index.html
const items = captureDirs
  .map((dir) => {
    let label = dir;
    const metaPath = path.join(CAPTURES_DIR, dir, "meta.json");

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (meta?.title) label = `${dir} - ${meta.title}`;
    } catch {
      // ignore
    }

    const safeDir = encodeURIComponent(dir);
    return `<li>
      <a href="./${safeDir}/index.html">${escapeHtml(label)}</a>
      <a href="./${safeDir}/screenshot.png">(png)</a>
      <a href="./${safeDir}/meta.json">(meta)</a>
    </li>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Snapshots</title>
</head>
<body>
  <h1>Snapshots</h1>
  <ul>
    ${items}
  </ul>
</body>
</html>`;

fs.writeFileSync(path.join(PUBLIC_DIR, "index.html"), html, "utf-8");

console.log(`Built ${PUBLIC_DIR}/index.html with ${captureDirs.length} snapshots`);
