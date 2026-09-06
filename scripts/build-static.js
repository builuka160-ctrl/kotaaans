#!/usr/bin/env node
// Collects the frontend into dist/ for static hosts (Netlify, and any CDN).
// Only these files belong on a CDN — the backend sources stay out of it.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const out = path.join(root, "dist");
const entries = ["index.html", "sw.js", "robots.txt", "sitemap.xml", ".nojekyll", "css", "js", "images", "media"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) {
    console.warn(`skipped missing ${entry}`);
    continue;
  }
  fs.cpSync(source, path.join(out, entry), { recursive: true });
  console.log(`copied ${entry}`);
}

console.log(`Frontend ready in ${path.relative(root, out)}/`);
