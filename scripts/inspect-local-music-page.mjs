import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(process.cwd(), ".chrome-local-inspect-profile");
const outDir = join(process.cwd(), "docs", "design-references", "local-music");
const port = 9225;

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

await mkdir(outDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--disable-software-rasterizer",
    "--no-sandbox",
    "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1440,960",
    "about:blank"
  ],
  { stdio: ["ignore", "ignore", "inherit"] }
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
  ws.addEventListener("close", (event) => {
    console.warn(`CDP socket closed: ${event.code} ${event.reason}`);
  });
  ws.addEventListener("error", (event) => {
    console.warn("CDP socket error", event.error ?? event.message ?? event);
  });
  ws.addEventListener("message", async (event) => {
    const payload = typeof event.data === "string"
      ? event.data
      : typeof event.data?.text === "function"
        ? await event.data.text()
        : Buffer.from(event.data).toString("utf8");
    const message = JSON.parse(payload);
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
  await send(ws, "Page.navigate", { url: "http://localhost:3000/" });
  await wait(5000);

  const result = await send(ws, "Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const buttons = [...document.querySelectorAll('[data-player-control="play"]')].map((button, index) => {
        const rect = button.getBoundingClientRect();
        const card = button.closest('article');
        const cardRect = card?.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const centerDistance = Math.hypot(centerX - innerWidth / 2, centerY - innerHeight / 2);
        return {
          index,
          label: button.getAttribute('aria-label'),
          trackId: button.getAttribute('data-track-id'),
          current: button.getAttribute('data-current'),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          cardRect: cardRect ? { left: cardRect.left, top: cardRect.top, right: cardRect.right, bottom: cardRect.bottom, width: cardRect.width, height: cardRect.height } : null,
          prominent: card?.getAttribute('data-prominent'),
          inViewport: centerX >= 0 && centerX <= innerWidth && centerY >= 0 && centerY <= innerHeight,
          centerDistance,
          elementAtCenter: document.elementFromPoint(centerX, centerY)?.closest('[data-player-control="play"]') === button
        };
      }).sort((a, b) => {
        if (a.inViewport !== b.inViewport) return a.inViewport ? -1 : 1;
        if (a.elementAtCenter !== b.elementAtCenter) return a.elementAtCenter ? -1 : 1;
        return a.centerDistance - b.centerDistance;
      });
      return {
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 400) || '',
        viewport: { width: innerWidth, height: innerHeight },
        mainClass: document.querySelector('main')?.className || '',
        sectionClass: document.querySelector('section')?.className || '',
        sectionStyle: document.querySelector('section')?.getAttribute('style') || '',
        sectionComputed: (() => {
          const section = document.querySelector('section');
          if (!section) return null;
          const style = getComputedStyle(section);
          const rect = section.getBoundingClientRect();
          return {
            position: style.position,
            inset: style.top + ' ' + style.right + ' ' + style.bottom + ' ' + style.left,
            transform: style.transform,
            transformStyle: style.transformStyle,
            zIndex: style.zIndex,
            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
          };
        })(),
        firstArticle: (() => {
          const article = document.querySelector('article');
          if (!article) return null;
          const style = getComputedStyle(article);
          const rect = article.getBoundingClientRect();
          return {
            className: article.className,
            style: article.getAttribute('style'),
            position: style.position,
            left: style.left,
            top: style.top,
            width: style.width,
            height: style.height,
            transform: style.transform,
            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
          };
        })(),
        buttonCount: buttons.length,
        firstButtons: buttons.slice(0, 20)
      };
    })()`
  });

  await writeFile(join(outDir, "local-inspection.json"), JSON.stringify(result.result.value, null, 2), "utf8");
  console.log(JSON.stringify(result.result.value, null, 2));

  try {
    const snapshot = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 45000);
    await writeFile(join(outDir, "local-before-click.png"), Buffer.from(snapshot.data, "base64"));
  } catch (error) {
    console.warn(`Screenshot skipped: ${error.message}`);
  }

  ws.close();
} finally {
  chrome.kill();
}
