import random
from dino_ui_env import DinoBrowserEnv

env = DinoBrowserEnv(
    url="http://localhost:8000/src/index.html?rl=1",
    headless=False,
    wait_for_enter=True
)

obs, info = env.reset(seed=42)
done = False

while not done:

    # a random selection just for test
    action = random.randint(0, 2)
    
    obs, reward, terminated, truncated, info = env.step(action)
    done = terminated or truncated

    print("score:", info["score"], "action:", action, "reward:", reward)

env.close()