import fs from "node:fs";
import path from "node:path";

const base = "public";
fs.mkdirSync(base, { recursive: true });

const dirs = fs
  .readdirSync(base, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .reverse();

const items = dirs
  .map((d) => {
    const p = path.join(base, d, "meta.json");
    let title = d;
    try {
      const meta = JSON.parse(fs.readFileSync(p, "utf-8"));
      title = meta.title ? `${d} - ${meta.title}` : d;
    } catch {}
    return `<li><a href="./${d}/index.html">${escapeHtml(title)}</a> <a href="./${d}/screenshot.png">(png)</a> <a href="./${d}/meta.json">(meta)</a></li>`;
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

fs.writeFileSync(path.join(base, "index.html"), html, "utf-8");

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
