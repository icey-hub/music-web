import { spawn } from "node:child_process";
import { join } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(process.cwd(), ".chrome-local-verify-profile");
const port = 9224;

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
  await send(ws, "Input.setIgnoreInputEvents", { ignore: false });
  await send(ws, "Page.navigate", { url: "http://localhost:3000/" });
  await wait(5000);

  async function readState() {
    const result = await send(ws, "Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const candidates = [...document.querySelectorAll('button[aria-label="play"], button[aria-label="pause"]')]
          .map((button, index) => {
            const rect = button.getBoundingClientRect();
            const area = Math.max(0, rect.width) * Math.max(0, rect.height);
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const centerDistance = Math.hypot(x - innerWidth / 2, y - innerHeight / 2);
            const visible = x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight && area > 120;
            const hit = visible && document.elementFromPoint(x, y)?.closest('button[aria-label="play"], button[aria-label="pause"]') === button;
            return { button, index, rect, area, visible, hit, centerDistance };
          });
        const visible = candidates.filter((item) => item.visible).sort((a, b) => {
          if (a.hit !== b.hit) return a.hit ? -1 : 1;
          return a.centerDistance - b.centerDistance;
        });
        const active = visible.find((item) => item.button.getAttribute('aria-label') === 'pause');
        const playCandidate = visible.find((item) => item.button.getAttribute('aria-label') === 'play');
        const chosen = active || playCandidate || candidates.find((item) => item.visible) || candidates[0];
        const play = chosen?.button;
        if (!play) return {
          found: false,
          title: document.title,
          bodyText: document.body?.innerText?.slice(0, 500) || '',
          buttonCount: document.querySelectorAll('button').length,
          labels: [...document.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')).slice(0, 30),
          html: document.body?.innerHTML?.slice(0, 500) || ''
        };
        const rect = play.getBoundingClientRect();
        return {
          found: true,
          label: play.getAttribute('aria-label'),
          index: chosen.index,
          visibleCandidateCount: candidates.filter((item) => item.visible).length,
          pauseCount: candidates.filter((item) => item.button.getAttribute('aria-label') === 'pause').length,
          className: play.className.toString(),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          svgClass: play.querySelector('svg')?.getAttribute('class') || ''
        };
      })()`
    });
    return result.result.value;
  }

  async function clickButton(state) {
    const x = state.rect.x + state.rect.width / 2;
    const y = state.rect.y + state.rect.height / 2;
    await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1 });
    await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0 });
    await wait(350);
  }

  let before = await readState();
  for (let attempt = 0; attempt < 24 && !before.found; attempt += 1) {
    await wait(500);
    before = await readState();
  }
  if (!before.found) throw new Error("No play/pause button found.");
  await clickButton(before);
  const afterPlay = await readState();
  await clickButton(afterPlay);
  const afterPause = await readState();

  console.log(JSON.stringify({ before, afterPlay, afterPause }, null, 2));
  if (before.label !== "play" || afterPlay.label !== "pause" || afterPause.label !== "play") {
    throw new Error("Play button state did not toggle play -> pause -> play.");
  }
  ws.close();
} finally {
  chrome.kill();
}
