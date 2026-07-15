/* game.js */

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

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
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

    this.gravity = 1;
    this.jumpVelocity = -15.5;
    this.initialSpeed = 15;
    this.maxSpeed = 40;
    this.acceleration = 0.0017;

    this.rlMode = Boolean(options.rlMode);

    this.reset();
  }

  reset(seed = null) {
    if (seed !== null) {
      this.rng = new SeededRandom(seed);
    }

    this.frame = 0;
    this.score = 0;
    this.distance = 0;
    this.highScore = Number(localStorage.getItem("dinoHighScore") || 0);

    this.speed = this.initialSpeed;
    this.gameOver = false;
    this.started = false;

    this.dino = {
      x: 52,
      y: this.groundY - 47 * this.scale,
      w: 44 * this.scale,
      h: 47 * this.scale,
      vy: 0,
      isJumping: false,
      isDucking: false,
      runFrame: 0,
      animTimer: 0,
    };

    this.obstacles = [];
    this.clouds = [];
    this.stars = [];

    this.nextObstacleDistance = 360;
    this.nextCloudDistance = 180;

    this.spawnInitialDecorations();

    return this.getState();
  }

  spawnInitialDecorations() {
    for (let i = 0; i < 3; i++) {
      this.clouds.push({
        x: 450 + i * 310,
        y: this.rng.range(70, 150),
        speedFactor: this.rng.range(0.15, 0.35),
      });
    }

    for (let i = 0; i < 4; i++) {
      this.stars.push({
        x: 160 + i * 260,
        y: this.rng.range(45, 125),
      });
    }
  }

  start() {
    this.started = true;
  }

  jump() {
    if (this.gameOver) return;

    this.started = true;

    if (!this.dino.isJumping) {
      this.dino.vy = this.jumpVelocity;
      this.dino.isJumping = true;
      this.dino.isDucking = false;
    }
  }

  duck(active) {
    if (this.gameOver) return;

    this.started = true;

    if (this.dino.isJumping) {
      if (active) {
        this.dino.vy += 0.8;
      }
      return;
    }

    this.dino.isDucking = active;

    if (active) {
      this.dino.w = 59 * this.scale;
      this.dino.h = 30 * this.scale;
      this.dino.y = this.groundY - this.dino.h;
    } else {
      this.dino.w = 44 * this.scale;
      this.dino.h = 47 * this.scale;
      this.dino.y = this.groundY - this.dino.h;
    }
  }

  step(action = 0) {
    /*
      RL action space:
      0 = do nothing
      1 = jump
      2 = duck
      3 = release duck
    */

    if (action === 1) this.jump();
    if (action === 2) this.duck(true);
    if (action === 3) this.duck(false);

    if (!this.started || this.gameOver) {
      return {
        state: this.getState(),
        reward: this.gameOver ? -100 : 0,
        done: this.gameOver,
      };
    }

    this.frame += 1;

    this.updateSpeed();
    this.updateDino();
    this.updateObstacles();
    this.updateDecorations();

    const collided = this.checkCollision();

    if (collided) {
      this.gameOver = true;
      this.updateHighScore();

      return {
        state: this.getState(),
        reward: -100,
        done: true,
      };
    }

    this.distance += this.speed;
    this.score = Math.floor(this.distance * 0.025);

    return {
      state: this.getState(),
      reward: 1,
      done: false,
    };
  }

  updateSpeed() {
    this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration);
  }

  updateDino() {
    const dino = this.dino;

    dino.y += dino.vy;
    dino.vy += this.gravity;

    const standHeight = dino.isDucking ? 30 * this.scale : 47 * this.scale;
    const floorY = this.groundY - standHeight;

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

  updateObstacles() {
    for (const obs of this.obstacles) {
      obs.x -= this.speed;
    }

    this.obstacles = this.obstacles.filter((obs) => obs.x + obs.w > -30);

    this.nextObstacleDistance -= this.speed;

    if (this.nextObstacleDistance <= 0) {
      this.spawnObstacle();

      const minGap = 250;
      const maxGap = 520;
      const speedBonus = this.speed * 18;

      this.nextObstacleDistance = this.rng.range(
        minGap + speedBonus,
        maxGap + speedBonus
      );
    }
  }

  spawnObstacle() {
    const canSpawnPtero = this.score > 250;
    const typeRoll = this.rng.next();

    if (canSpawnPtero && typeRoll < 0.22) {
      const yOptions = [
        this.groundY - 40 * this.scale,
        this.groundY - 68 * this.scale,
        this.groundY - 92 * this.scale,
      ];

      this.obstacles.push({
        kind: "ptero",
        spriteA: "ptero1",
        spriteB: "ptero2",
        x: this.width + 40,
        y: this.rng.choice(yOptions),
        w: 46 * this.scale,
        h: 40 * this.scale,
        animFrame: 0,
        animTimer: 0,
      });

      return;
    }

    const cactusSprites = [
      "cactusSmall1",
      "cactusSmall2",
      "cactusSmall3",
      "cactusLarge1",
      "cactusLarge2",
      "cactusLarge3",
    ];

    const sprite = this.rng.choice(cactusSprites);
    const base = DinoAssets.SPRITES[sprite];

    this.obstacles.push({
      kind: "cactus",
      sprite,
      x: this.width + 40,
      y: this.groundY - base.h * this.scale,
      w: base.w * this.scale,
      h: base.h * this.scale,
    });
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

    for (const obs of this.obstacles) {
      if (obs.kind === "ptero") {
        obs.animTimer += 1;

        if (obs.animTimer > 10) {
          obs.animTimer = 0;
          obs.animFrame = 1 - obs.animFrame;
        }
      }
    }
  }

  getDinoHitbox() {
    const d = this.dino;

    if (d.isDucking) {
      return {
        x: d.x + 10,
        y: d.y + 8,
        w: d.w - 18,
        h: d.h - 12,
      };
    }

    return {
      x: d.x + 16,
      y: d.y + 8,
      w: d.w - 28,
      h: d.h - 14,
    };
  }

  getObstacleHitbox(obs) {
    if (obs.kind === "ptero") {
      return {
        x: obs.x + 8,
        y: obs.y + 8,
        w: obs.w - 16,
        h: obs.h - 16,
      };
    }

    return {
      x: obs.x + 6,
      y: obs.y + 4,
      w: obs.w - 12,
      h: obs.h - 6,
    };
  }

  checkCollision() {
    const a = this.getDinoHitbox();

    for (const obs of this.obstacles) {
      const b = this.getObstacleHitbox(obs);

      if (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      ) {
        return true;
      }
    }

    return false;
  }

  updateHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem("dinoHighScore", String(this.highScore));
    }
  }

  getNearestObstacle() {
    let nearest = null;
    let minDistance = Infinity;

    for (const obs of this.obstacles) {
      const dist = obs.x - this.dino.x;

      if (dist >= -obs.w && dist < minDistance) {
        minDistance = dist;
        nearest = obs;
      }
    }

    return nearest;
  }

  getState() {
    const nearest = this.getNearestObstacle();

    return {
      score: this.score,
      highScore: this.highScore,
      gameOver: this.gameOver,
      started: this.started,

      dino: {
        x: this.dino.x,
        y: this.dino.y,
        speed: this.speed,
        vy: this.dino.vy,
        width: this.dino.w,
        height: this.dino.h,
        isJumping: this.dino.isJumping,
        isDucking: this.dino.isDucking,
      },

      nearestObstacle: nearest
        ? {
            kind: nearest.kind,
            x: nearest.x,
            y: nearest.y,
            width: nearest.w,
            height: nearest.h,
            distance: nearest.x - this.dino.x,
          }
        : null,

      normalized: {
        speed: this.speed / this.maxSpeed,
        dinoY: this.dino.y / this.height,
        dinoVy: this.dino.vy / 20,
        obstacleDistance: nearest
          ? Math.min(1, (nearest.x - this.dino.x) / this.width)
          : 1,
        obstacleHeight: nearest ? nearest.h / 120 : 0,
        obstacleY: nearest ? nearest.y / this.height : 0,
      },
    };
  }
}

