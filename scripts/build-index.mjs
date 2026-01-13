import fs from "node:fs";
import path from "node:path";

const base = "public";
fs.mkdirSync(base, { recursive: true });

const entries = fs
  .readdirSync(base, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .reverse();

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const items = entries
  .map((dir) => {
    const metaPath = path.join(base, dir, "meta.json");
    let label = dir;

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (meta?.title) label = `${dir} - ${meta.title}`;
    } catch {
      // ignore
    }

    return `<li>
      <a href="./${encodeURIComponent(dir)}/index.html">${escapeHtml(label)}</a>
      <a href="./${encodeURIComponent(dir)}/screenshot.png">(png)</a>
      <a href="./${encodeURIComponent(dir)}/meta.json">(meta)</a>
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

fs.writeFileSync(path.join(base, "index.html"), html, "utf-8");
console.log("Wrote public/index.html with", entries.length, "snapshots");
