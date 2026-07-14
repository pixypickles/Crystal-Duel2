const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const LANE_COUNT = 5;
const MAX_SHOTS = 4;
const CRYSTAL_HP = 15;

const assets = {};
for (const name of ["neutral", "guard", "attack", "hit"]) {
  const img = new Image();
  img.src = `./assets/${name}.png`;
  assets[name] = img;
}

const state = {
  running: true,
  playerHp: CRYSTAL_HP,
  enemyHp: CRYSTAL_HP,
  playerLane: 2,
  enemyLane: 2,
  guarding: false,
  playerAnim: "neutral",
  playerAnimUntil: 0,
  enemyAnim: "neutral",
  enemyAnimUntil: 0,
  shots: [],
  particles: [],
  lastTime: performance.now(),
  aiTimer: 0,
  aiMoveTimer: 0,
};

const ui = {
  playerHp: document.getElementById("playerHp"),
  enemyHp: document.getElementById("enemyHp"),
  playerHpBar: document.getElementById("playerHpBar"),
  enemyHpBar: document.getElementById("enemyHpBar"),
  shotCount: document.getElementById("shotCount"),
  message: document.getElementById("message"),
  messageTitle: document.getElementById("messageTitle"),
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function geometry() {
  const w = canvas.width;
  const h = canvas.height;
  const top = h * 0.14;
  const bottom = h * 0.86;
  const laneH = (bottom - top) / LANE_COUNT;
  return {
    w, h, top, bottom, laneH,
    leftCrystalX: w * 0.07,
    rightCrystalX: w * 0.93,
    playerX: w * 0.22,
    enemyX: w * 0.78,
  };
}

function laneY(lane) {
  const g = geometry();
  return g.top + g.laneH * (lane + 0.5);
}

function setAnimation(side, anim, duration = 220) {
  state[`${side}Anim`] = anim;
  state[`${side}AnimUntil`] = performance.now() + duration;
}

function movePlayer(delta) {
  if (!state.running || state.guarding) return;
  state.playerLane = Math.max(0, Math.min(LANE_COUNT - 1, state.playerLane + delta));
}

function shoot(owner, laneDelta, charged = false) {
  if (!state.running) return;
  const active = state.shots.filter(s => s.owner === owner).length;
  if (active >= MAX_SHOTS) return;

  const g = geometry();
  const isPlayer = owner === "player";
  const lane = isPlayer ? state.playerLane : state.enemyLane;
  const x = isPlayer ? g.playerX + g.w * 0.045 : g.enemyX - g.w * 0.045;

  state.shots.push({
    owner,
    x,
    laneFloat: lane,
    laneDelta,
    speed: g.w * 0.42,
    damage: charged ? 2 : 1,
    charged,
    alive: true,
  });

  setAnimation(owner, "attack", 180);
  updateHud();
}

function setGuard(on) {
  state.guarding = on;
  if (on) setAnimation("player", "guard", 999999);
  else setAnimation("player", "neutral", 0);
}

function update(dt, now) {
  if (!state.running) return;

  if (!state.guarding && now > state.playerAnimUntil) state.playerAnim = "neutral";
  if (now > state.enemyAnimUntil) state.enemyAnim = "neutral";

  const g = geometry();

  for (const shot of state.shots) {
    const dir = shot.owner === "player" ? 1 : -1;
    shot.x += dir * shot.speed * dt;
    shot.laneFloat += shot.laneDelta * (shot.speed * dt / g.laneH);

    while (shot.laneFloat < 0) shot.laneFloat += LANE_COUNT;
    while (shot.laneFloat >= LANE_COUNT) shot.laneFloat -= LANE_COUNT;
  }

  // Bullet collisions
  for (let i = 0; i < state.shots.length; i++) {
    const a = state.shots[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < state.shots.length; j++) {
      const b = state.shots[j];
      if (!b.alive || a.owner === b.owner) continue;
      const sameLane = Math.abs(a.laneFloat - b.laneFloat) < 0.28 ||
        Math.abs(a.laneFloat - b.laneFloat) > LANE_COUNT - 0.28;
      if (sameLane && Math.abs(a.x - b.x) < g.w * 0.025) {
        if (a.damage === b.damage) {
          a.alive = b.alive = false;
        } else if (a.damage > b.damage) {
          a.damage -= b.damage;
          a.charged = a.damage > 1;
          b.alive = false;
        } else {
          b.damage -= a.damage;
          b.charged = b.damage > 1;
          a.alive = false;
        }
        burst((a.x + b.x) / 2, laneY(a.laneFloat), 10);
      }
    }
  }

  for (const shot of state.shots) {
    if (!shot.alive) continue;
    const y = laneY(shot.laneFloat);

    if (shot.owner === "enemy" && state.guarding &&
        shot.x < g.playerX + g.w * .055 &&
        shot.x > g.playerX - g.w * .015 &&
        Math.abs(shot.laneFloat - state.playerLane) < .45) {
      shot.alive = false;
      burst(shot.x, y, 12);
      continue;
    }

    // Character hit: no damage, brief animation
    if (shot.owner === "enemy" &&
        Math.abs(shot.x - g.playerX) < g.w * .028 &&
        Math.abs(shot.laneFloat - state.playerLane) < .38) {
      shot.alive = false;
      setAnimation("player", "hit", 420);
      burst(shot.x, y, 10);
      continue;
    }

    if (shot.owner === "player" &&
        Math.abs(shot.x - g.enemyX) < g.w * .028 &&
        Math.abs(shot.laneFloat - state.enemyLane) < .38) {
      shot.alive = false;
      setAnimation("enemy", "hit", 420);
      burst(shot.x, y, 10);
      continue;
    }

    if (shot.owner === "player" && shot.x >= g.rightCrystalX) {
      shot.alive = false;
      damageCrystal("enemy", shot.damage);
      burst(g.rightCrystalX, y, 16);
    } else if (shot.owner === "enemy" && shot.x <= g.leftCrystalX) {
      shot.alive = false;
      damageCrystal("player", shot.damage);
      burst(g.leftCrystalX, y, 16);
    }
  }

  state.shots = state.shots.filter(s => s.alive);

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter(p => p.life > 0);

  state.aiTimer -= dt;
  state.aiMoveTimer -= dt;

  if (state.aiMoveTimer <= 0) {
    state.aiMoveTimer = 0.45 + Math.random() * 0.65;
    const target = Math.floor(Math.random() * LANE_COUNT);
    state.enemyLane += Math.sign(target - state.enemyLane);
  }

  if (state.aiTimer <= 0) {
    state.aiTimer = 0.55 + Math.random() * 0.65;
    const dirs = [-1, 0, 1];
    shoot("enemy", dirs[Math.floor(Math.random() * dirs.length)], Math.random() < 0.08);
  }

  updateHud();
}

function burst(x, y, count) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - .5) * 260,
      vy: (Math.random() - .5) * 260,
      life: .3 + Math.random() * .35,
      size: 2 + Math.random() * 7,
    });
  }
}

