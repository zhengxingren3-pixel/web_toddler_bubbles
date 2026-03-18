(() => {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const soundToggle = document.getElementById("soundToggle");
  const vibeToggle = document.getElementById("vibeToggle");
  const btnMore = document.getElementById("btnMore");
  const btnClear = document.getElementById("btnClear");

  const modal = document.getElementById("mediaModal");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnCloseModal2 = document.getElementById("btnCloseModal2");
  const btnNextMedia = document.getElementById("btnNextMedia");
  const modalTitle = document.getElementById("modalTitle");
  const modalImg = document.getElementById("modalImg");
  const modalVideo = document.getElementById("modalVideo");
  const modalNote = document.getElementById("modalNote");

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  function fixDpi() {
    const logicalW = parseInt(canvas.getAttribute("width"), 10);
    const logicalH = parseInt(canvas.getAttribute("height"), 10);
    canvas.width = Math.floor(logicalW * DPR);
    canvas.height = Math.floor(logicalH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  fixDpi();
  window.addEventListener("resize", () => ctx.setTransform(DPR, 0, 0, DPR, 0, 0));

  const cfg = {
    bubbleMinR: 34,
    bubbleMaxR: 68,
    initialCount: 12,
    maxCount: 26,
  };

  const colors = ["#60a5fa", "#22c55e", "#f97316", "#a78bfa", "#f43f5e", "#eab308", "#38bdf8"];

  // 把你的照片/视频放到 web_toddler_bubbles/assets/，然后在这里填文件名即可。
  // 图片支持：jpg/png/webp；视频建议：mp4（最好短一点，且无声或可静音）
  const mediaList = [
    { type: "image", src: "./assets/p01.jpg", title: "照片 1" },
    { type: "image", src: "./assets/p02.jpg", title: "照片 2" },
    { type: "image", src: "./assets/p03.jpg", title: "照片 3" },
    { type: "image", src: "./assets/p04.jpg", title: "照片 4" },
    { type: "image", src: "./assets/p05.jpg", title: "照片 5" },
    { type: "image", src: "./assets/p06.jpg", title: "照片 6" },
    { type: "image", src: "./assets/p07.jpg", title: "照片 7" },
    { type: "image", src: "./assets/p08.jpg", title: "照片 8" },
    { type: "image", src: "./assets/p09.jpg", title: "照片 9" },
    { type: "image", src: "./assets/p10.jpg", title: "照片 10" },
    { type: "image", src: "./assets/p11.jpg", title: "照片 11" },
    { type: "image", src: "./assets/p12.jpg", title: "照片 12" },
    { type: "image", src: "./assets/p13.jpg", title: "照片 13" },
  ];

  const state = {
    bubbles: [], // {x,y,r,color,phase}
    sparkles: [], // {x,y,ttl,rot,color}
    rings: [], // {x,y,r0,ttl,color}
    pops: [], // {x,y,r,color,phase,ttl,shards[]}
    flash: 0, // 命中反馈闪光帧数
    audio: null,
    lastMediaIdx: -1,
  };

  function ensureAudio() {
    if (state.audio) return state.audio;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    state.audio = ac;
    return ac;
  }

  function beep() {
    if (!soundToggle.checked) return;
    const ac = ensureAudio();
    // iOS/Android 需要用户手势后才能发声，点击泡泡属于手势
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.value = 520 + Math.random() * 220;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ac.destination);
    const t0 = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.start(t0);
    o.stop(t0 + 0.2);
  }

  function vibe() {
    if (!vibeToggle.checked) return;
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function showModal() {
    modal.classList.remove("hidden");
  }
  function hideModal() {
    // 停止视频
    try {
      modalVideo.pause();
    } catch {}
    modalVideo.removeAttribute("src");
    modalVideo.load();

    modalImg.removeAttribute("src");
    modal.classList.add("hidden");
  }

  function pickMedia() {
    if (!mediaList.length) return null;
    if (mediaList.length === 1) return mediaList[0];

    let idx = Math.floor(Math.random() * mediaList.length);
    if (idx === state.lastMediaIdx) idx = (idx + 1) % mediaList.length;
    state.lastMediaIdx = idx;
    return mediaList[idx];
  }

  async function loadAndShowMedia(forcePick = false) {
    modalNote.classList.add("hidden");
    modalImg.classList.add("hidden");
    modalVideo.classList.add("hidden");

    const item = forcePick ? pickMedia() : pickMedia();
    if (!item) {
      modalTitle.textContent = "没有素材";
      modalNote.textContent = "请把照片/视频放到 web_toddler_bubbles/assets/，并在 game.js 的 mediaList 里填入文件名。";
      modalNote.classList.remove("hidden");
      showModal();
      return;
    }

    modalTitle.textContent = item.title || "惊喜！";
    showModal();

    if (item.type === "image") {
      modalImg.src = item.src;
      modalImg.onload = () => {};
      modalImg.onerror = () => {
        modalImg.classList.add("hidden");
        modalTitle.textContent = "图片找不到";
        modalNote.textContent =
          `没找到：${item.src}\n\n把文件放到 web_toddler_bubbles/assets/，并确保文件名与 mediaList 一致。`;
        modalNote.classList.remove("hidden");
      };
      modalImg.classList.remove("hidden");
      return;
    }

    if (item.type === "video") {
      modalVideo.src = item.src;
      modalVideo.onloadeddata = async () => {
        try {
          // 移动端自动播放限制：需要静音 + 用户手势（点泡泡属于手势）
          modalVideo.muted = true;
          await modalVideo.play();
        } catch {
          // 不能自动播也没关系，保留 controls 让用户点播放
        }
      };
      modalVideo.onerror = () => {
        modalVideo.classList.add("hidden");
        modalTitle.textContent = "视频找不到";
        modalNote.textContent =
          `没找到：${item.src}\n\n把文件放到 web_toddler_bubbles/assets/，并确保文件名与 mediaList 一致。`;
        modalNote.classList.remove("hidden");
      };
      modalVideo.classList.remove("hidden");
      return;
    }
  }

  function rand(a, b) {
    return Math.random() * (b - a) + a;
  }
  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }

  function logicalSize() {
    return {
      w: parseInt(canvas.getAttribute("width"), 10),
      h: parseInt(canvas.getAttribute("height"), 10),
    };
  }

  function addBubble() {
    const { w, h } = logicalSize();
    const r = randInt(cfg.bubbleMinR, cfg.bubbleMaxR);
    const x = randInt(r + 14, w - r - 14);
    const y = randInt(r + 14, h - r - 14);
    const color = colors[randInt(0, colors.length - 1)];
    state.bubbles.push({ x, y, r, color, phase: rand(0, Math.PI * 2) });
  }

  function seed(count) {
    state.bubbles = [];
    state.sparkles = [];
    for (let i = 0; i < count; i++) addBubble();
  }

  function drawBackground() {
    const { w, h } = logicalSize();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(17,24,39,1)");
    g.addColorStop(1, "rgba(2,6,23,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 大色块光斑
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 6; i++) {
      const x = (i * 160 + performance.now() * 0.02) % (w + 240) - 120;
      const y = 90 + (i % 3) * 70;
      const r = 90 + (i % 2) * 40;
      const gg = ctx.createRadialGradient(x, y, 10, x, y, r);
      gg.addColorStop(0, "rgba(96,165,250,.9)");
      gg.addColorStop(1, "rgba(96,165,250,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBubble(b) {
    ctx.save();
    const pulse = 1 + Math.sin(performance.now() * 0.003 + b.phase) * 0.03;
    const r = b.r * pulse;

    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.35, r * 0.2, b.x, b.y, r);
    g.addColorStop(0, "rgba(255,255,255,.65)");
    g.addColorStop(0.18, b.color);
    g.addColorStop(1, "rgba(0,0,0,.25)");

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.stroke();

    // 高光
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.arc(b.x - r * 0.35, b.y - r * 0.35, Math.max(7, r * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStar(x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(250,204,21,.35)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function addSparkles(x, y) {
    for (let i = 0; i < 8; i++) {
      state.sparkles.push({
        x: x + rand(-18, 18),
        y: y + rand(-18, 18),
        ttl: randInt(18, 30),
        rot: rand(0, Math.PI * 2),
        color: "rgba(250,204,21,.98)",
      });
    }
  }

  function addRing(x, y, r0, color) {
    state.rings.push({
      x,
      y,
      r0,
      ttl: 18,
      color: color || "rgba(255,255,255,.9)",
    });
  }

  function addPop(b) {
    const shards = [];
    const n = randInt(10, 16);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(2.2, 6.2) * (b.r / 60);
      shards.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(0.4, 1.2),
        r: rand(1.6, 3.4) * (b.r / 60),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.22, 0.22),
      });
    }
    state.pops.push({
      x: b.x,
      y: b.y,
      r: b.r,
      color: b.color,
      phase: b.phase,
      ttl: 16,
      shards,
    });
  }

  function drawPops() {
    for (const p of state.pops) {
      const t = 1 - Math.max(0, Math.min(1, p.ttl / 16)); // 0 -> 1
      const a = (1 - t) * 0.95;

      // 泡泡“破裂前一瞬”的收缩残影
      ctx.save();
      ctx.globalAlpha = a;
      const pulse = 1 + Math.sin(performance.now() * 0.003 + p.phase) * 0.03;
      const r = p.r * pulse * (1 - t * 0.55);
      const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.2, p.x, p.y, r);
      g.addColorStop(0, "rgba(255,255,255,.65)");
      g.addColorStop(0.18, p.color);
      g.addColorStop(1, "rgba(0,0,0,.25)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 碎片/泡沫
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = "rgba(255,255,255,.25)";
      ctx.shadowBlur = 10;
      for (const s of p.shards) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.12; // 轻微重力
        s.rot += s.vr;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.beginPath();
        ctx.ellipse(0, 0, s.r * 1.6, s.r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      p.ttl -= 1;
    }
    state.pops = state.pops.filter((p) => p.ttl > 0);
  }

  function drawRings() {
    for (const rg of state.rings) {
      const t = 1 - Math.max(0, Math.min(1, rg.ttl / 18));
      const r = rg.r0 * (0.65 + t * 1.25);
      const a = (1 - t) * 0.9;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 4 + (1 - a) * 3;
      ctx.shadowColor = "rgba(255,255,255,.35)";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      rg.ttl -= 1;
    }
    state.rings = state.rings.filter((rg) => rg.ttl > 0);
  }

  function drawSparkles() {
    for (const s of state.sparkles) {
      const a = Math.max(0, Math.min(1, s.ttl / 30));
      drawStar(s.x, s.y, 8 + (1 - a) * 8, `rgba(250,204,21,${a})`, s.rot + performance.now() * 0.002);
      s.y -= 0.8;
      s.ttl -= 1;
    }
    state.sparkles = state.sparkles.filter((s) => s.ttl > 0);
  }

  function drawTitleHint() {
    const { w, h } = logicalSize();
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(249,250,251,.95)";
    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("点泡泡！", w / 2, 46);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = "rgba(229,231,235,.85)";
    ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("点得越多越开心（没有输赢）", w / 2, 76);
    ctx.restore();
  }

  function render() {
    drawBackground();
    drawTitleHint();
    drawPops();
    for (const b of state.bubbles) drawBubble(b);
    drawRings();
    drawSparkles();

    if (state.flash > 0) {
      const { w, h } = logicalSize();
      const a = (state.flash / 8) * 0.18; // 轻微闪光
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      state.flash -= 1;
    }

    requestAnimationFrame(render);
  }
  render();

  function pointerPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const { w, h } = logicalSize();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const x = ((clientX - rect.left) / rect.width) * w;
    const y = ((clientY - rect.top) / rect.height) * h;
    return { x, y };
  }

  function popAt(x, y) {
    // 找最近的泡泡（大泡泡更容易点到）
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < state.bubbles.length; i++) {
      const b = state.bubbles[i];
      // 绘制时泡泡有“呼吸”脉动，命中检测也要用同样的半径，否则会出现
      // 视觉上点到边缘但判定没点中，从而走到“弹星星”的空白反馈分支。
      const pulse = 1 + Math.sin(performance.now() * 0.003 + b.phase) * 0.03;
      const r = b.r * pulse;
      const dx = x - b.x;
      const dy = y - b.y;
      const d = dx * dx + dy * dy;
      const rr = r * r;
      if (d <= rr && d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const b = state.bubbles[bestIdx];
      state.bubbles.splice(bestIdx, 1);
      addPop(b);
      addSparkles(b.x, b.y);
      addRing(b.x, b.y, b.r, "rgba(255,255,255,.95)");
      state.flash = 8;
      beep();
      vibe();
      // 先给孩子看到“破裂”，再弹出图片
      setTimeout(() => loadAndShowMedia(), 140);
      // 保持画面上泡泡数量
      if (state.bubbles.length < cfg.maxCount) addBubble();
    } else {
      // 点到空白：不做任何反馈
    }
  }

  // 统一使用 Pointer Events：在移动端/触屏上比 click/touchstart 更稳定
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      // 防止浏览器把轻微手势当成滚动/缩放，从而丢掉点击
      e.preventDefault();
      const p = pointerPos(e);
      popAt(p.x, p.y);
    },
    { passive: false }
  );

  btnMore.addEventListener("click", () => {
    for (let i = 0; i < 6; i++) {
      if (state.bubbles.length >= cfg.maxCount) break;
      addBubble();
    }
    beep();
    vibe();
  });
  btnClear.addEventListener("click", () => {
    state.bubbles = [];
    state.sparkles = [];
    // 清空后再补一点点泡泡
    for (let i = 0; i < 6; i++) addBubble();
    beep();
    vibe();
  });

  modalBackdrop.addEventListener("click", hideModal);
  btnCloseModal.addEventListener("click", hideModal);
  btnCloseModal2.addEventListener("click", hideModal);
  btnNextMedia.addEventListener("click", () => loadAndShowMedia(true));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });

  // init
  seed(cfg.initialCount);
})();

