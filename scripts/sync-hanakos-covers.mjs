import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { basename, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const bundleUrl = "https://forum.hanakos.cc/_next/static/chunks/app/music/page-1cd8793810cefedd.js";
const coverDir = join(process.cwd(), "public", "covers", "hanakos");
const tracksFile = join(process.cwd(), "src", "data", "tracks.ts");
const bundleFile = join(process.cwd(), ".hanakos-music-page.js");

async function fetchTextWithPowerShell(url) {
  const { spawn } = await import("node:child_process");
  await new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Invoke-WebRequest -Uri '${url}' -UseBasicParsing -OutFile '${bundleFile}'`
      ],
      { stdio: "inherit" }
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PowerShell download failed with exit code ${code}`));
    });
  });
  return readFile(bundleFile, "utf8");
}

function extractTracks(bundleText) {
  const marker = "JSON.parse('";
  const start = bundleText.indexOf(marker);
  if (start === -1) {
    throw new Error("Could not find embedded track JSON in original bundle.");
  }

  let cursor = start + marker.length;
  let raw = "";
  let escaped = false;
  while (cursor < bundleText.length) {
    const char = bundleText[cursor];
    if (escaped) {
      raw += `\\${char}`;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "'") {
      break;
    } else {
      raw += char;
    }
    cursor += 1;
  }

  const decoded = Function(`"use strict"; return '${raw}';`)();
  return JSON.parse(decoded);
}

function coverFileName(track, index) {
  const url = new URL(track.cover);
  const extension = extname(url.pathname) || ".jpg";
  const sourceName = basename(url.pathname, extension).replace(/[^a-zA-Z0-9_-]/g, "");
  return `${String(index).padStart(2, "0")}-${sourceName}${extension}`;
}

async function downloadCover(track, index) {
  const filename = coverFileName(track, index);
  const output = join(coverDir, filename);
  try {
    const response = await fetch(track.cover);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }
    await pipeline(response.body, createWriteStream(output));
  } catch {
    const { spawn } = await import("node:child_process");
    await new Promise((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Invoke-WebRequest -Uri '${track.cover}' -UseBasicParsing -OutFile '${output}'`
        ],
        { stdio: "inherit" }
      );
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Cover download failed with exit code ${code}: ${track.cover}`));
      });
    });
  }
  return `/covers/hanakos/${filename}`;
}

function toTrackSource(tracks) {
  const serialized = JSON.stringify(tracks, null, 2).replace(/"([^"]+)":/g, "$1:");
  return `import type { Track } from "@/types/music";\n\nexport const tracks: Track[] = ${serialized};\n`;
}

await mkdir(coverDir, { recursive: true });

const bundleText = await fetchTextWithPowerShell(bundleUrl);
const originalTracks = extractTracks(bundleText);
const syncedTracks = [];

for (let index = 0; index < originalTracks.length; index += 1) {
  const track = originalTracks[index];
  const cover = await downloadCover(track, index);
  syncedTracks.push({
    ...track,
    cover
  });
}

await writeFile(tracksFile, toTrackSource(syncedTracks), "utf8");

console.log(`Synced ${syncedTracks.length} tracks and covers.`);
