// Inline data/kpi-history.json into src/dashboard-template.html -> index.html.
// index.html IS committed: GitHub Pages serves it straight from the repo root.
// Usage: node scripts/build.mjs
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = readFileSync(join(root, "data/kpi-history.json"), "utf8").trim();
const template = readFileSync(join(root, "src/dashboard-template.html"), "utf8");
const MARKER = "/*__DATA__*/;";
if (!template.includes(MARKER)) throw new Error("Data marker not found in template");

const TITLE = "Torchbearer Social KPIs";
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
</head>
<body>
${template.replace(MARKER, data + ";")}
</body>
</html>
`;
writeFileSync(join(root, "index.html"), page);
console.log(`Built index.html (${(page.length / 1024).toFixed(0)} KB)`);
