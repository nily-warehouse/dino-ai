import time
import numpy as np
import gymnasium as gym

from gymnasium import spaces
from playwright.sync_api import sync_playwright


class DinoBrowserEnv(gym.Env):
    metadata = {"render_modes": ["human"]}

    def __init__(
        self,
        url:str,
        headless=False,
        startup_delay=3.0,
        wait_for_enter=False,
        step_delay=0.02,
    ):
        super().__init__()

        self.url = url
        self.headless = headless
        self.startup_delay = startup_delay
        self.wait_for_enter = wait_for_enter
        self.step_delay = step_delay

        self.has_waited_for_startup = False

        self.action_space = spaces.Discrete(3)

        self.observation_space = spaces.Box(
            low=np.array([0, 0, -5, -1, 0, 0, 0, 0, 0], dtype=np.float32),
            high=np.array([1, 1, 5, 1, 3, 1, 1, 1, 1], dtype=np.float32),
            dtype=np.float32,
        )

        self.playwright = sync_playwright().start()

        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )

        self.page = self.browser.new_page(
            viewport={"width": 1200, "height": 360}
        )

        self.page.goto(self.url)
        self.page.wait_for_function("() => window.DinoRL !== undefined")

    def _wait_before_first_start(self):
        if self.has_waited_for_startup:
            return

        if self.startup_delay > 0:
            time.sleep(self.startup_delay)

        self.has_waited_for_startup = True

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

        self._wait_before_first_start()

        state = self.page.evaluate(
            """
            (seed) => {
                return window.DinoRL.reset(seed);
            }
            """,
            None if seed is None else int(seed),
        )

        obs = self._state_to_obs(state)

        return obs, {"raw_state": state}

    def step(self, action):
        result = self.page.evaluate(
            """
            (action) => {
                return window.DinoRL.step(action);
            }
            """,
            int(action),
        )

        if self.step_delay > 0:
            time.sleep(self.step_delay)

        state = result["state"]
        reward = float(result["reward"])
        terminated = bool(result["done"])
        truncated = False

        obs = self._state_to_obs(state)

        info = {
            "raw_state": state,
            "score": state["score"],
        }

        return obs, reward, terminated, truncated, info

    def render(self):
        pass

    def close(self):
        try:
            self.page.close()
            self.browser.close()
            self.playwright.stop()
        except Exception:
            pass