class DinoRenderer {
  constructor(canvas, assets, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.game = game;

    this.pixelRatio = window.devicePixelRatio || 1;

    this.colors = {
      bg: "#202124",
      fg: "#bdc1c6",
      dim: "rgba(189, 193, 198, 0.16)",
      text: "#9aa0a6",
    };

    this.setupCanvas();
    window.addEventListener("resize", () => this.setupCanvas());
  }

  setupCanvas() {
    const cssWidth = Math.min(window.innerWidth, 1512);
    const cssHeight = Math.round(cssWidth * (360 / 1200));

    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.style.imageRendering = "pixelated";

    this.canvas.width = Math.round(this.game.width * this.pixelRatio);
    this.canvas.height = Math.round(this.game.height * this.pixelRatio);

    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.fillStyle = this.colors.bg;
    this.ctx.fillRect(0, 0, this.game.width, this.game.height);
  }

  render() {
    this.clear();

    this.drawNightSky();
    this.drawClouds();
    this.drawGround();
    this.drawObstacles();
    this.drawDino();
    this.drawScore();

    if (this.game.gameOver) {
      this.drawGameOver();
    }
  }

  drawNightSky() {
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = 0.12;

    this.assets.draw(ctx, "moon", 190, 105, 2.2);

    for (const star of this.game.stars) {
      this.assets.draw(ctx, "star", star.x, star.y, 1.6);
    }

    ctx.restore();
  }

  drawClouds() {
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = 0.08;

    for (const cloud of this.game.clouds) {
      this.assets.draw(ctx, "cloud", cloud.x, cloud.y, 2);
    }

    ctx.restore();
  }

