import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(process.cwd(), ".chrome-local-regression-profile");
const outDir = join(process.cwd(), "docs", "design-references", "local-music");
const port = 9226;
const targetUrl = process.argv[2] ?? process.env.MUSIC_TEST_URL ?? "http://localhost:3000/";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

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
  { stdio: "ignore" }
);

let ws;

try {
  let tabs = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      tabs = await getJson(`http://127.0.0.1:${port}/json/list`);
      if (tabs.length > 0) break;
    } catch {
      // Chrome is still starting.
    }
    await wait(250);
  }

  if (!tabs[0]?.webSocketDebuggerUrl) {
    throw new Error("Chrome did not expose a debuggable tab");
  }

  ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  const pending = new Map();
  const runtimeErrors = [];
  let messageId = 0;

  ws.addEventListener("message", async (event) => {
    const payload = typeof event.data === "string"
      ? event.data
      : typeof event.data?.text === "function"
        ? await event.data.text()
        : Buffer.from(event.data).toString("utf8");
    const message = JSON.parse(payload);

    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }

    if (message.method === "Runtime.exceptionThrown") {
      runtimeErrors.push(message.params?.exceptionDetails?.text ?? "Unknown runtime exception");
    }
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      runtimeErrors.push(message.params.entry.text);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}, timeoutMs = 15000) => {
    const id = ++messageId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
    });
  };

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  };

  const waitForActiveTrack = async (timeoutMs = 2400) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const activeTrackId = await evaluate(`document.querySelector('article[data-prominent="active"]')?.getAttribute('data-track-id') || null`);
      if (activeTrackId) return activeTrackId;
      await wait(100);
    }
    return null;
  };

  const screenshot = async (name) => {
    try {
      const snapshot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false
      }, 20000);
      await writeFile(join(outDir, name), Buffer.from(snapshot.data, "base64"));
      return true;
    } catch {
      return false;
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.navigate", { url: targetUrl });
  await wait(4500);

  const desktop = await evaluate(`(() => {
    const active = document.querySelector('article[data-prominent="active"]');
    const activeRect = active?.getBoundingClientRect();
    const allImages = [...document.querySelectorAll('.music-card-inner img')];
    const close = document.querySelector('[aria-label="Close music wall"]');
    const nextView = document.querySelector('[aria-label="Next view"]');
    const visibleTabStops = [...document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter((element) => element.tabIndex >= 0 && getComputedStyle(element).display !== 'none')
      .map((element) => element.getAttribute('aria-label') || element.tagName);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      activeTrackId: active?.getAttribute('data-track-id') || null,
      activeCards: document.querySelectorAll('article[aria-hidden="false"]').length,
      hiddenCards: document.querySelectorAll('article[aria-hidden="true"]').length,
      activeRect: activeRect ? { left: activeRect.left, top: activeRect.top, width: activeRect.width, height: activeRect.height } : null,
      visibleTabStops,
      imageCount: allImages.length,
      lazyImageCount: allImages.filter((image) => image.loading === 'lazy').length,
      loadedImageCount: allImages.filter((image) => image.complete && image.naturalWidth > 0).length,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 160) || '',
      closeVisible: close ? getComputedStyle(close).display !== 'none' : false,
      sideControlsVisible: nextView ? getComputedStyle(nextView).display !== 'none' : false
    };
  })()`);

  desktop.idleCardStyleMutations = await evaluate(`(async () => {
    let mutations = 0;
    let frameRequests = 0;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      frameRequests += 1;
      return originalRequestAnimationFrame.call(window, callback);
    };
    const observer = new MutationObserver((entries) => {
      mutations += entries.filter((entry) => entry.target.matches?.('article.music-card-shell')).length;
    });
    observer.observe(document.querySelector('main > section'), { subtree: true, attributes: true, attributeFilter: ['style'] });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    observer.disconnect();
    window.requestAnimationFrame = originalRequestAnimationFrame;
    return { mutations, frameRequests };
  })()`);

  desktop.sphere = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('article.music-card-shell')];
    const samples = [...document.querySelectorAll('article.music-card-shell')]
      .map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          trackId: card.getAttribute('data-track-id'),
          sphereSide: card.getAttribute('data-sphere-side'),
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          transform: card.style.transform
        };
      })
      .filter((card) => card.sphereSide === 'front' && card.centerX > 0 && card.centerX < innerWidth && card.centerY > 0 && card.centerY < innerHeight);
    const center = samples.reduce((best, card) => {
      const distance = Math.hypot(card.centerX - innerWidth / 2, card.centerY - innerHeight / 2);
      return !best || distance < best.distance ? { ...card, distance } : best;
    }, null);
    const left = samples.reduce((best, card) => {
      const distance = Math.hypot(card.centerX - innerWidth * 0.18, card.centerY - innerHeight / 2);
      return !best || distance < best.distance ? { ...card, distance } : best;
    }, null);
    const right = samples.reduce((best, card) => {
      const distance = Math.hypot(card.centerX - innerWidth * 0.82, card.centerY - innerHeight / 2);
      return !best || distance < best.distance ? { ...card, distance } : best;
    }, null);
    return {
      frontCards: cards.filter((card) => card.getAttribute('data-sphere-side') === 'front').length,
      backCards: cards.filter((card) => card.getAttribute('data-sphere-side') === 'back').length,
      center,
      left,
      right
    };
  })()`);

  const desktopScreenshot = await screenshot("regression-desktop.png");

  const beforeDrag = desktop.activeTrackId;
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 1120,
    y: 650,
    button: "left",
    buttons: 1,
    clickCount: 1
  });
  for (let index = 1; index <= 14; index += 1) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: 1120 - index * 26,
      y: 650 - index * 8,
      button: "left",
      buttons: 1
    });
    await wait(18);
  }
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 756,
    y: 538,
    button: "left",
    buttons: 0,
    clickCount: 1
  });
  await wait(1200);
  const afterDrag = await waitForActiveTrack();

  const beforeShift = afterDrag;
  await evaluate(`document.querySelector('[aria-label="Next view"]')?.click()`);
  await wait(1200);
  const afterShift = await waitForActiveTrack();

  const selectedTrack = await evaluate(`(() => {
    const active = document.querySelector('article[data-prominent="active"]');
    const expected = active?.getAttribute('data-track-id') || null;
    active?.querySelector('[data-player-control="play"]')?.click();
    return expected;
  })()`);
  await wait(250);
  const playInteraction = await evaluate(`(() => {
    const current = document.querySelector('article[data-current="true"]');
    return {
      expectedTrackId: ${JSON.stringify(selectedTrack)},
      currentTrackId: current?.getAttribute('data-track-id') || null,
      currentPlayLabel: current?.querySelector('[data-player-control="play"]')?.getAttribute('aria-label') || null
    };
  })()`);

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await send("Page.reload", { ignoreCache: true });
  await wait(3500);

  const mobile = await evaluate(`(() => {
    const scene = document.querySelector('main > section');
    const active = document.querySelector('article[data-prominent="active"]');
    const activeRect = active?.getBoundingClientRect();
    const closeRect = document.querySelector('[aria-label="Close music wall"]')?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      sceneTransform: getComputedStyle(scene).transform,
      activeRect: activeRect ? { left: activeRect.left, top: activeRect.top, right: activeRect.right, bottom: activeRect.bottom, width: activeRect.width, height: activeRect.height } : null,
      activeCenterInsideViewport: activeRect ? activeRect.left + activeRect.width / 2 >= 0 && activeRect.left + activeRect.width / 2 <= innerWidth && activeRect.top + activeRect.height / 2 >= 0 && activeRect.top + activeRect.height / 2 <= innerHeight : false,
      activeInsideViewport: activeRect ? activeRect.left >= 0 && activeRect.right <= innerWidth && activeRect.top >= 0 && activeRect.bottom <= innerHeight : false,
      closeInsideViewport: closeRect ? closeRect.left >= 0 && closeRect.right <= innerWidth && closeRect.top >= 0 && closeRect.bottom <= innerHeight : false,
      sideControlsHidden: document.querySelector('[aria-label="Next view"]')?.getClientRects().length === 0,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  })()`);

  const mobileScreenshot = await screenshot("regression-mobile.png");

  mobile.beforeDragTrackId = await evaluate(`document.querySelector('article[data-prominent="active"]')?.getAttribute('data-track-id') || null`);
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 310, y: 650, id: 1, radiusX: 1, radiusY: 1, force: 1 }]
  });
  for (let index = 1; index <= 12; index += 1) {
    await send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 310 - index * 16, y: 650 - index * 7, id: 1, radiusX: 1, radiusY: 1, force: 1 }]
    });
    await wait(22);
  }
  await send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: []
  });
  await wait(1200);
  mobile.afterDragTrackId = await waitForActiveTrack();
  mobile.dragChangedView = mobile.beforeDragTrackId !== mobile.afterDragTrackId;

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }]
  });
  await send("Page.reload", { ignoreCache: true });
  await wait(2200);

  const reducedMotion = await evaluate(`(() => {
    const card = document.querySelector('.music-card-inner');
    const video = document.querySelector('video');
    return {
      preferenceMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      videoPaused: video?.paused ?? null,
      cardTransitionDuration: card ? getComputedStyle(card).transitionDuration : null,
      cardAnimationDuration: card ? getComputedStyle(card).animationDuration : null
    };
  })()`);

  await send("Emulation.clearDeviceMetricsOverride");
  await send("Emulation.setEmulatedMedia", { features: [] });
  await send("Page.reload", { ignoreCache: true });
  await wait(2200);
  await evaluate(`document.querySelector('[aria-label="Close music wall"]')?.click()`);
  await wait(500);
  const closeDestination = await evaluate(`location.href`);

  const report = {
    desktop,
    screenshots: {
      desktop: desktopScreenshot,
      mobile: mobileScreenshot
    },
    interactions: {
      beforeDrag,
      afterDrag,
      dragChangedView: beforeDrag !== afterDrag,
      beforeShift,
      afterShift,
      viewChanged: beforeShift !== afterShift,
      play: {
        ...playInteraction,
        selectedTrackBecameCurrent: playInteraction.expectedTrackId === playInteraction.currentTrackId
      },
      closeDestination,
      closeNavigatedBack: closeDestination === "about:blank"
    },
    mobile,
    reducedMotion,
    runtimeErrors: [...new Set(runtimeErrors)]
  };

  await writeFile(join(outDir, "local-regression.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  ws?.close();
  chrome.kill();
}
