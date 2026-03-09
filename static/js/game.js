const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const movesValue = document.getElementById("movesValue");
const statusText = document.getElementById("statusText");
const sessionValue = document.getElementById("sessionValue");
const timeValue = document.getElementById("timeValue");
const levelValue = document.getElementById("levelValue");
const yearEl = document.getElementById("year");
const progressChips = document.querySelectorAll("#progressChips .chip");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const difficultySelect = document.getElementById("difficultySelect");
const padButtons = document.querySelectorAll(".pad-btn");
const gameModalOverlay = document.getElementById("gameModalOverlay");
const gameModalTitle = document.getElementById("gameModalTitle");
const gameModalMessage = document.getElementById("gameModalMessage");
const overlayAction = document.getElementById("overlayAction");
const overlayCancel = document.getElementById("overlayCancel");
const audioToggle = document.getElementById("audioToggle");
const audioVolume = document.getElementById("audioVolume");

const DIFFICULTY_CONFIG = {
  novato: { label: "Novato", cellSize: 25, baseFrames: 8, rocks: 0, violetCount: 0, alliedSnake: false, shieldMs: 0 },
  facil: { label: "Fácil", cellSize: 20, baseFrames: 7, rocks: 0, violetCount: 0, alliedSnake: false, shieldMs: 0 },
  intermedio: { label: "Intermedio", cellSize: 16, baseFrames: 6, rocks: 6, violetCount: 1, alliedSnake: false, shieldMs: 0 },
  dificil: { label: "Difícil", cellSize: 10, baseFrames: 5, rocks: 12, violetCount: 2, alliedSnake: true, shieldMs: 2000 },
  pesadilla: { label: "Pesadilla", cellSize: 8, baseFrames: 4, rocks: 18, violetCount: 3, alliedSnake: true, shieldMs: 7000 },
};

const ROCK_LIMIT = 3;
const ROCK_STUN_MS = 900;
const VIOLET_BODY_SEGMENTS = 4;
const VIOLET_RESPAWN_MS = 5000;
const VIOLET_SLOW_MS = 2000;
const ENEMY_BODY_RECOVER_MS = 2200;
const ALLY_RED_GROWTH_LIMIT = 3;
const APPLES_PER_LEVEL = 10;
const APPLES_PER_BODY_GROWTH = 2;
const LEVELS_PER_DIFFICULTY = 5;

const PROGRESS_STAGES = ["TRACE", "SPLICE", "RUSH", "BREACH", "OVERDRIVE"];

let frameCounter = 0;
let isRunning = false;
let isPaused = false;
let hasActiveSession = false;

let score = 0;
let moves = 0;
let best = Number(localStorage.getItem("datacrawlBest")) || 0;
let session = 1;

let elapsedBeforePauseMs = 0;
let runStartTimestamp = 0;

let snake;
let allySnake = null;
let apple;
let redApple = null;
let violetEnemies = [];
let rocks = [];

let rockHits = 0;
let stunUntil = 0;
let invulnerableUntil = 0;
let applesEatenInLevel = 0;
let difficultyLevel = 1;

let difficulty = difficultySelect ? difficultySelect.value : "novato";

let touchStartX = 0;
let touchStartY = 0;

let audioCtx = null;
let soundEnabled = true;
let volumeLevel = 1;
let audioUnlocked = false;

function audioPercentLabel() {
  return `${Math.round(volumeLevel * 100)}%`;
}

function updateAudioToggleLabel() {
  if (!audioToggle) return;
  const icon = soundEnabled ? "🔊" : "🔈";
  const status = soundEnabled ? "Sonido activo" : "Sonido apagado";
  audioToggle.textContent = `${icon} ${status} (${audioPercentLabel()})`;
}

function ensureAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function unlockAudio() {
  const ac = ensureAudioContext();
  if (!ac) return;

  const markUnlocked = () => {
    audioUnlocked = true;
  };

  if (ac.state === "running") {
    markUnlocked();
    return;
  }

  ac.resume().then(markUnlocked).catch(() => {
    audioUnlocked = false;
  });
}

function registerAudioUnlockEvents() {
  const unlockEvents = ["pointerdown", "touchstart", "click", "keydown"];
  unlockEvents.forEach((eventName) => {
    document.addEventListener(eventName, unlockAudio, { once: true, passive: true });
  });
}

