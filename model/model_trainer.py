import random

from dino_logic_env import DinoLogicEnv

env = DinoLogicEnv(
    node_runner_path="dino_node_runner.js",
    seed=42,
)

obs, info = env.reset(seed=42)

done = False
total_reward = 0

while not done:

    # a random selection just for test
    action = random.randint(0, 2)

    obs, reward, terminated, truncated, info = env.step(action)
    total_reward += reward
    done = terminated or truncated

    print(
        "score:",
        info["score"],
        "frame:",
        info["frame"],
        "action:",
        action,
        "reward:",
        reward,
    )

print("final score:", info["score"])
print("total reward:", total_reward)

env.close()