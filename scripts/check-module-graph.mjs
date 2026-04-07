import * as esbuild from "esbuild";
import path from "node:path";

const repoRoot = process.cwd();
const entryPoints = ["app/app.js", "app/manage.js"].map((entryPoint) =>
  path.join(repoRoot, entryPoint),
);

await esbuild.build({
  absWorkingDir: repoRoot,
  bundle: true,
  entryPoints,
  format: "esm",
  outdir: path.join(repoRoot, ".tmp-module-graph-check"),
  platform: "browser",
  logLevel: "silent",
  write: false,
});

console.log("Module graph checks passed.");
