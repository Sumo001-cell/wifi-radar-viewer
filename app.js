const canvas = document.querySelector("#radarCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const radarTitle = document.querySelector("#radarTitle");
const modeChip = document.querySelector("#modeChip");
const connectButton = document.querySelector("#connectButton");
const testButton = document.querySelector("#testButton");
const bridgeState = document.querySelector("#bridgeState");
const bridgeVerdict = document.querySelector("#bridgeVerdict");
const sourceTitle = document.querySelector("#sourceTitle");
const sourceStrong = document.querySelector("#sourceStrong");
const sourceDetail = document.querySelector("#sourceDetail");
const openBridgeLink = document.querySelector("#openBridgeLink");

const state = {
  running: false,
  testMode: false,
  sweep: 0,
  blips: [],
  score: 0,
  eventSource: null,
  pollTimer: null,
  bridgeBase: null,
  lastPayloadAt: 0,
  lastBridgeError: ""
};

function fitCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(bounds.width * ratio));
  const height = Math.max(1, Math.floor(bounds.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  return { width: bounds.width, height: bounds.height };
}

function point(centerX, centerY, radius, angle, ratio) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: centerX + Math.cos(radians) * radius * ratio,
    y: centerY + Math.sin(radians) * radius * ratio
  };
}

function addTestBlips() {
  if (!state.testMode) return;
  const now = performance.now();
  const wave = Math.sin(now / 900) * 0.5 + 0.5;
  state.score = Math.round(20 + wave * 72);
  scoreEl.textContent = state.score;
  radarTitle.textContent = "Test màn hình radar";
  modeChip.textContent = "Screen test";

  if (Math.random() > 0.82) {
    state.blips.push({
      createdAt: now,
      angle: (now / 18 + Math.random() * 70) % 360,
      distance: 0.18 + Math.random() * 0.72,
      radius: 8 + Math.random() * 10,
      color: state.score > 70 ? "#ffcd5b" : "#65d8ff"
    });
    state.blips = state.blips.slice(-36);
  }
}

