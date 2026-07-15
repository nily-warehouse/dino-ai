/* DOM-free Chrome Dino simulation for browser and RL training. */

const SPRITES = Object.freeze({
  cactusSmall1: { w: 18, h: 35 },
  cactusSmall2: { w: 34, h: 35 },
  cactusSmall3: { w: 52, h: 35 },
  cactusLarge1: { w: 25, h: 50 },
  cactusLarge2: { w: 50, h: 50 },
  cactusLarge3: { w: 75, h: 50 },
});

const ACTIONS = Object.freeze({ RUN: 0, JUMP: 1, DUCK: 2 });

class SeededRandom {
  constructor(seed = 123456789) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  choice(items) {
    return items[Math.floor(this.next() * items.length)];
  }
}

class DinoGame {
  constructor(options = {}) {
    this.width = options.width || 1200;
    this.height = options.height || 360;
    this.groundY = options.groundY || 270;
    this.scale = options.scale || 1;
    this.rng = new SeededRandom(options.seed || 1);
    this.getStoredHighScore = options.getHighScore || (() => 0);
    this.saveHighScore = options.saveHighScore || (() => {});

    this.gravity = 1;
    this.jumpVelocity = -15.5;
    this.initialSpeed = 15;
    this.maxSpeed = 40;
    this.acceleration = 0.0017;
    this.obstacleConfig = {
      minGap: 220, maxGap: 620, pteroUnlockScore: 60,
      pteroMinChance: 0.18, pteroMaxChance: 0.42, repeatPenalty: 0.55,
    };

    this.reset();
  }

  reset(seed = null) {
    if (seed !== null) this.rng = new SeededRandom(seed);
    this.frame = 0;
    this.score = 0;
    this.distance = 0;
    this.speed = this.initialSpeed;
    this.gameOver = false;
    this.started = false;
    this.highScore = Number(this.getStoredHighScore() || 0);
    this.dino = {
      x: 52, y: 0, w: 44 * this.scale, h: 47 * this.scale, vy: 0,
      isJumping: false, isDucking: false, runFrame: 0, animTimer: 0,
    };
    this.placeDinoOnGround();
    this.obstacles = [];
    this.clouds = [];
    this.stars = [];
    this.lastObstacleKind = null;
    this.sameObstacleStreak = 0;
    this.nextObstacleDistance = this.getNextObstacleGap();
    this.nextCloudDistance = 180;
    this.spawnInitialDecorations();
    return this.getState();
  }

  placeDinoOnGround() {
    this.dino.y = this.groundY - this.dino.h;
  }

  spawnInitialDecorations() {
    for (let i = 0; i < 3; i += 1) {
      this.clouds.push({ x: 450 + i * 310, y: this.rng.range(70, 150), speedFactor: this.rng.range(0.15, 0.35) });
    }
    for (let i = 0; i < 4; i += 1) {
      this.stars.push({ x: 160 + i * 260, y: this.rng.range(45, 125) });
    }
  }

  start() {
    this.started = true;
  }

  jump() {
    if (this.gameOver) return;
    this.started = true;
    if (!this.dino.isJumping) {
      this.dino.isDucking = false;
      this.dino.w = 44 * this.scale;
      this.dino.h = 47 * this.scale;
      this.placeDinoOnGround();
      this.dino.vy = this.jumpVelocity;
      this.dino.isJumping = true;
    }
  }

  duck(active) {
    if (this.gameOver) return;
    this.started = true;
    if (this.dino.isJumping) {
      if (active) this.dino.vy += 0.8;
      return;
    }
    this.dino.isDucking = Boolean(active);
    this.dino.w = (this.dino.isDucking ? 59 : 44) * this.scale;
    this.dino.h = (this.dino.isDucking ? 30 : 47) * this.scale;
    this.placeDinoOnGround();
  }

  step(action = ACTIONS.RUN) {
    if (action === ACTIONS.JUMP) {
      this.duck(false);
      this.jump();
    } else {
      this.duck(action === ACTIONS.DUCK);
    }
    return this.updateFrame();
  }

