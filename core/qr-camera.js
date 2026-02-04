import { SCANNER_CONFIG } from "./config.js";

function getJsQr() {
  const fn = globalThis.jsQR;
  if (typeof fn !== "function") throw new Error("jsQR is not loaded.");
  return fn;
}

function pickEnvironmentCamera(cameras) {
  const preferred = cameras.find((d) => /back|rear|environment/i.test(d.label ?? ""));
  return preferred?.deviceId ? { deviceId: { exact: preferred.deviceId } } : { facingMode: { ideal: "environment" } };
}

// Use debounce from config (default 2000ms)
const DEFAULT_DEBOUNCE_MS = SCANNER_CONFIG.DEBOUNCE_MS || 2000;

export async function initCameraScanner({ videoEl, onCode, onState, debounceMs = DEFAULT_DEBOUNCE_MS } = {}) {
  if (!videoEl) throw new Error("videoEl is required.");
  if (typeof onCode !== "function") throw new Error("onCode is required.");

  const jsQR = getJsQr();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not supported.");

  let stream = null;
  let rafId = 0;
  let stopped = false;
  let lastCode = "";
  let lastAt = 0;

  const setState = (patch) => {
    if (typeof onState === "function") onState(patch);
  };

  async function start() {
    setState({ status: "requesting_camera" });

    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const cameras = devices.filter((d) => d.kind === "videoinput");

    const constraints = {
      audio: false,
      video: cameras.length ? pickEnvironmentCamera(cameras) : { facingMode: { ideal: "environment" } },
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    videoEl.setAttribute("playsinline", "true");
    await videoEl.play();
    setState({ status: "scanning" });
  }

  function stop() {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }

    if (videoEl.srcObject) videoEl.srcObject = null;
    setState({ status: "stopped" });
  }

  function tick() {
    if (stopped) return;
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(videoEl, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
    if (result?.data) {
      const now = Date.now();
      const data = String(result.data).trim();
      const isRepeat = data === lastCode && now - lastAt < debounceMs;
      if (!isRepeat) {
        lastCode = data;
        lastAt = now;
        onCode({ data });
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  await start();
  rafId = requestAnimationFrame(tick);

  return { stop };
}

