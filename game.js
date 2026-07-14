(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const LANES = 5;
  const MAX_SHOTS = 4;
  const MAX_HP = 15;

  const state = {
    running: true,
    playerHp: MAX_HP,
    enemyHp: MAX_HP,
    playerLane: 2,
    enemyLane: 2,
    guarding: false,
    shots: [],
    particles: [],
    playerAnim: "neutral",
    enemyAnim: "neutral",
    playerAnimUntil: 0,
    enemyAnimUntil: 0,
    aiShotCooldown: .6,
    aiMoveCooldown: .45,
    lastTime: performance.now()
  };

  const images = {};
  let loadedImages = 0;

  ["neutral", "guard", "attack", "hit"].forEach(name => {
    const image = new Image();
    image.onload = () => loadedImages++;
    image.onerror = () => console.warn(`画像を読み込めませんでした: ${name}`);
    image.src = `assets/${name}.png`;
    images[name] = image;
  });

  const ui = {
    playerHp: document.getElementById("playerHp"),
    enemyHp: document.getElementById("enemyHp"),
    playerHpBar: document.getElementById("playerHpBar"),
    enemyHpBar: document.getElementById("enemyHpBar"),
    shotCount: document.getElementById("shotCount"),
    result: document.getElementById("result"),
    resultText: document.getElementById("resultText")
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(320, Math.round(rect.width * dpr));
    canvas.height = Math.max(240, Math.round(rect.height * dpr));
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  window.addEventListener("orientationchange", () => setTimeout(resize, 150));
  resize();

  function geo() {
    const w = canvas.width;
    const h = canvas.height;
    const top = h * .1;
    const bottom = h * .9;
    const laneHeight = (bottom - top) / LANES;
    return {
      w, h, top, bottom, laneHeight,
      leftCrystal: w * .055,
      rightCrystal: w * .945,
      playerX: w * .24,
      enemyX: w * .76
    };
  }

  function laneY(value) {
    const g = geo();
    return g.top + g.laneHeight * (value + .5);
  }

  function wrapLane(value) {
    while (value < 0) value += LANES;
    while (value >= LANES) value -= LANES;
    return value;
  }

  function circularLaneDistance(a, b) {
    const raw = Math.abs(a - b);
    return Math.min(raw, LANES - raw);
  }

  function setAnim(side, name, milliseconds) {
    state[`${side}Anim`] = name;
    state[`${side}AnimUntil`] = performance.now() + milliseconds;
  }

  function move(delta) {
    if (!state.running || state.guarding) return;
    state.playerLane = Math.max(0, Math.min(LANES - 1, state.playerLane + delta));
  }

  function fire(owner, laneStep, charged = false) {
    if (!state.running) return;

    const count = state.shots.filter(s => s.owner === owner).length;
    if (count >= MAX_SHOTS) return;

    const g = geo();
    const player = owner === "player";

    state.shots.push({
      owner,
      x: player ? g.playerX + g.w * .045 : g.enemyX - g.w * .045,
      lane: player ? state.playerLane : state.enemyLane,
      laneStep,
      speed: g.w * .48,
      power: charged ? 2 : 1,
      alive: true
    });

    setAnim(owner, "attack", 190);
    updateHud();
  }

  function guard(on) {
    if (!state.running) return;
    state.guarding = on;
    if (on) {
      state.playerAnim = "guard";
      state.playerAnimUntil = Infinity;
    } else {
      state.playerAnim = "neutral";
      state.playerAnimUntil = 0;
    }
  }

  function damageCrystal(side, damage) {
    const key = `${side}Hp`;
    state[key] = Math.max(0, state[key] - damage);
    updateHud();

    if (state[key] === 0) {
      state.running = false;
      ui.resultText.textContent = side === "enemy" ? "YOU WIN" : "YOU LOSE";
      ui.result.classList.remove("hidden");
    }
  }

  function burst(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - .5) * 300,
        vy: (Math.random() - .5) * 300,
        life: .25 + Math.random() * .3,
        size: 2 + Math.random() * 6
      });
    }
  }

  function update(dt, now) {
    if (now > state.playerAnimUntil && !state.guarding) state.playerAnim = "neutral";
    if (now > state.enemyAnimUntil) state.enemyAnim = "neutral";

    const g = geo();

    if (state.running) {
      for (const shot of state.shots) {
        const direction = shot.owner === "player" ? 1 : -1;
        shot.x += direction * shot.speed * dt;
        shot.lane = wrapLane(shot.lane + shot.laneStep * (shot.speed * dt / g.laneHeight));
      }

      for (let i = 0; i < state.shots.length; i++) {
        const a = state.shots[i];
        if (!a.alive) continue;

        for (let j = i + 1; j < state.shots.length; j++) {
          const b = state.shots[j];
          if (!b.alive || a.owner === b.owner) continue;

          if (Math.abs(a.x - b.x) < g.w * .025 && circularLaneDistance(a.lane, b.lane) < .25) {
            if (a.power === b.power) {
              a.alive = false;
              b.alive = false;
            } else if (a.power > b.power) {
              a.power -= b.power;
              b.alive = false;
            } else {
              b.power -= a.power;
              a.alive = false;
            }
            burst((a.x + b.x) / 2, laneY(a.lane));
          }
        }
      }

      for (const shot of state.shots) {
        if (!shot.alive) continue;
        const y = laneY(shot.lane);

        if (
          shot.owner === "enemy" &&
          state.guarding &&
          Math.abs(shot.x - (g.playerX + g.w * .045)) < g.w * .03 &&
          circularLaneDistance(shot.lane, state.playerLane) < .42
        ) {
          shot.alive = false;
          burst(shot.x, y, 14);
          continue;
        }

        if (
          shot.owner === "enemy" &&
          Math.abs(shot.x - g.playerX) < g.w * .028 &&
          circularLaneDistance(shot.lane, state.playerLane) < .35
        ) {
          shot.alive = false;
          setAnim("player", "hit", 420);
          burst(shot.x, y);
          continue;
        }

        if (
          shot.owner === "player" &&
          Math.abs(shot.x - g.enemyX) < g.w * .028 &&
          circularLaneDistance(shot.lane, state.enemyLane) < .35
        ) {
          shot.alive = false;
          setAnim("enemy", "hit", 420);
          burst(shot.x, y);
          continue;
        }

        if (shot.owner === "player" && shot.x >= g.rightCrystal) {
          shot.alive = false;
          damageCrystal("enemy", shot.power);
          burst(g.rightCrystal, y, 18);
        } else if (shot.owner === "enemy" && shot.x <= g.leftCrystal) {
          shot.alive = false;
          damageCrystal("player", shot.power);
          burst(g.leftCrystal, y, 18);
        }
      }

      state.shots = state.shots.filter(s => s.alive);

      state.aiMoveCooldown -= dt;
      state.aiShotCooldown -= dt;

      if (state.aiMoveCooldown <= 0) {
        state.aiMoveCooldown = .35 + Math.random() * .65;
        const target = Math.floor(Math.random() * LANES);
        state.enemyLane += Math.sign(target - state.enemyLane);
      }

      if (state.aiShotCooldown <= 0) {
        state.aiShotCooldown = .5 + Math.random() * .65;
        const directions = [-1, 0, 1];
        fire("enemy", directions[Math.floor(Math.random() * directions.length)], Math.random() < .06);
      }
    }

    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    updateHud();
  }

  function drawBackground(g) {
    const gradient = ctx.createLinearGradient(0, 0, g.w, g.h);
    gradient.addColorStop(0, "#06111f");
    gradient.addColorStop(.5, "#0a1d3a");
    gradient.addColorStop(1, "#030913");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, g.w, g.h);

    ctx.fillStyle = "rgba(55, 153, 255, .08)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % g.w;
      const y = (i * 53) % g.h;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawLanes(g) {
    for (let i = 0; i <= LANES; i++) {
      const y = g.top + g.laneHeight * i;
      ctx.beginPath();
      ctx.moveTo(g.leftCrystal, y);
      ctx.lineTo(g.rightCrystal, y);
      ctx.strokeStyle = i === 0 || i === LANES
        ? "rgba(105, 224, 255, .6)"
        : "rgba(105, 224, 255, .2)";
      ctx.lineWidth = Math.max(1, g.h / 500);
      ctx.stroke();
    }
  }

  function drawCrystal(x, y, hp, mirror) {
    const g = geo();
    const width = Math.max(22, g.w * .045);
    const height = g.bottom - g.top;

    ctx.save();
    ctx.translate(x, y);
    if (mirror) ctx.scale(-1, 1);

    ctx.shadowColor = "#1aa8ff";
    ctx.shadowBlur = Math.max(12, g.w * .018);

    const gradient = ctx.createLinearGradient(-width, 0, width, 0);
    gradient.addColorStop(0, "#0757b6");
    gradient.addColorStop(.45, "#d8fbff");
    gradient.addColorStop(1, "#087ee0");
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(-width * .55, 0);
    ctx.lineTo(-width * .1, -height * .48);
    ctx.lineTo(width * .48, -height * .31);
    ctx.lineTo(width * .58, 0);
    ctx.lineTo(width * .48, height * .31);
    ctx.lineTo(-width * .1, height * .48);
    ctx.closePath();
    ctx.fill();

    const crackCount = Math.floor((MAX_HP - hp) / 3);
    ctx.strokeStyle = "rgba(255,255,255,.86)";
    ctx.lineWidth = Math.max(1.5, g.w * .0015);
    for (let i = 0; i < crackCount; i++) {
      ctx.beginPath();
      ctx.moveTo(-width * .05, -height * .12 + i * height * .055);
      ctx.lineTo(width * (.22 + i * .04), height * (.02 + i * .04));
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFallbackCharacter(x, y, mirror) {
    const g = geo();
    const size = g.laneHeight * .38;
    ctx.save();
    ctx.translate(x, y);
    if (mirror) ctx.scale(-1, 1);
    ctx.fillStyle = "#151c2b";
    ctx.strokeStyle = "#218cff";
    ctx.lineWidth = Math.max(2, size * .08);
    ctx.beginPath();
    ctx.arc(0, -size * .35, size * .34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-size * .28, 0, size * .56, size * .65);
    ctx.restore();
  }

  function drawCharacter(side, x, y, mirror) {
    const g = geo();
    const name = state[`${side}Anim`];
    const image = images[name];

    const targetHeight = Math.min(g.laneHeight * 1.22, g.h * .24);
    const ratio = image && image.naturalWidth ? image.naturalWidth / image.naturalHeight : 1;
    const targetWidth = targetHeight * ratio;

    if (image && image.complete && image.naturalWidth > 0) {
      ctx.save();
      ctx.translate(x, y);
      if (mirror) ctx.scale(-1, 1);
      ctx.drawImage(image, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
      ctx.restore();
    } else {
      drawFallbackCharacter(x, y, mirror);
    }

    if (side === "player" && state.guarding) {
      ctx.save();
      ctx.strokeStyle = "#aff4ff";
      ctx.lineWidth = Math.max(3, g.w * .003);
      ctx.shadowColor = "#4dcbff";
      ctx.shadowBlur = Math.max(12, g.w * .016);
      ctx.beginPath();
      ctx.ellipse(
        x + g.w * .035,
        y,
        g.w * .032,
        g.laneHeight * .43,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawShots(g) {
    for (const shot of state.shots) {
      const y = laneY(shot.lane);
      const radius = shot.power > 1 ? g.laneHeight * .12 : g.laneHeight * .075;

      ctx.save();
      ctx.shadowColor = "#5edcff";
      ctx.shadowBlur = radius * 2;
      ctx.fillStyle = shot.power > 1 ? "#efffff" : "#48cbff";
      ctx.beginPath();
      ctx.arc(shot.x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    ctx.fillStyle = "#9cecff";
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 3);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const g = geo();
    drawBackground(g);
    drawLanes(g);
    drawCrystal(g.leftCrystal, (g.top + g.bottom) / 2, state.playerHp, false);
    drawCrystal(g.rightCrystal, (g.top + g.bottom) / 2, state.enemyHp, true);
    drawCharacter("player", g.playerX, laneY(state.playerLane), false);
    drawCharacter("enemy", g.enemyX, laneY(state.enemyLane), true);
    drawShots(g);
    drawParticles();
  }

  function updateHud() {
    ui.playerHp.textContent = state.playerHp;
    ui.enemyHp.textContent = state.enemyHp;
    ui.playerHpBar.style.width = `${(state.playerHp / MAX_HP) * 100}%`;
    ui.enemyHpBar.style.width = `${(state.enemyHp / MAX_HP) * 100}%`;
    ui.shotCount.textContent = state.shots.filter(s => s.owner === "player").length;
  }

  function frame(now) {
    const dt = Math.min(.035, (now - state.lastTime) / 1000);
    state.lastTime = now;
    update(dt, now);
    draw();
    requestAnimationFrame(frame);
  }

  function pressEffect(button, on) {
    button.classList.toggle("active", on);
  }

  function bindTap(id, action) {
    const button = document.getElementById(id);
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      pressEffect(button, true);
      action();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(type => {
      button.addEventListener(type, event => {
        event.preventDefault();
        pressEffect(button, false);
      });
    });
  }

  bindTap("upBtn", () => move(-1));
  bindTap("downBtn", () => move(1));

  const guardButton = document.getElementById("guardBtn");
  guardButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    pressEffect(guardButton, true);
    guard(true);
    guardButton.setPointerCapture?.(event.pointerId);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => {
    guardButton.addEventListener(type, event => {
      event.preventDefault();
      pressEffect(guardButton, false);
      guard(false);
    });
  });

  document.querySelectorAll("[data-shot]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      pressEffect(button, true);
      fire("player", Number(button.dataset.shot));
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(type => {
      button.addEventListener(type, event => {
        event.preventDefault();
        pressEffect(button, false);
      });
    });
  });

  document.getElementById("restart").addEventListener("click", () => location.reload());

  document.addEventListener("contextmenu", event => event.preventDefault());
  updateHud();
  requestAnimationFrame(frame);
})();
