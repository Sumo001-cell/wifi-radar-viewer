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

const state = {
  running: false,
  testMode: false,
  sweep: 0,
  blips: [],
  score: 0,
  eventSource: null,
  lastPayloadAt: 0
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

function connectBridge() {
  if (state.eventSource) state.eventSource.close();
  bridgeState.textContent = "Đang kết nối bridge";
  bridgeVerdict.textContent = "Chờ dữ liệu từ local tool";
  state.eventSource = new EventSource("http://127.0.0.1:8791/api/events");
  state.eventSource.onmessage = (event) => {
    renderBridgePayload(JSON.parse(event.data));
  };
  state.eventSource.onerror = () => {
    if (Date.now() - state.lastPayloadAt > 4000) {
      bridgeState.textContent = "Bridge chưa chạy";
      bridgeVerdict.textContent = "Chưa có dữ liệu đo thật";
      radarTitle.textContent = "Hãy chạy WiFi Radar Bridge";
      modeChip.textContent = "No bridge";
      sourceTitle.textContent = "Chưa kết nối bridge";
      sourceStrong.textContent = "Viewer chỉ là màn hình xem.";
      sourceDetail.textContent = "Cần chạy tool WiFi Radar Bridge để lấy dữ liệu từ modem/CSI/local sensor.";
    }
  };
}

connectButton.addEventListener("click", connectBridge);

testButton.addEventListener("click", () => {
  state.testMode = true;
  bridgeState.textContent = "Đang test màn hình";
  bridgeVerdict.textContent = "Không phải dữ liệu đo thật";
});

draw();
connectBridge();
