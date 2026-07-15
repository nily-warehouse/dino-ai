const readline = require("readline");
const { DinoGame, ACTIONS } = require("../src/game.js");

let game = null;

function createGame(seed = 1, options = {}) {
  game = new DinoGame({
    seed,
    width: options.width || 1200,
    height: options.height || 360,
    groundY: options.groundY || 270,
    scale: options.scale || 1,
  });

  return game.getState();
}

function reset(seed = null, options = {}) {
  if (!game) {
    return createGame(seed ?? 1, options);
  }

  return game.reset(seed);
}

function step(action) {
  if (!game) {
    createGame(1);
  }

  return game.step(action);
}

function writeResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  try {
    const message = JSON.parse(line);

    if (message.type === "reset") {
      const state = reset(message.seed ?? null, message.options || {});
      writeResponse({
        ok: true,
        type: "reset",
        state,
      });
      return;
    }

    if (message.type === "step") {
      const result = step(message.action ?? ACTIONS.RUN);
      writeResponse({
        ok: true,
        type: "step",
        result,
      });
      return;
    }

    if (message.type === "close") {
      writeResponse({
        ok: true,
        type: "close",
      });
      process.exit(0);
      return;
    }

    writeResponse({
      ok: false,
      error: `Unknown message type: ${message.type}`,
    });
  } catch (error) {
    writeResponse({
      ok: false,
      error: error.message,
      stack: error.stack,
    });
  }
});