function damageCrystal(side, damage) {
  const key = `${side}Hp`;
  state[key] = Math.max(0, state[key] - damage);
  updateHud();
  if (state[key] <= 0) endGame(side === "enemy" ? "YOU WIN" : "YOU LOSE");
}

function endGame(text) {
  state.running = false;
  ui.messageTitle.textContent = text;
  ui.message.classList.remove("hidden");
}

function updateHud() {
  ui.playerHp.textContent = state.playerHp;
  ui.enemyHp.textContent = state.enemyHp;
  ui.playerHpBar.style.width = `${state.playerHp / CRYSTAL_HP * 100}%`;
  ui.enemyHpBar.style.width = `${state.enemyHp / CRYSTAL_HP * 100}%`;
  ui.shotCount.textContent = state.shots.filter(s => s.owner === "player").length;
}

function draw() {
  const g = geometry();
  ctx.clearRect(0, 0, g.w, g.h);

  const bg = ctx.createLinearGradient(0, 0, g.w, g.h);
  bg.addColorStop(0, "#06111f");
  bg.addColorStop(.5, "#081a35");
  bg.addColorStop(1, "#030a15");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, g.w, g.h);

  // lanes
  for (let i = 0; i <= LANE_COUNT; i++) {
    const y = g.top + g.laneH * i;
    ctx.strokeStyle = i === 0 || i === LANE_COUNT ? "rgba(101,214,255,.55)" : "rgba(101,214,255,.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.leftCrystalX, y);
    ctx.lineTo(g.rightCrystalX, y);
    ctx.stroke();
  }

  drawCrystal(g.leftCrystalX, (g.top + g.bottom) / 2, state.playerHp, false);
  drawCrystal(g.rightCrystalX, (g.top + g.bottom) / 2, state.enemyHp, true);

  drawCharacter("player", g.playerX, laneY(state.playerLane), false);
  drawCharacter("enemy", g.enemyX, laneY(state.enemyLane), true);

  for (const shot of state.shots) {
    const y = laneY(shot.laneFloat);
    ctx.save();
    ctx.shadowColor = "#35c5ff";
    ctx.shadowBlur = shot.charged ? 28 : 16;
    ctx.fillStyle = shot.charged ? "#efffff" : "#4fcfff";
    ctx.beginPath();
    ctx.arc(shot.x, y, shot.charged ? g.laneH * .13 : g.laneH * .085, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "#8fe4ff";
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawCrystal(x, y, hp, flip) {
  const g = geometry();
  const width = g.w * .055;
  const height = g.bottom - g.top;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.shadowColor = "#2ca9ff";
  ctx.shadowBlur = 24;
  const grad = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  grad.addColorStop(0, "#0e5fbf");
  grad.addColorStop(.5, "#b9f3ff");
  grad.addColorStop(1, "#0e73d8");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-width * .45, 0);
  ctx.lineTo(-width * .15, -height * .47);
  ctx.lineTo(width * .42, -height * .30);
  ctx.lineTo(width * .52, 0);
  ctx.lineTo(width * .42, height * .30);
  ctx.lineTo(-width * .15, height * .47);
  ctx.closePath();
  ctx.fill();

  const cracks = Math.floor((CRYSTAL_HP - hp) / 3);
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.lineWidth = 2;
  for (let i = 0; i < cracks; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -height * .08 + i * 10);
    ctx.lineTo(width * .28, height * (.08 + i * .03));
    ctx.stroke();
  }
  ctx.restore();
}