function playTone({ frequency = 440, duration = 0.08, type = "square", gain = 0.08 }) {
  if (!soundEnabled) return;
  const ac = ensureAudioContext();
  if (!ac) return;
  if (ac.state !== "running" && !audioUnlocked) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  g.gain.value = gain * volumeLevel;
  osc.connect(g);
  g.connect(ac.destination);
  const now = ac.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * volumeLevel), now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playEventSound(event) {
  const events = {
    apple: () => {
      playTone({ frequency: 660, duration: 0.08, type: "triangle", gain: 0.09 });
      setTimeout(() => playTone({ frequency: 820, duration: 0.08, type: "triangle", gain: 0.08 }), 40);
    },
    hit: () => playTone({ frequency: 130, duration: 0.16, type: "sawtooth", gain: 0.12 }),
    bite: () => playTone({ frequency: 220, duration: 0.07, type: "square", gain: 0.09 }),
    pause: () => playTone({ frequency: 300, duration: 0.06, type: "triangle", gain: 0.07 }),
    gameover: () => {
      playTone({ frequency: 180, duration: 0.14, type: "sawtooth", gain: 0.1 });
      setTimeout(() => playTone({ frequency: 140, duration: 0.2, type: "sawtooth", gain: 0.1 }), 80);
    },
    start: () => playTone({ frequency: 520, duration: 0.1, type: "square", gain: 0.08 }),
    shield: () => playTone({ frequency: 980, duration: 0.1, type: "triangle", gain: 0.1 }),
  };

  if (events[event]) events[event]();
}

function activeDifficulty() {
  return DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.novato;
}

function gridSize() {
  return activeDifficulty().cellSize;
}

function tileCount() {
  return Math.floor(canvas.width / gridSize());
}

function randomTile() {
  return Math.floor(Math.random() * tileCount()) * gridSize();
}

