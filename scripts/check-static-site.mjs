import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const siteRoot = path.join(repoRoot, "site");
const htmlFiles = ["index.html", "manage.html"];
const cssFiles = ["style.css"];
const errors = [];

function addError(message) {
  errors.push(message);
}

async function fileExists(relativePath) {
  try {
    await access(path.join(siteRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function checkHtmlFile(relativePath) {
  const absolutePath = path.join(siteRoot, relativePath);
  const html = await readFile(absolutePath, "utf8");

  if (!html.includes("<!doctype html>")) {
    addError(`${relativePath}: missing lowercase <!doctype html>.`);
  }

  const stylesheetMatches = [...html.matchAll(/href="([^"]+\.css)"/g)];
  for (const match of stylesheetMatches) {
    const target = match[1];
    const resolved = path.normalize(path.join(path.dirname(relativePath), target));
    if (!(await fileExists(resolved))) {
      addError(`${relativePath}: missing stylesheet target ${target}.`);
    }
  }

  const moduleMatches = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)];
  for (const match of moduleMatches) {
    const target = match[1];
    const resolved = path.normalize(path.join(path.dirname(relativePath), target));
    if (!(await fileExists(resolved))) {
      addError(`${relativePath}: missing module script target ${target}.`);
    }
  }
}

async function checkCssFile(relativePath) {
  const absolutePath = path.join(siteRoot, relativePath);
  const css = await readFile(absolutePath, "utf8");

  const openBraces = (css.match(/\{/g) ?? []).length;
  const closeBraces = (css.match(/\}/g) ?? []).length;
  if (openBraces !== closeBraces) {
    addError(`${relativePath}: unbalanced CSS braces.`);
  }
}

async function checkSiteFiles() {
  const entries = await readdir(siteRoot, { withFileTypes: true });
  const entryNames = new Set(entries.map((entry) => entry.name));

  for (const requiredFile of ["index.html", "manage.html", "style.css", "app.js", "manage.js"]) {
    if (!entryNames.has(requiredFile)) {
      addError(`site root: missing ${requiredFile}.`);
    }
  }
}

await checkSiteFiles();
await Promise.all(htmlFiles.map(checkHtmlFile));
await Promise.all(cssFiles.map(checkCssFile));

if (errors.length) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

console.log("Static site checks passed.");