function drawCharacter(side, x, y, flip) {
  const g = geometry();
  const anim = state[`${side}Anim`];
  const img = assets[anim] || assets.neutral;
  const h = g.laneH * 1.22;
  const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
  const w = h * ratio;

  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  if (img.complete) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  if (side === "player" && state.guarding) {
    ctx.save();
    ctx.strokeStyle = "#9eeaff";
    ctx.lineWidth = 5;
    ctx.shadowColor = "#53cbff";
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.ellipse(x + g.w * .035, y, g.w * .035, g.laneH * .45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function loop(now) {
  const dt = Math.min(.033, (now - state.lastTime) / 1000);
  state.lastTime = now;
  update(dt, now);
  draw();
  requestAnimationFrame(loop);
}

function bindHold(button, start, end) {
  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    button.classList.add("active");
    start();
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(type, e => {
      e.preventDefault();
      button.classList.remove("active");
      end?.();
    });
  }
}

bindHold(document.getElementById("upBtn"), () => movePlayer(-1));
bindHold(document.getElementById("downBtn"), () => movePlayer(1));
bindHold(document.getElementById("guardBtn"), () => setGuard(true), () => setGuard(false));

document.querySelectorAll("[data-shot]").forEach(btn => {
  btn.addEventListener("pointerdown", e => {
    e.preventDefault();
    shoot("player", Number(btn.dataset.shot));
  });
});

window.addEventListener("keydown", e => {
  if (e.repeat) return;
  if (e.key === "ArrowUp") movePlayer(-1);
  if (e.key === "ArrowDown") movePlayer(1);
  if (e.key.toLowerCase() === "q") shoot("player", -1);
  if (e.key.toLowerCase() === "w") shoot("player", 0);
  if (e.key.toLowerCase() === "e") shoot("player", 1);
  if (e.code === "Space") setGuard(true);
});
window.addEventListener("keyup", e => {
  if (e.code === "Space") setGuard(false);
});

document.getElementById("restartBtn").addEventListener("click", () => location.reload());

requestAnimationFrame(loop);