function getRandomDirection() {
  const g = gridSize();
  const dirs = [
    { dx: g, dy: 0 },
    { dx: -g, dy: 0 },
    { dx: 0, dy: g },
    { dx: 0, dy: -g },
  ];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

function wrap(value) {
  const g = gridSize();
  if (value < 0) return canvas.width - g;
  if (value >= canvas.width) return 0;
  return value;
}

function isRockCell(x, y) {
  return rocks.some((rock) => rock.x === x && rock.y === y);
}

function snakeHasCell(targetSnake, x, y) {
  return targetSnake && targetSnake.cells.some((cell) => cell.x === x && cell.y === y);
}

function isVioletEnemyCell(x, y) {
  return violetEnemies.some((enemy) => {
    if (!enemy.active) return false;
    if (enemy.head.x === x && enemy.head.y === y) return true;
    return enemy.body.some((cell) => cell.x === x && cell.y === y);
  });
}

function occupiedForSpawn(x, y) {
  const isAppleCell = apple && apple.x === x && apple.y === y;
  const isRedApple = redApple?.active && redApple.x === x && redApple.y === y;
  return snakeHasCell(snake, x, y) || snakeHasCell(allySnake, x, y) || isRockCell(x, y) || isVioletEnemyCell(x, y) || isAppleCell || isRedApple;
}

function placeApple() {
  apple = { x: randomTile(), y: randomTile() };
  let guard = 0;
  while (occupiedForSpawn(apple.x, apple.y) && guard < 2000) {
    apple = { x: randomTile(), y: randomTile() };
    guard += 1;
  }
}

function placeRedApple() {
  if (!activeDifficulty().shieldMs) {
    redApple = null;
    return;
  }

  redApple = { x: randomTile(), y: randomTile(), active: true };
  let guard = 0;
  while (occupiedForSpawn(redApple.x, redApple.y) && guard < 2000) {
    redApple.x = randomTile();
    redApple.y = randomTile();
    guard += 1;
  }
}

function placeRocks() {
  rocks = [];
  const rockTotal = activeDifficulty().rocks || 0;
  let guard = 0;
  while (rocks.length < rockTotal && guard < 5000) {
    const candidate = { x: randomTile(), y: randomTile() };
    guard += 1;
    if (occupiedForSpawn(candidate.x, candidate.y)) continue;
    rocks.push(candidate);
  }
}

function createVioletEnemy() {
  const head = { x: randomTile(), y: randomTile() };
  let guard = 0;
  while (occupiedForSpawn(head.x, head.y) && guard < 2000) {
    head.x = randomTile();
    head.y = randomTile();
    guard += 1;
  }

  const body = [];
  let currentX = head.x;
  let currentY = head.y;
  for (let i = 0; i < VIOLET_BODY_SEGMENTS; i += 1) {
    currentX = wrap(currentX - gridSize());
    body.push({ x: currentX, y: currentY });
  }

  return {
    active: true,
    head,
    body,
    dx: gridSize(),
    dy: 0,
    moveCounter: 0,
    slowUntil: 0,
    respawnAt: 0,
    missingSegments: 0,
    recoverAt: 0,
  };
}

function spawnVioletEnemies() {
  violetEnemies = [];
  const qty = activeDifficulty().violetCount || 0;
  for (let i = 0; i < qty; i += 1) violetEnemies.push(createVioletEnemy());
}

function tryRespawnEnemy(enemy) {
  if (Date.now() < enemy.respawnAt) return;
  Object.assign(enemy, createVioletEnemy());
}

function axisDistance(a, b) {
  const size = canvas.width;
  const direct = Math.abs(a - b);
  return Math.min(direct, size - direct);
}

function wrappedStepToward(from, to) {
  const g = gridSize();
  const size = canvas.width;
  if (from === to) return 0;
  const plus = (to - from + size) % size;
  const minus = (from - to + size) % size;
  if (plus < minus) return g;
  return -g;
}

function isEnemyFutureBody(enemy, x, y) {
  return enemy.body.some((cell) => cell.x === x && cell.y === y);
}

function pickSmartDirection(head, currentDx, currentDy, avoidFn, targetPoints) {
  const g = gridSize();
  const directions = [
    { dx: g, dy: 0 },
    { dx: -g, dy: 0 },
    { dx: 0, dy: g },
    { dx: 0, dy: -g },
  ];

  const reverseDx = -currentDx;
  const reverseDy = -currentDy;

  let best = null;
  directions.forEach((dir) => {
    if (dir.dx === reverseDx && dir.dy === reverseDy) return;
    const nx = wrap(head.x + dir.dx);
    const ny = wrap(head.y + dir.dy);
    if (avoidFn(nx, ny)) return;

    const distanceScore = targetPoints.reduce((acc, target) => {
      return acc + axisDistance(nx, target.x) + axisDistance(ny, target.y);
    }, 0);

    const straightBonus = dir.dx === currentDx && dir.dy === currentDy ? -0.4 : 0;
    const scoreCandidate = distanceScore + straightBonus + Math.random() * 0.8;

    if (!best || scoreCandidate < best.score) {
      best = { ...dir, score: scoreCandidate };
    }
  });

  if (best) return best;

  const fallback = getRandomDirection();
  return { dx: fallback.dx, dy: fallback.dy };
}

function moveVioletEnemy(enemy) {
  if (!enemy.active) {
    tryRespawnEnemy(enemy);
    return;
  }

  const now = Date.now();
  if (enemy.missingSegments > 0 && now >= enemy.recoverAt) {
    enemy.missingSegments -= 1;
    enemy.recoverAt = now + ENEMY_BODY_RECOVER_MS;
  }

  const baseFrames = 7;
  const slowed = now < enemy.slowUntil;
  const threshold = slowed ? baseFrames * 2 : baseFrames;

  enemy.moveCounter += 1;
  if (enemy.moveCounter < threshold) return;
  enemy.moveCounter = 0;

  const primaryTargets = [{ x: snake.x, y: snake.y }];
  if (allySnake) primaryTargets.push({ x: allySnake.cells[0].x, y: allySnake.cells[0].y });

  const preferredStep = {
    dx: wrappedStepToward(enemy.head.x, primaryTargets[0].x),
    dy: wrappedStepToward(enemy.head.y, primaryTargets[0].y),
  };

  const weightedTargets = [
    ...primaryTargets,
    { x: wrap(enemy.head.x + preferredStep.dx), y: wrap(enemy.head.y + preferredStep.dy) },
  ];

  const nextDir = pickSmartDirection(
    enemy.head,
    enemy.dx,
    enemy.dy,
    (x, y) => isRockCell(x, y) || isEnemyFutureBody(enemy, x, y),
    weightedTargets,
  );

  enemy.dx = nextDir.dx;
  enemy.dy = nextDir.dy;

  const nextX = wrap(enemy.head.x + enemy.dx);
  const nextY = wrap(enemy.head.y + enemy.dy);

  enemy.body.unshift({ x: enemy.head.x, y: enemy.head.y });
  const expectedLength = Math.max(1, VIOLET_BODY_SEGMENTS - enemy.missingSegments);
  enemy.body = enemy.body.slice(0, expectedLength);
  enemy.head.x = nextX;
  enemy.head.y = nextY;
}

function createAllySnake() {
  if (!activeDifficulty().alliedSnake) {
    allySnake = null;
    return;
  }

  const g = gridSize();
  const start = {
    x: Math.floor(tileCount() / 3) * g,
    y: Math.floor(tileCount() / 3) * g,
  };

  allySnake = {
    cells: [
      { x: start.x, y: start.y },
      { x: wrap(start.x - g), y: start.y },
      { x: wrap(start.x - g * 2), y: start.y },
    ],
    maxCells: 3,
    redAppleGrowths: 0,
    dx: g,
    dy: 0,
    moveCounter: 0,
  };
}

function moveAllySnake() {
  if (!allySnake) return;

  allySnake.moveCounter += 1;
  if (allySnake.moveCounter < 5) return;
  allySnake.moveCounter = 0;

  const objectives = [{ x: apple.x, y: apple.y }];
  if (redApple?.active && allySnake.redAppleGrowths < ALLY_RED_GROWTH_LIMIT) objectives.unshift({ x: redApple.x, y: redApple.y });

  violetEnemies.forEach((enemy) => {
    if (!enemy.active) return;
    enemy.body.forEach((segment) => objectives.push({ x: segment.x, y: segment.y }));
  });

  const head = allySnake.cells[0];
  const dir = pickSmartDirection(
    head,
    allySnake.dx,
    allySnake.dy,
    (x, y) => isRockCell(x, y) || snakeHasCell(allySnake, x, y) || snakeHasCell(snake, x, y),
    objectives,
  );

  allySnake.dx = dir.dx;
  allySnake.dy = dir.dy;

  const nextX = wrap(head.x + allySnake.dx);
  const nextY = wrap(head.y + allySnake.dy);

  allySnake.cells.unshift({ x: nextX, y: nextY });
  if (allySnake.cells.length > allySnake.maxCells) allySnake.cells.pop();
}

function initializeSnake() {
  const g = gridSize();
  const startX = Math.floor(tileCount() / 2) * g;
  const startY = Math.floor(tileCount() / 2) * g;

  snake = {
    x: startX,
    y: startY,
    dx: g,
    dy: 0,
    cells: [{ x: startX, y: startY }],
    maxCells: 4,
  };
}

function resetSession({ incrementSession }) {
  if (incrementSession && hasActiveSession) session += 1;

  initializeSnake();
  createAllySnake();
  frameCounter = 0;
  score = 0;
  moves = 0;
  rockHits = 0;
  stunUntil = 0;
  invulnerableUntil = 0;
  applesEatenInLevel = 0;
  difficultyLevel = 1;
  elapsedBeforePauseMs = 0;
  runStartTimestamp = Date.now();
  hasActiveSession = true;

  placeApple();
  placeRedApple();
  placeRocks();
  spawnVioletEnemies();
  updateHUD("ONLINE");
}

function formatTime(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getElapsedSeconds() {
  if (!hasActiveSession) return 0;
  const runningMs = isRunning && !isPaused ? Date.now() - runStartTimestamp : 0;
  return Math.floor((elapsedBeforePauseMs + runningMs) / 1000);
}

function computeProgressLevel() {
  if (applesEatenInLevel >= 8) return 5;
  if (applesEatenInLevel >= 6) return 4;
  if (applesEatenInLevel >= 4) return 3;
  if (applesEatenInLevel >= 2) return 2;
  return 1;
}

function movementFramesPerStep() {
  const base = activeDifficulty().baseFrames;
  const progressBoost = computeProgressLevel() - 1;
  return Math.max(1, base - progressBoost);
}

function updateProgressChips(level) {
  progressChips.forEach((chip) => {
    const chipLevel = Number(chip.dataset.level);
    chip.classList.toggle("is-reached", chipLevel <= level);
    chip.classList.toggle("is-current", chipLevel === level);
  });
}

function updateHUD(status) {
  scoreValue.textContent = score;
  bestValue.textContent = best;
  movesValue.textContent = moves;
  sessionValue.textContent = String(session).padStart(3, "0");
  timeValue.textContent = formatTime(getElapsedSeconds());
  levelValue.textContent = `${activeDifficulty().label} ${difficultyLevel}/${LEVELS_PER_DIFFICULTY}`;
  statusText.textContent = status;
  updateProgressChips(computeProgressLevel());
  pauseBtn.textContent = isPaused ? "Reanudar" : "Pausar";
}

function setDirection(dir) {
  if (!snake) return;

  const g = gridSize();
  let changed = false;

  if (dir === "left" && snake.dx === 0) {
    snake.dx = -g;
    snake.dy = 0;
    changed = true;
  } else if (dir === "up" && snake.dy === 0) {
    snake.dy = -g;
    snake.dx = 0;
    changed = true;
  } else if (dir === "right" && snake.dx === 0) {
    snake.dx = g;
    snake.dy = 0;
    changed = true;
  } else if (dir === "down" && snake.dy === 0) {
    snake.dy = g;
    snake.dx = 0;
    changed = true;
  }

  if (changed && isRunning && !isPaused) moves += 1;
}

function drawCell(x, y, color) {
  const g = gridSize();
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, g - 2, g - 2);
}

function drawBoardGrid() {
  const g = gridSize();
  ctx.strokeStyle = "rgba(237, 200, 80, 0.42)";
  for (let i = 0; i <= canvas.width; i += g) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoardGrid();

  rocks.forEach((rock) => drawCell(rock.x, rock.y, "#7a7a7a"));
  drawCell(apple.x, apple.y, "#ff4fd8");

  if (redApple?.active) drawCell(redApple.x, redApple.y, "#ff2f2f");

  violetEnemies.forEach((enemy) => {
    if (!enemy.active) return;
    enemy.body.forEach((cell) => drawCell(cell.x, cell.y, "#8b5a2b"));
    drawCell(enemy.head.x, enemy.head.y, "#9f4dff");
  });

  if (allySnake) {
    allySnake.cells.forEach((cell, index) => {
      drawCell(cell.x, cell.y, index === 0 ? "#c2b280" : "#ff8c00");
    });
  }

  snake.cells.forEach((cell, index) => {
    drawCell(cell.x, cell.y, index === 0 ? "#ffffff" : "#39ff14");
  });
}

function finishGame(status = "GAME OVER") {
  isRunning = false;
  isPaused = false;

  if (score > best) {
    best = score;
    localStorage.setItem("datacrawlBest", String(best));
  }

  updateHUD(status);
  playEventSound("gameover");

  if (status === "GAME OVER") {
    openOverlayModal({
      title: "Game Over",
      message: "La partida terminó. ¿Querés jugar otra vez?",
      actionText: "Jugar otra vez",
      cancelText: "Cancelar",
      onConfirm: () => {
        resetSession({ incrementSession: true });
        isRunning = true;
        isPaused = false;
        updateHUD("ONLINE");
        playEventSound("start");
      },
      onCancel: () => updateHUD("GAME OVER"),
    });
    return;
  }

  if (status === "VICTORIA") {
    openOverlayModal({
      title: "Victoria total",
      message: "Completaste los 5 niveles de esta dificultad. ¿Querés iniciar una nueva partida?",
      actionText: "Nueva partida",
      cancelText: "Cerrar",
      onConfirm: () => {
        resetSession({ incrementSession: true });
        isRunning = true;
        isPaused = false;
        updateHUD("ONLINE");
        playEventSound("start");
      },
      onCancel: () => updateHUD("VICTORIA"),
    });
  }
}

function knockOutEnemy(enemy) {
  score += 20;
  enemy.active = false;
  enemy.respawnAt = Date.now() + VIOLET_RESPAWN_MS;
  playEventSound("hit");
}

function completeDifficultyLevel() {
  if (difficultyLevel >= LEVELS_PER_DIFFICULTY) {
    finishGame("VICTORIA");
    return;
  }

  difficultyLevel += 1;
  applesEatenInLevel = 0;
  frameCounter = 0;

  placeApple();
  placeRedApple();
  placeRocks();
  spawnVioletEnemies();
  updateHUD(`LEVEL ${difficultyLevel}/${LEVELS_PER_DIFFICULTY}`);
}

function shrinkSnake(targetSnake, amount, floor, hitStatus = "DAÑO") {
  targetSnake.maxCells = Math.max(floor, targetSnake.maxCells - amount);
  targetSnake.cells = targetSnake.cells.slice(0, targetSnake.maxCells);
  if (targetSnake === snake) {
    snake.x = snake.cells[0].x;
    snake.y = snake.cells[0].y;
    score = Math.max(0, score - 10);
    stunUntil = Date.now() + 500;
  }
  updateHUD(hitStatus);
  playEventSound("hit");
}

function resolveBiteToEnemyBody(consumerHead) {
  violetEnemies.forEach((enemy) => {
    if (!enemy.active) return;
    const bodyIndex = enemy.body.findIndex((cell) => consumerHead.x === cell.x && consumerHead.y === cell.y);
    if (bodyIndex >= 0) {
      enemy.body.splice(bodyIndex, 1);
      enemy.missingSegments = Math.min(VIOLET_BODY_SEGMENTS - 1, enemy.missingSegments + 1);
      enemy.slowUntil = Date.now() + VIOLET_SLOW_MS;
      enemy.recoverAt = Date.now() + ENEMY_BODY_RECOVER_MS;
      score += 6;
      playEventSound("bite");
    }
  });
}

function resolveEnemyVsSnakes() {
  violetEnemies.forEach((enemy) => {
    if (!enemy.active) return;

    const playerBodyIdx = snake.cells.slice(1).findIndex((cell) => enemy.head.x === cell.x && enemy.head.y === cell.y);
    if (playerBodyIdx >= 0 && Date.now() >= invulnerableUntil) {
      shrinkSnake(snake, 1, 4, "MORDIDA ENEMIGA");
    }

    if (allySnake) {
      const allyHead = allySnake.cells[0];
      if (enemy.head.x === allyHead.x && enemy.head.y === allyHead.y) {
        shrinkSnake(allySnake, 1, 2, "ALIADA HERIDA");
      }
      const allyBodyIdx = allySnake.cells.slice(1).findIndex((cell) => enemy.head.x === cell.x && enemy.head.y === cell.y);
      if (allyBodyIdx >= 0) {
        shrinkSnake(allySnake, 1, 2, "ALIADA HERIDA");
      }
    }

  });
}

function handleRockCollision() {
  rockHits += 1;
  playEventSound("hit");
  if (rockHits >= ROCK_LIMIT) {
    finishGame("GAME OVER");
    return;
  }

  stunUntil = Date.now() + ROCK_STUN_MS;
  updateHUD(`IMPACTO ${rockHits}/${ROCK_LIMIT}`);
}

function tick() {
  requestAnimationFrame(tick);

  if (!hasActiveSession) {
    updateHUD("LISTO");
    drawScene();
    return;
  }

  drawScene();

  if (!isRunning || isPaused) {
    updateHUD(isPaused ? "PAUSED" : "ONLINE");
    return;
  }

  moveAllySnake();
  violetEnemies.forEach((enemy) => moveVioletEnemy(enemy));

  const enemyAtePlayerHead = violetEnemies.some((enemy) => enemy.active && enemy.head.x === snake.x && enemy.head.y === snake.y);
  if (enemyAtePlayerHead) {
    finishGame("GAME OVER");
    return;
  }

  if (Date.now() < stunUntil) {
    updateHUD(`IMPACTO ${rockHits}/${ROCK_LIMIT}`);
    return;
  }

  if (++frameCounter < movementFramesPerStep()) return;
  frameCounter = 0;

  const nextX = wrap(snake.x + snake.dx);
  const nextY = wrap(snake.y + snake.dy);

  if (isRockCell(nextX, nextY)) {
    handleRockCollision();
    return;
  }

  snake.x = nextX;
  snake.y = nextY;

  snake.cells.unshift({ x: snake.x, y: snake.y });
  if (snake.cells.length > snake.maxCells) snake.cells.pop();

  for (let i = 1; i < snake.cells.length; i += 1) {
    if (snake.x === snake.cells[i].x && snake.y === snake.cells[i].y) {
      finishGame("GAME OVER");
      return;
    }
  }

  if (snake.x === apple.x && snake.y === apple.y) {
    applesEatenInLevel += 1;
    if (applesEatenInLevel % APPLES_PER_BODY_GROWTH === 0) snake.maxCells += 1;
    score += 10;
    if (score > best) {
      best = score;
      localStorage.setItem("datacrawlBest", String(best));
    }
    placeApple();
    playEventSound("apple");

    if (applesEatenInLevel >= APPLES_PER_LEVEL) {
      completeDifficultyLevel();
      return;
    }
  }

  if (redApple?.active) {
    if (snake.x === redApple.x && snake.y === redApple.y) {
      invulnerableUntil = Date.now() + activeDifficulty().shieldMs;
      redApple.active = false;
      playEventSound("shield");
      setTimeout(() => {
        if (!hasActiveSession || !activeDifficulty().shieldMs) return;
        placeRedApple();
      }, 6000);
    }

    if (allySnake && allySnake.cells[0].x === redApple.x && allySnake.cells[0].y === redApple.y && allySnake.redAppleGrowths < ALLY_RED_GROWTH_LIMIT) {
      allySnake.redAppleGrowths += 1;
      allySnake.maxCells += 1;
      redApple.active = false;
      score += 5;
      playEventSound("apple");
      setTimeout(() => {
        if (!hasActiveSession || !activeDifficulty().shieldMs) return;
        placeRedApple();
      }, 6000);
    }
  }

  resolveBiteToEnemyBody({ x: snake.x, y: snake.y });
  if (allySnake) resolveBiteToEnemyBody(allySnake.cells[0]);

  violetEnemies.forEach((enemy) => {
    if (!enemy.active) return;
    if (snake.x === enemy.head.x && snake.y === enemy.head.y) knockOutEnemy(enemy);
  });

  resolveEnemyVsSnakes();

  updateHUD(Date.now() < invulnerableUntil ? "SHIELD" : "ONLINE");
}

let overlayConfirmHandler = null;
let overlayCancelHandler = null;
let overlayKeydownHandler = null;
let overlayDismissHandler = null;

function closeOverlayModal() {
  if (!gameModalOverlay) return;
  gameModalOverlay.classList.remove("is-open");
  gameModalOverlay.setAttribute("aria-hidden", "true");

  if (overlayKeydownHandler) document.removeEventListener("keydown", overlayKeydownHandler);

  overlayConfirmHandler = null;
  overlayCancelHandler = null;
  overlayKeydownHandler = null;
  overlayDismissHandler = null;
}

function openOverlayModal({
  title,
  message,
  actionText = "Confirmar",
  cancelText = "Cancelar",
  hideCancel = false,
  allowDismiss = true,
  onConfirm = null,
  onCancel = null,
  onDismiss = null,
}) {
  if (!gameModalOverlay || !overlayAction || !overlayCancel) return;

  closeOverlayModal();

  gameModalTitle.textContent = title;
  gameModalMessage.textContent = message;
  overlayAction.textContent = actionText;
  overlayCancel.textContent = cancelText;
  overlayCancel.classList.toggle("is-hidden", hideCancel);

  overlayConfirmHandler = onConfirm;
  overlayCancelHandler = onCancel;
  overlayDismissHandler = allowDismiss ? onDismiss : null;

  gameModalOverlay.classList.add("is-open");
  gameModalOverlay.setAttribute("aria-hidden", "false");

  overlayKeydownHandler = (event) => {
    if (!allowDismiss) return;
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (overlayDismissHandler) overlayDismissHandler();
    if (overlayCancelHandler) overlayCancelHandler();
    closeOverlayModal();
  };

  document.addEventListener("keydown", overlayKeydownHandler);
}

function newGameFlow() {
  const shouldResumePauseStatus = isPaused && hasActiveSession;

  openOverlayModal({
    title: `Nueva partida · ${activeDifficulty().label}`,
    message: "¿Desea iniciar una partida?",
    actionText: "Iniciar",
    cancelText: "Cancelar",
    onConfirm: () => {
      resetSession({ incrementSession: true });
      isRunning = true;
      isPaused = false;
      updateHUD("ONLINE");
      playEventSound("start");
    },
    onCancel: () => updateHUD(shouldResumePauseStatus ? "PAUSED" : "LISTO"),
  });
}

function togglePause() {
  if (!hasActiveSession) return;

  if (!isPaused && isRunning) {
    elapsedBeforePauseMs += Date.now() - runStartTimestamp;
    isPaused = true;
    playEventSound("pause");
  }

  if (!isPaused) return;

  updateHUD("PAUSED");
  openOverlayModal({
    title: "PAUSED",
    message: 'El juego está detenido. Presioná "Reanudar" para continuar.',
    actionText: "Reanudar",
    hideCancel: true,
    allowDismiss: false,
    onConfirm: () => {
      runStartTimestamp = Date.now();
      isPaused = false;
      isRunning = true;
      updateHUD("ONLINE");
      playEventSound("pause");
    },
    onCancel: () => updateHUD("PAUSED"),
  });
}

function restartGame() {
  if (!hasActiveSession) return;

  const shouldResumePauseStatus = isPaused;

  openOverlayModal({
    title: "Reiniciar partida",
    message: "¿Desea reiniciar la partida?",
    actionText: "Reiniciar",
    cancelText: "Cancelar",
    onConfirm: () => {
      resetSession({ incrementSession: false });
      isRunning = true;
      isPaused = false;
      updateHUD("ONLINE");
      playEventSound("start");
    },
    onCancel: () => updateHUD(shouldResumePauseStatus ? "PAUSED" : "ONLINE"),
  });
}

function changeDifficulty(nextDifficulty) {
  if (!DIFFICULTY_CONFIG[nextDifficulty]) return;

  const prevDifficulty = difficulty;
  const shouldResumePauseStatus = isPaused && hasActiveSession;
  difficulty = nextDifficulty;

  if (hasActiveSession) {
    openOverlayModal({
      title: "Cambiar dificultad",
      message: "Se reiniciará la partida. ¿Continuar?",
      actionText: "Continuar",
      cancelText: "Cancelar",
      onConfirm: () => {
        resetSession({ incrementSession: false });
        isRunning = true;
        isPaused = false;
        updateHUD("ONLINE");
      },
      onCancel: () => {
        difficulty = prevDifficulty;
        difficultySelect.value = prevDifficulty;
        updateHUD(shouldResumePauseStatus ? "PAUSED" : "ONLINE");
      },
    });
    return;
  }

  updateHUD("LISTO");
}

document.addEventListener("keydown", (e) => {
  const keyMap = {
    ArrowLeft: "left",
    ArrowUp: "up",
    ArrowRight: "right",
    ArrowDown: "down",
    a: "left",
    w: "up",
    d: "right",
    s: "down",
  };

  const dir = keyMap[e.key];
  if (dir) {
    e.preventDefault();
    setDirection(dir);
  }

  if (e.key === " ") {
    e.preventDefault();
    togglePause();
  }
});

canvas.addEventListener("touchstart", (event) => {
  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;

  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? "right" : "left");
  } else {
    setDirection(dy > 0 ? "down" : "up");
  }
}, { passive: true });

