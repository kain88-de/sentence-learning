import * as esbuild from "esbuild";
import path from "node:path";

const repoRoot = process.cwd();
const siteRoot = path.join(repoRoot, "site");
const entryPoints = ["app.js", "manage.js"].map((entryPoint) =>
  path.join(siteRoot, entryPoint),
);

await esbuild.build({
  absWorkingDir: siteRoot,
  bundle: true,
  entryPoints,
  format: "esm",
  outdir: path.join(repoRoot, ".tmp-module-graph-check"),
  platform: "browser",
  logLevel: "silent",
  write: false,
});

console.log("Module graph checks passed.");