  drawGround() {
    const ctx = this.ctx;
    const groundSprite =
      (this.assets.sprites && this.assets.sprites.horizon) ||
      DinoAssets.SPRITES.horizon;

    if (!groundSprite) {
      // Fallback line if horizon sprite is missing
      ctx.strokeStyle = this.colors.fg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, this.game.groundY);
      ctx.lineTo(this.game.width, this.game.groundY);
      ctx.stroke();
      return;
    }

    const scale = this.game.scale;
    const sw = groundSprite.w;
    const sh = groundSprite.h;
    const dw = sw * scale;
    const dh = sh * scale;

    // Place the bottom of the horizon sprite exactly on groundY
    const y = Math.round(this.game.groundY - dh);

    // Smooth scrolling based on travelled distance
    const offset = Math.floor(this.game.distance) % dw;

    for (let x = -offset; x < this.game.width + dw; x += dw) {
      ctx.drawImage(
        this.assets.image,
        groundSprite.x,
        groundSprite.y,
        groundSprite.w,
        groundSprite.h,
        Math.round(x),
        y,
        dw,
        dh
      );
    }
  }

  drawDino() {
    const d = this.game.dino;
    let sprite = "trexIdle";

    if (this.game.gameOver) {
      sprite = "trexCrashed";
    } else if (d.isDucking) {
      sprite = d.runFrame === 0 ? "trexDuck1" : "trexDuck2";
    } else if (this.game.started) {
      sprite = d.runFrame === 0 ? "trexRun1" : "trexRun2";
    }

    this.assets.draw(this.ctx, sprite, d.x, d.y, this.game.scale);
  }

  drawObstacles() {
    const ctx = this.ctx;

    for (const obs of this.game.obstacles) {
      if (obs.kind === "ptero") {
        const sprite = obs.animFrame === 0 ? obs.spriteA : obs.spriteB;
        this.assets.draw(ctx, sprite, obs.x, obs.y, this.game.scale);
      } else {
        this.assets.draw(ctx, obs.sprite, obs.x, obs.y, this.game.scale);
      }
    }
  }

  drawScore() {
    const ctx = this.ctx;

    ctx.save();

    ctx.fillStyle = this.colors.text;
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    const score = String(this.game.score).padStart(5, "0");
    const hi = String(this.game.highScore).padStart(5, "0");

    ctx.fillText(`HI ${hi}  ${score}`, this.game.width - 52, 42);

    ctx.restore();
  }

  drawGameOver() {
    const ctx = this.ctx;

    ctx.save();

    ctx.fillStyle = this.colors.text;
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText("GAME OVER", this.game.width / 2, 142);

    this.assets.draw(
      ctx,
      "restart",
      this.game.width / 2 - 36,
      174,
      2
    );

    ctx.restore();
  }
}

(async function bootstrap() {
  const canvas = document.getElementById("gameCanvas");
  const assets = await DinoAssets.load();

  const game = new DinoGame({
    width: 1200,
    height: 360,
    groundY: 270,
    scale: 1.2,
    seed: 42,
  });

  const renderer = new DinoRenderer(canvas, assets, game);

  let lastTime = performance.now();
  let accumulator = 0;
  const fixedDelta = 1000 / 60;

  function loop(now) {
    const delta = now - lastTime;
    lastTime = now;

    accumulator += delta;

    while (accumulator >= fixedDelta) {
      game.step(0);
      accumulator -= fixedDelta;
    }

    renderer.render();

    requestAnimationFrame(loop);
  }

  setupControls(game);
  exposeRLApi(game);

  renderer.render();
  requestAnimationFrame(loop);
})();

function setupControls(game) {
  window.addEventListener("keydown", (event) => {
    const key = event.code;

    if (key === "Space" || key === "ArrowUp") {
      event.preventDefault();

      if (game.gameOver) {
        game.reset();
      } else {
        game.jump();
      }
    }

    if (key === "ArrowDown") {
      event.preventDefault();
      game.duck(true);
    }

    if (key === "KeyR") {
      event.preventDefault();
      game.reset();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowDown") {
      event.preventDefault();
      game.duck(false);
    }
  });

  window.addEventListener("pointerdown", () => {
    if (game.gameOver) {
      game.reset();
    } else {
      game.jump();
    }
  });
}

function exposeRLApi(game) {
  /*
    This API is designed for RL / GA / NEAT agents.

    Example:
      window.DinoRL.reset(123)
      const result = window.DinoRL.step(1)
      const state = window.DinoRL.getState()
  */

  window.DinoRL = {
    ACTIONS: {
      NOTHING: 0,
      JUMP: 1,
      DUCK: 2,
      RELEASE_DUCK: 3,
    },

    reset(seed = null) {
      return game.reset(seed);
    },

    step(action = 0) {
      return game.step(action);
    },

    getState() {
      return game.getState();
    },

    isDone() {
      return game.gameOver;
    },

    setSpeed(value) {
      game.speed = value;
    },

    getRawGame() {
      return game;
    },
  };
}