padButtons.forEach((button) => {
  button.addEventListener("click", () => setDirection(button.dataset.dir));
});

if (audioToggle) {
  audioToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    updateAudioToggleLabel();
    if (soundEnabled) playEventSound("start");
  });
}

if (audioVolume) {
  audioVolume.addEventListener("input", (event) => {
    volumeLevel = Number(event.target.value) / 100;
    updateAudioToggleLabel();
  });
}

if (overlayAction) {
  overlayAction.addEventListener("click", () => {
    if (overlayConfirmHandler) overlayConfirmHandler();
    closeOverlayModal();
  });
}

if (overlayCancel) {
  overlayCancel.addEventListener("click", () => {
    if (overlayCancelHandler) overlayCancelHandler();
    closeOverlayModal();
  });
}

if (gameModalOverlay) {
  gameModalOverlay.addEventListener("click", (event) => {
    if (event.target !== gameModalOverlay) return;
    if (!overlayDismissHandler && !overlayCancelHandler) return;
    if (overlayDismissHandler) overlayDismissHandler();
    if (overlayCancelHandler) overlayCancelHandler();
    closeOverlayModal();
  });
}

startBtn.addEventListener("click", newGameFlow);
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", restartGame);

if (difficultySelect) {
  difficultySelect.addEventListener("change", (event) => {
    changeDifficulty(event.target.value);
  });
}

if (yearEl) yearEl.textContent = new Date().getFullYear();
registerAudioUnlockEvents();
updateAudioToggleLabel();

initializeSnake();
placeApple();
placeRocks();
spawnVioletEnemies();
createAllySnake();
placeRedApple();
updateHUD("LISTO");
tick();
