/* Optional browser UI adapter for DinoCore. */

const DinoCoreApi = globalThis.DinoCore;

class DinoRenderer {
  constructor(canvas, assets, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.game = game;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.colors = { bg: "#202124", fg: "#bdc1c6", text: "#9aa0a6" };
    this.setupCanvas();
    window.addEventListener("resize", () => this.setupCanvas());
  }

  setupCanvas() {
    const cssWidth = Math.min(window.innerWidth, 1512);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${Math.round(cssWidth * (360 / 1200))}px`;
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.width = Math.round(this.game.width * this.pixelRatio);
    this.canvas.height = Math.round(this.game.height * this.pixelRatio);
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  render() {
    this.clear();
    this.drawStars();
    this.drawMoon();
    this.drawClouds();
    this.drawGround();
    this.drawObstacles();
    this.drawDino();
    this.drawScore();
    if (this.game.gameOver) this.drawGameOver();
  }

  clear() {
    this.ctx.fillStyle = this.colors.bg;
    this.ctx.fillRect(0, 0, this.game.width, this.game.height);
  }

  drawStars() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.12;
    for (const star of this.game.stars) this.assets.draw(this.ctx, "star", star.x, star.y, 1.6);
    this.ctx.restore();
  }

  drawMoon() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.12;
    this.assets.draw(this.ctx, "moon", 190, 105, 2.2);
    this.ctx.restore();
  }

  drawClouds() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.08;
    for (const cloud of this.game.clouds) this.assets.draw(this.ctx, "cloud", cloud.x, cloud.y, 2);
    this.ctx.restore();
  }

  drawGround() {
    const ground = this.assets.sprites.horizon;
    if (!ground) {
      this.ctx.strokeStyle = this.colors.fg;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.game.groundY);
      this.ctx.lineTo(this.game.width, this.game.groundY);
      this.ctx.stroke();
      return;
    }
    const scale = this.game.scale;
    const drawWidth = ground.w * scale;
    const drawHeight = ground.h * scale;
    const y = Math.round(this.game.groundY - drawHeight);
    const offset = Math.floor(this.game.distance) % drawWidth;
    for (let x = -offset; x < this.game.width + drawWidth; x += drawWidth) {
      this.ctx.drawImage(this.assets.image, ground.x, ground.y, ground.w, ground.h,
        Math.round(x), y, drawWidth, drawHeight);
    }
  }

  drawDino() {
    const dino = this.game.dino;
    let sprite = "trexIdle";
    let drawY = dino.y;
    if (this.game.gameOver) {
      sprite = "trexCrashed";
      if (dino.y >= this.game.groundY - dino.h) drawY = this.game.groundY - 47 * this.game.scale;
    } else if (dino.isDucking) {
      sprite = dino.runFrame === 0 ? "trexDuck1" : "trexDuck2";
    } else if (dino.isJumping) {
      sprite = "trexIdle";
    } else if (this.game.started) {
      sprite = dino.runFrame === 0 ? "trexRun1" : "trexRun2";
    }
    this.assets.draw(this.ctx, sprite, dino.x, drawY, this.game.scale);
  }

  drawObstacles() {
    for (const obstacle of this.game.obstacles) {
      if (obstacle.kind === "ptero") {
        const sprite = obstacle.animFrame === 0 ? obstacle.spriteA : obstacle.spriteB;
        this.assets.draw(this.ctx, sprite, obstacle.x, obstacle.y, this.game.scale);
      } else {
        this.assets.draw(this.ctx, obstacle.sprite, obstacle.x, obstacle.y, obstacle.drawScale || this.game.scale);
      }
    }
  }

  drawScore() {
    this.ctx.save();
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = "bold 28px monospace";
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "top";
    this.ctx.fillText(`HI ${String(this.game.highScore).padStart(5, "0")}  ${String(this.game.score).padStart(5, "0")}`,
      this.game.width - 52, 42);
    this.ctx.restore();
  }

  drawGameOver() {
    this.ctx.save();
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = "bold 30px monospace";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("GAME OVER", this.game.width / 2, 142);
    this.assets.draw(this.ctx, "restart", this.game.width / 2 - 36, 174, 2);
    this.ctx.restore();
  }
}

function setupControls(game) {
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      if (game.gameOver) game.reset();
      else game.jump();
    } else if (event.code === "ArrowDown") {
      event.preventDefault();
      if (!game.gameOver) game.duck(true);
    } else if (event.code === "KeyR") {
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
    if (game.gameOver) game.reset();
    else game.jump();
  });
}

function exposeApis(game) {
  globalThis.DinoGameAPI = {
    start: () => game.start(),
    jump: () => game.jump(),
    duck: () => game.duck(true),
    releaseDuck: () => game.duck(false),
    restart: (seed = null) => game.reset(seed),
    getState: () => game.getState(),
    isGameOver: () => game.gameOver,
    isStarted: () => game.started,
  };
  globalThis.DinoRL = {
    ACTIONS: DinoCoreApi.ACTIONS,
    reset: (seed = null) => game.reset(seed),
    step: (action = DinoCoreApi.ACTIONS.RUN) => game.step(action),
    getState: () => game.getState(),
    isDone: () => game.gameOver,
  };
}

async function startDinoUi() {
  const canvas = document.getElementById("gameCanvas");
  const assets = await globalThis.DinoAssets.load();
  const rlMode = new URLSearchParams(window.location.search).get("rl") === "1";
  const game = new DinoCoreApi.DinoGame({
    width: 1200, height: 360, groundY: 270, scale: 1.2, seed: 42,
    getHighScore: () => localStorage.getItem("dinoHighScore"),
    saveHighScore: (score) => localStorage.setItem("dinoHighScore", String(score)),
  });
  const renderer = new DinoRenderer(canvas, assets, game);
  let lastTime = performance.now();
  let accumulator = 0;
  const fixedDelta = 1000 / 60;
  function loop(now) {
    const delta = Math.min(now - lastTime, fixedDelta * 5);
    lastTime = now;
    accumulator += delta;
    while (accumulator >= fixedDelta) {
      if (!rlMode) game.updateFrame();
      accumulator -= fixedDelta;
    }
    renderer.render();
    requestAnimationFrame(loop);
  }
  setupControls(game);
  exposeApis(game);
  renderer.render();
  requestAnimationFrame(loop);
  return { game, renderer };
}

if (typeof document !== "undefined") startDinoUi();
