import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { chromium } from "playwright";

const repoRoot = process.cwd();
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wav", "audio/wav"],
]);

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return mimeTypes.get(extension) ?? "application/octet-stream";
}

function resolveRequestPath(urlPath) {
  let relativePath = decodeURIComponent(urlPath.split("?")[0]);
  if (relativePath === "/") {
    relativePath = "/index.html";
  }

  const absolutePath = path.join(repoRoot, relativePath);
  const normalizedPath = path.normalize(absolutePath);
  if (!normalizedPath.startsWith(repoRoot)) {
    return null;
  }

  return normalizedPath;
}

const server = http.createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url ?? "/");
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      const body = await readFile(indexPath);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(body);
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

const address = await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address()));
  server.on("error", reject);
});

if (!address || typeof address === "string") {
  throw new Error("Failed to start smoke-test server.");
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const pageErrors = [];
const requestFailures = [];
page.on("pageerror", (error) => {
  pageErrors.push(error.message);
});
page.on("requestfailed", (request) => {
  requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
});

async function assertNoRuntimeErrors(label) {
  if (pageErrors.length || requestFailures.length) {
    throw new Error(
      `${label}: runtime problems detected.\n${[...pageErrors, ...requestFailures].join("\n")}`,
    );
  }
}

await page.goto(`${baseUrl}/app/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(300);
await assertNoRuntimeErrors("practice");

const practiceState = await page.evaluate(() => ({
  playDisabled: document.querySelector("#play-button")?.disabled ?? true,
  revealText: document.querySelector("#revealed-text")?.textContent?.trim() ?? "",
}));

if (practiceState.playDisabled) {
  throw new Error("practice: expected play button to be enabled.");
}

if (!practiceState.revealText) {
  throw new Error("practice: expected a built-in sentence to be loaded into the reveal area.");
}

await page.goto(`${baseUrl}/app/manage.html`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(300);
await assertNoRuntimeErrors("manage");

const manageState = await page.evaluate(() => ({
  hasForm: Boolean(document.querySelector("#sentence-form")),
  hasList: Boolean(document.querySelector("#sentence-list")),
}));

if (!manageState.hasForm || !manageState.hasList) {
  throw new Error("manage: expected sentence form and sentence list to be present.");
}

await context.close();
await browser.close();
await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

console.log("Browser smoke checks passed.");
