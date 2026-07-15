import json
import subprocess
from pathlib import Path

import numpy as np
import gymnasium as gym

from gymnasium import spaces


class DinoLogicEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(
        self,
        node_runner_path="dino_node_runner.js",
        seed=1,
        width=1200,
        height=360,
        ground_y=270,
        scale=1,
    ):
        super().__init__()

        requested_runner_path = Path(node_runner_path)
        if not requested_runner_path.is_absolute():
            requested_runner_path = Path(__file__).resolve().parent / requested_runner_path
        self.node_runner_path = requested_runner_path
        self.initial_seed = seed
        self.options = {
            "width": width,
            "height": height,
            "groundY": ground_y,
            "scale": scale,
        }

        self.action_space = spaces.Discrete(3)

        self.observation_space = spaces.Box(
            low=np.array([0, 0, -5, -1, 0, 0, 0, 0, 0], dtype=np.float32),
            high=np.array([1, 1, 5, 1, 3, 1, 1, 1, 1], dtype=np.float32),
            dtype=np.float32,
        )

        self.process = subprocess.Popen(
            ["node", str(self.node_runner_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        self._closed = False

    def _request(self, message):
        if self._closed:
            raise RuntimeError("Environment is already closed.")

        self.process.stdin.write(json.dumps(message) + "\n")
        self.process.stdin.flush()

        line = self.process.stdout.readline()

        if not line:
            stderr = self.process.stderr.read()
            raise RuntimeError(f"Node runner stopped unexpectedly.\n{stderr}")

        response = json.loads(line)

        if not response.get("ok"):
            raise RuntimeError(response.get("error", "Unknown Node runner error."))

        return response

    def _state_to_obs(self, state):
        normalized = state["normalized"]
        dino = state["dino"]

        return np.array(
            [
                normalized["speed"],
                normalized["dinoY"],
                normalized["dinoVy"],
                normalized["obstacleDistance"],
                normalized["obstacleHeight"],
                normalized["obstacleY"],
                normalized["obstacleIsPtero"],
                1.0 if dino["isJumping"] else 0.0,
                1.0 if dino["isDucking"] else 0.0,
            ],
            dtype=np.float32,
        )

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        actual_seed = self.initial_seed if seed is None else int(seed)

        response = self._request(
            {
                "type": "reset",
                "seed": actual_seed,
                "options": self.options,
            }
        )

        state = response["state"]
        obs = self._state_to_obs(state)

        return obs, {"raw_state": state}

    def step(self, action):
        response = self._request(
            {
                "type": "step",
                "action": int(action),
            }
        )

        result = response["result"]
        state = result["state"]

        obs = self._state_to_obs(state)
        reward = float(result["reward"])
        terminated = bool(result["done"])
        truncated = False

        info = {
            "raw_state": state,
            "score": state["score"],
            "frame": state["frame"],
            "distance": state["distance"],
        }

        return obs, reward, terminated, truncated, info

    def render(self):
        pass

    def close(self):
        if self._closed:
            return

        try:
            self._request({"type": "close"})
        except Exception:
            pass

        try:
            self.process.terminate()
        except Exception:
            pass

        self._closed = True