function draw() {
  const { width, height } = fitCanvas();
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.46;
  const now = performance.now();

  addTestBlips();
  ctx.clearRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.05, centerX, centerY, radius);
  glow.addColorStop(0, "rgba(77, 255, 154, 0.12)");
  glow.addColorStop(0.62, "rgba(77, 255, 154, 0.035)");
  glow.addColorStop(1, "rgba(77, 255, 154, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(214, 255, 236, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, (radius / 4) * i, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.stroke();
  }

  const sweepGradient = ctx.createConicGradient((state.sweep * Math.PI) / 180, centerX, centerY);
  sweepGradient.addColorStop(0, "rgba(77, 255, 154, 0)");
  sweepGradient.addColorStop(0.035, "rgba(77, 255, 154, 0.34)");
  sweepGradient.addColorStop(0.085, "rgba(77, 255, 154, 0)");
  sweepGradient.addColorStop(1, "rgba(77, 255, 154, 0)");
  ctx.fillStyle = sweepGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  state.blips = state.blips.filter((blip) => now - blip.createdAt < 7000);
  for (const blip of state.blips) {
    const age = (now - blip.createdAt) / 7000;
    const p = point(centerX, centerY, radius, blip.angle, blip.distance);
    const alpha = Math.max(0, 1 - age);
    ctx.fillStyle = blip.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(4, blip.radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = state.score > 70 ? "#ffcd5b" : "#4dff9a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  state.sweep = (state.sweep + 1.2) % 360;
  requestAnimationFrame(draw);
}

function addMeasurementBlip(measurement) {
  if (!measurement) return;
  const now = performance.now();
  const score = Number(measurement.motionScore) || 0;
  state.score = score;
  scoreEl.textContent = score;
  state.blips.push({
    createdAt: now,
    angle: (now / 16 + score * 3) % 360,
    distance: 0.18 + Math.min(0.76, score / 120),
    radius: score > 70 ? 18 : 10,
    color: score > 70 ? "#ffcd5b" : "#65d8ff"
  });
  state.blips = state.blips.slice(-40);
}

function renderBridgePayload(payload) {
  state.lastPayloadAt = Date.now();
  state.testMode = false;
  bridgeState.textContent = "Bridge đã kết nối";

  if (payload.hasRealData && payload.measurement) {
    bridgeVerdict.textContent = "Đang nhận dữ liệu đo thật";
    radarTitle.textContent = "Đang hiển thị dữ liệu radar";
    modeChip.textContent = payload.measurement.sourceRole === "modem"
      ? "Modem data"
      : "Bridge data";
    sourceTitle.textContent = "Nguồn đo đang hoạt động";
    sourceStrong.textContent = payload.measurement.source;
    sourceDetail.textContent = payload.measurement.detail || payload.viewerMessage;
    addMeasurementBlip(payload.measurement);
    return;
  }

  bridgeVerdict.textContent = "Bridge chạy nhưng thiếu dữ liệu đo";
  radarTitle.textContent = "Chưa có dữ liệu radar thật";
  modeChip.textContent = payload.source || "No source";
  scoreEl.textContent = "0";
  sourceTitle.textContent = "Modem chưa gửi dữ liệu đo";
  sourceStrong.textContent = payload.router?.gateway
    ? `Modem ${payload.router.vendor || ""} ${payload.router.gateway}`.trim()
    : "Chưa thấy modem";
  sourceDetail.textContent = payload.error || payload.viewerMessage;
}

function normalizeBridgeBase(value) {
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

function getBridgeCandidates() {
  const params = new URLSearchParams(window.location.search);
  const candidates = [
    window.location.hostname === "sumo001-cell.github.io" ? null : window.location.origin,
    normalizeBridgeBase(params.get("bridge")),
    "http://127.0.0.1:8791",
    "http://localhost:8791"
  ].filter(Boolean);

  return [...new Set(candidates)];
}

function setOpenBridgeLink(base) {
  if (!openBridgeLink || !base) return;
  openBridgeLink.href = `${base}/viewer`;
}

function bridgeUrl(path) {
  return `${state.bridgeBase}${path}`;
}

function requestJson(url) {
  if (typeof fetch === "function") {
    return fetch(url, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`Bridge HTTP ${response.status}`);
      return response.json();
    });
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.timeout = 3500;
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Bridge HTTP ${request.status}`));
        return;
      }
      try {
        resolve(JSON.parse(request.responseText));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(new Error("Bridge network blocked"));
    request.ontimeout = () => reject(new Error("Bridge timeout"));
    request.send();
  });
}

function payloadFromStatus(status) {
  if (status?.lastPayload) return status.lastPayload;
  return {
    source: "none",
    hasRealData: false,
    router: status?.router || null,
    measurement: null,
    error: status?.router?.detail || "Bridge chạy nhưng chưa gửi payload đo.",
    viewerMessage: "Bridge đang chạy nhưng chưa có nguồn đo radar thật."
  };
}

function showBridgeUnavailable(message) {
  bridgeState.textContent = "Không nối được bridge";
  bridgeVerdict.textContent = "Chưa có dữ liệu đo thật";
  radarTitle.textContent = "Bridge local chưa kết nối";
  modeChip.textContent = "No bridge";
  scoreEl.textContent = "0";
  sourceTitle.textContent = "Viewer đang chờ tool đo";
  sourceStrong.textContent = "GitHub link chỉ là màn hình xem.";
  sourceDetail.textContent = message;
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    try {
      const status = await requestJson(bridgeUrl("/api/status"));
      renderBridgePayload(payloadFromStatus(status));
    } catch (error) {
      state.lastBridgeError = error.message;
      if (Date.now() - state.lastPayloadAt > 5000) {
        showBridgeUnavailable(`Không đọc được ${state.bridgeBase}. ${error.message}`);
      }
    }
  }, 1200);
}

function startEventStream() {
  if (state.eventSource) state.eventSource.close();
  if (typeof EventSource !== "function") {
    startPolling();
    return;
  }

  try {
    state.eventSource = new EventSource(bridgeUrl("/api/events"));
    state.eventSource.onmessage = (event) => {
      renderBridgePayload(JSON.parse(event.data));
    };
    state.eventSource.onerror = () => {
      startPolling();
    };
  } catch {
    startPolling();
  }
}

async function connectBridge() {
  if (state.eventSource) state.eventSource.close();
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.eventSource = null;
  state.pollTimer = null;
  state.lastPayloadAt = 0;
  bridgeState.textContent = "Đang kết nối bridge";
  bridgeVerdict.textContent = "Chờ dữ liệu từ local tool";

  const errors = [];
  const candidates = getBridgeCandidates();
  setOpenBridgeLink(candidates[0]);
  for (const candidate of candidates) {
    state.bridgeBase = candidate;
    setOpenBridgeLink(candidate);
    try {
      const status = await requestJson(bridgeUrl("/api/status"));
      renderBridgePayload(payloadFromStatus(status));
      startEventStream();
      return;
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }

  showBridgeUnavailable(
    `Tool WiFi Radar Bridge chưa truy cập được từ trang này. Đã thử: ${errors.join(" | ")}`
  );
}

connectButton.addEventListener("click", connectBridge);

testButton.addEventListener("click", () => {
  state.testMode = true;
  bridgeState.textContent = "Đang test màn hình";
  bridgeVerdict.textContent = "Không phải dữ liệu đo thật";
});

draw();
connectBridge();