  updateFrame() {
    if (!this.started || this.gameOver) {
      return { state: this.getState(), reward: this.gameOver ? -100 : 0, done: this.gameOver };
    }
    this.frame += 1;
    this.updateSpeed();
    this.updateDino();
    this.updateObstacles();
    this.updateDecorations();
    if (this.checkCollision()) {
      this.crashDino();
      this.gameOver = true;
      this.updateHighScore();
      return { state: this.getState(), reward: -100, done: true };
    }
    this.distance += this.speed;
    this.score = Math.floor(this.distance * 0.025);
    return { state: this.getState(), reward: 1, done: false };
  }

  updateSpeed() {
    this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration);
  }

  updateDino() {
    const dino = this.dino;
    dino.y += dino.vy;
    dino.vy += this.gravity;
    const floorY = this.groundY - dino.h;
    if (dino.y >= floorY) {
      dino.y = floorY;
      dino.vy = 0;
      dino.isJumping = false;
    }
    dino.animTimer += 1;
    if (dino.animTimer > Math.max(4, 8 - this.speed * 0.25)) {
      dino.animTimer = 0;
      dino.runFrame = 1 - dino.runFrame;
    }
  }

  getNextObstacleGap() {
    const speedRatio = Math.min(1, this.speed / this.maxSpeed);
    const randomGap = this.rng.range(220 + this.speed * 8, 620 + this.speed * 16);
    return Math.max(160, randomGap + this.rng.range(-90, 130) * (0.5 + speedRatio));
  }

  updateObstacles() {
    for (const obstacle of this.obstacles) obstacle.x -= this.speed;
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -30);
    this.nextObstacleDistance -= this.speed;
    if (this.nextObstacleDistance <= 0) {
      this.spawnObstacle();
      this.nextObstacleDistance = this.getNextObstacleGap();
    }
  }

  spawnObstacle() {
    const speedRatio = Math.min(1, this.speed / this.maxSpeed);
    const canSpawnPtero = this.score >= this.obstacleConfig.pteroUnlockScore;
    let pteroChance = canSpawnPtero
      ? this.obstacleConfig.pteroMinChance +
        (this.obstacleConfig.pteroMaxChance - this.obstacleConfig.pteroMinChance) * speedRatio
      : 0;
    if (this.lastObstacleKind === "ptero") pteroChance *= this.obstacleConfig.repeatPenalty;
    if (this.lastObstacleKind === "cactus" && this.sameObstacleStreak >= 2) pteroChance = Math.max(pteroChance, 0.36);
    if (canSpawnPtero && this.rng.next() < pteroChance) {
      this.spawnPtero();
      this.rememberObstacleKind("ptero");
    } else {
      this.spawnCactus();
      this.rememberObstacleKind("cactus");
    }
  }

  spawnPtero() {
    const y = this.rng.choice([
      this.groundY - 38 * this.scale,
      this.groundY - 62 * this.scale,
      this.groundY - 88 * this.scale,
    ]);
    this.obstacles.push({
      kind: "ptero", spriteA: "ptero1", spriteB: "ptero2",
      x: this.width + this.rng.range(40, 120), y, w: 46 * this.scale, h: 40 * this.scale,
      animFrame: 0, animTimer: 0,
    });
  }

  spawnCactus() {
    const sprite = this.rng.choice(["cactusSmall1", "cactusSmall2", "cactusSmall3", "cactusLarge1", "cactusLarge2", "cactusLarge3"]);
    const base = SPRITES[sprite];
    const cactusScale = this.scale * 0.95;
    this.obstacles.push({
      kind: "cactus", sprite, x: this.width + this.rng.range(40, 120),
      y: this.groundY - base.h * cactusScale, w: base.w * cactusScale, h: base.h * cactusScale,
      drawScale: cactusScale,
    });
  }

  rememberObstacleKind(kind) {
    if (this.lastObstacleKind === kind) this.sameObstacleStreak += 1;
    else {
      this.lastObstacleKind = kind;
      this.sameObstacleStreak = 1;
    }
  }

  updateDecorations() {
    for (const cloud of this.clouds) {
      cloud.x -= this.speed * cloud.speedFactor;
      if (cloud.x < -100) {
        cloud.x = this.width + this.rng.range(80, 420);
        cloud.y = this.rng.range(70, 150);
        cloud.speedFactor = this.rng.range(0.15, 0.35);
      }
    }
    for (const star of this.stars) {
      star.x -= this.speed * 0.08;
      if (star.x < -20) {
        star.x = this.width + this.rng.range(120, 360);
        star.y = this.rng.range(45, 125);
      }
    }
    for (const obstacle of this.obstacles) {
      if (obstacle.kind !== "ptero") continue;
      obstacle.animTimer += 1;
      if (obstacle.animTimer > 10) {
        obstacle.animTimer = 0;
        obstacle.animFrame = 1 - obstacle.animFrame;
      }
    }
  }

  crashDino() {
    this.dino.isDucking = false;
    this.dino.isJumping = false;
    this.dino.vy = 0;
    this.dino.w = 44 * this.scale;
    this.dino.h = 47 * this.scale;
    this.dino.y = Math.min(this.dino.y, this.groundY - this.dino.h);
  }

  getDinoHitbox() {
    const dino = this.dino;
    return dino.isDucking
      ? { x: dino.x + 10, y: dino.y + 8, w: dino.w - 18, h: dino.h - 12 }
      : { x: dino.x + 16, y: dino.y + 8, w: dino.w - 28, h: dino.h - 14 };
  }

  getObstacleHitbox(obstacle) {
    return obstacle.kind === "ptero"
      ? { x: obstacle.x + 8, y: obstacle.y + 8, w: obstacle.w - 16, h: obstacle.h - 16 }
      : { x: obstacle.x + 6, y: obstacle.y + 4, w: obstacle.w - 12, h: obstacle.h - 6 };
  }

  checkCollision() {
    const dinoHitbox = this.getDinoHitbox();
    return this.obstacles.some((obstacle) => {
      const hitbox = this.getObstacleHitbox(obstacle);
      return dinoHitbox.x < hitbox.x + hitbox.w &&
        dinoHitbox.x + dinoHitbox.w > hitbox.x &&
        dinoHitbox.y < hitbox.y + hitbox.h &&
        dinoHitbox.y + dinoHitbox.h > hitbox.y;
    });
  }

  updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore(this.highScore);
    }
  }

  getNearestObstacle() {
    let nearest = null;
    let minDistance = Infinity;
    for (const obstacle of this.obstacles) {
      const distance = obstacle.x - this.dino.x;
      if (distance >= -obstacle.w && distance < minDistance) {
        minDistance = distance;
        nearest = obstacle;
      }
    }
    return nearest;
  }

  getState() {
    const nearest = this.getNearestObstacle();
    return {
      frame: this.frame, distance: this.distance, score: this.score, highScore: this.highScore,
      gameOver: this.gameOver, started: this.started,
      dino: {
        x: this.dino.x, y: this.dino.y, speed: this.speed, vy: this.dino.vy,
        width: this.dino.w, height: this.dino.h, isJumping: this.dino.isJumping, isDucking: this.dino.isDucking,
      },
      obstacles: this.obstacles.map((obstacle) => ({
        kind: obstacle.kind, x: obstacle.x, y: obstacle.y, width: obstacle.w, height: obstacle.h,
      })),
      nearestObstacle: nearest ? {
        kind: nearest.kind, x: nearest.x, y: nearest.y, width: nearest.w, height: nearest.h,
        distance: nearest.x - this.dino.x,
      } : null,
      normalized: {
        speed: this.speed / this.maxSpeed, dinoY: this.dino.y / this.height, dinoVy: this.dino.vy / 20,
        obstacleDistance: nearest ? Math.max(-1, Math.min(1, (nearest.x - this.dino.x) / this.width)) : 1,
        obstacleHeight: nearest ? nearest.h / 120 : 0, obstacleY: nearest ? nearest.y / this.height : 0,
        obstacleIsPtero: nearest && nearest.kind === "ptero" ? 1 : 0,
      },
    };
  }
}

const api = { ACTIONS, DinoGame, SeededRandom, SPRITES };

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.DinoCore = api;
