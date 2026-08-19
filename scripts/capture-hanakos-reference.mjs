import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(process.cwd(), ".chrome-cdp-profile");
const outDir = join(process.cwd(), "docs", "design-references", "hanakos-music");
const port = 9223;
const targetUrl = "https://forum.hanakos.cc/music";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status}`);
  }
  return response.json();
}

async function send(ws, method, params = {}, timeoutMs = 15000) {
  const id = ++send.id;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      send.pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
    send.pending.set(id, { resolve, reject, timer });
  });
}
send.id = 0;
send.pending = new Map();

await mkdir(outDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1440,960",
    "about:blank"
  ],
  { stdio: "ignore" }
);

try {
  let tabs = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      tabs = await getJson(`http://127.0.0.1:${port}/json/list`);
      break;
    } catch {
      await wait(250);
    }
  }

  const tab = tabs[0];
  if (!tab?.webSocketDebuggerUrl) {
    throw new Error("Could not connect to Chrome DevTools Protocol.");
  }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && send.pending.has(message.id)) {
      const pending = send.pending.get(message.id);
      send.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    }
  });
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));

  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Input.setIgnoreInputEvents", { ignore: false });
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send(ws, "Page.navigate", { url: targetUrl });
  await wait(12000);
  await send(ws, "Page.stopLoading").catch(() => {});

  const observations = [];
  for (let index = 0; index < 10; index += 1) {
    const startX = 720 + Math.sin(index * 1.7) * 180;
    const startY = 520 + Math.cos(index * 1.3) * 110;
    const endX = startX + Math.cos(index * 0.9) * 330;
    const endY = startY + Math.sin(index * 1.1) * 260;

    await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: startX, y: startY, button: "left", buttons: 1 });
    for (let step = 1; step <= 14; step += 1) {
      const t = step / 14;
      await send(ws, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: startX + (endX - startX) * t,
        y: startY + (endY - startY) * t,
        button: "left",
        buttons: 1
      });
      await wait(28);
    }
    await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: endX, y: endY, button: "left", buttons: 0 });
    await wait(650);

    const snapshot = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 45000);
    const filename = `original-drag-${String(index + 1).padStart(2, "0")}.png`;
    await writeFile(join(outDir, filename), Buffer.from(snapshot.data, "base64"));

    const result = await send(ws, "Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const cards = [...document.querySelectorAll('[style*="translate3d"], img')].slice(0, 260);
        const body = document.body?.innerText || '';
        const buttons = [...document.querySelectorAll('button')].map((button) => ({
          text: button.innerText,
          aria: button.getAttribute('aria-label'),
          cls: button.className?.toString()
        })).slice(0, 20);
        return {
          title: document.title,
          bodyLength: body.length,
          cardLikeCount: cards.length,
          buttons,
          viewport: { width: innerWidth, height: innerHeight }
        };
      })()`
    });
    observations.push({ file: filename, ...result.result.value });
  }

  await writeFile(join(outDir, "observations.json"), JSON.stringify(observations, null, 2), "utf8");
  ws.close();
  console.log(`Captured ${observations.length} reference screenshots in ${outDir}`);
} finally {
  chrome.kill();
}
