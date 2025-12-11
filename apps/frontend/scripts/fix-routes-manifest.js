/* eslint-disable no-console */
// Ensures routes-manifest.json contains the fields Next.js expects for next start.

import fs from "node:fs";
import path from "node:path";

const manifestPath = path.join(process.cwd(), ".next-build", "routes-manifest.json");

try {
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  manifest.dynamicRoutes = ensureArray(manifest.dynamicRoutes);
  manifest.dataRoutes = ensureArray(manifest.dataRoutes);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log("[fix-routes-manifest] patched", manifestPath);
} catch (error) {
  console.warn("[fix-routes-manifest] failed", { error });
}
