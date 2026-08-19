import { spawn } from "node:child_process";
import { join } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(process.cwd(), ".chrome-local-covers-profile");
const port = 9226;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
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

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
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

  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
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
  await send(ws, "Page.navigate", { url: "http://localhost:3000/" });
  await wait(5000);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = await send(ws, "Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => ({
        href: location.href,
        readyState: document.readyState,
        articleCount: document.querySelectorAll('article').length,
        imageCount: document.querySelectorAll('article img').length,
        bodyText: document.body?.innerText?.slice(0, 80) || ''
      }))()`
    });
    if (ready.result.value.href.includes('localhost:3000') && ready.result.value.imageCount > 0) {
      break;
    }
    await wait(500);
  }

  const result = await send(ws, "Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const images = [...document.querySelectorAll('article img')].map((img) => ({
        src: img.getAttribute('src'),
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayed: getComputedStyle(img).display !== 'none'
      }));
      const failed = images.filter((img) => !img.complete || img.naturalWidth <= 0 || !img.displayed);
      const uniqueSources = [...new Set(images.map((img) => img.src).filter(Boolean))];
      return {
        href: location.href,
        readyState: document.readyState,
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 160) || '',
        articleCount: document.querySelectorAll('article').length,
        imageCount: images.length,
        loadedCount: images.length - failed.length,
        failedCount: failed.length,
        uniqueSourceCount: uniqueSources.length,
        nonHanakosSources: uniqueSources.filter((src) => !src.includes('/covers/hanakos/')),
        failed: failed.slice(0, 20)
      };
    })()`
  });

  console.log(JSON.stringify(result.result.value, null, 2));
  if (result.result.value.articleCount <= 0 || result.result.value.imageCount <= 0) {
    throw new Error("No card cover images found in the page.");
  }
  if (result.result.value.nonHanakosSources.length > 0) {
    throw new Error("Some card covers are not using local Hanakos source covers.");
  }
  if (result.result.value.failedCount > 0) {
    throw new Error("Some card covers failed to load.");
  }
  ws.close();
} finally {
  chrome.kill();
}
