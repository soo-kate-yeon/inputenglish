#!/usr/bin/env node
// Copies the ffmpeg-static binary into apps/web/bin/ffmpeg so that Next.js'
// outputFileTracing can bundle it reliably into serverless functions.
//
// Why: ffmpeg-static's index.js resolves its binary path via
// `path.join(__dirname, 'ffmpeg')`. When Next.js bundles the module,
// __dirname ends up pointing at the compiled route handler directory,
// which never contains the binary. Co-locating a copy under apps/web/bin/
// gives the API route a deterministic absolute path to spawn.
import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function main() {
  let ffmpegSource;
  try {
    ffmpegSource = require("ffmpeg-static");
  } catch (err) {
    console.warn(
      "[copy-ffmpeg] ffmpeg-static is not installed; skipping copy.",
      err,
    );
    return;
  }

  if (!ffmpegSource) {
    console.warn(
      "[copy-ffmpeg] ffmpeg-static resolved to null (unsupported platform?); skipping.",
    );
    return;
  }

  try {
    await fs.access(ffmpegSource);
  } catch {
    console.warn(
      `[copy-ffmpeg] ffmpeg binary not found at ${ffmpegSource}; did the postinstall run?`,
    );
    return;
  }

  const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
  const webRoot = path.resolve(scriptDir, "..");
  const destDir = path.join(webRoot, "bin");
  const dest = path.join(destDir, "ffmpeg");

  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(ffmpegSource, dest);
  await fs.chmod(dest, 0o755);

  const { size } = await fs.stat(dest);
  console.log(
    `[copy-ffmpeg] copied ${ffmpegSource} -> ${dest} (${(size / 1_048_576).toFixed(1)} MB)`,
  );
}

main().catch((err) => {
  console.error("[copy-ffmpeg] failed:", err);
  process.exit(1);
});
