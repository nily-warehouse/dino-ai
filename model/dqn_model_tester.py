import sys

from stable_baselines3 import DQN
from dino_ui_env import DinoBrowserEnv

MODEL_PATH = "../data/" + sys.argv[1]

env = DinoBrowserEnv(
    url="http://localhost:8000/src/index.html?rl=1",
    headless=False,
    wait_for_enter=True,
)

model = DQN.load(MODEL_PATH, env=env)

obs, info = env.reset()
done = False
total_reward = 0

while not done:

    action, _states = model.predict(obs, deterministic=True)
    obs, reward, terminated, truncated, info = env.step(int(action))
    total_reward += reward
    done = terminated or truncated

    print(
        "score:",
        info["score"],
        "action:",
        int(action),
        "reward:",
        reward,
    )

print("final score:", info["score"])
print("total reward:", total_reward)

env.close()