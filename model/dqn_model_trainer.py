import sys

from stable_baselines3 import DQN
from stable_baselines3.common.monitor import Monitor

from dino_logic_env import DinoLogicEnv

MODEL_PATH = "../data/" + sys.argv[1]

def make_env(seed=42):
    env = DinoLogicEnv(
        node_runner_path="dino_node_runner.js",
        seed=seed,
    )

    env = Monitor(env)
    return env

def train():
    env = make_env(seed=42)

    model = DQN(
        policy="MlpPolicy",
        env=env,
        learning_rate=1e-4,
        buffer_size=100_000,
        learning_starts=5_000,
        batch_size=64,
        gamma=0.99,
        train_freq=4,
        target_update_interval=1_000,
        exploration_fraction=0.35,
        exploration_initial_eps=1.0,
        exploration_final_eps=0.03,
        verbose=1,
    )

    model.learn(
        total_timesteps=100_000,
        log_interval=4,
    )

    model.save(MODEL_PATH)

    env.close()

    print(f"Model saved to: {MODEL_PATH}")

def evaluate(seed=42, episodes=5):
    env = make_env(seed=seed)

    model = DQN.load(MODEL_PATH, env=env)

    for episode in range(episodes):
        obs, info = env.reset(seed=seed + episode)

        done = False
        total_reward = 0

        print(f"\nEpisode {episode + 1}")

        while not done:
            action, _states = model.predict(obs, deterministic=True)

            obs, reward, terminated, truncated, info = env.step(action)

            total_reward += reward
            done = terminated or truncated

            print(
                "score:",
                info["score"],
                "frame:",
                info["frame"],
                "action:",
                int(action),
                "reward:",
                reward,
            )

        print("final score:", info["score"])
        print("total reward:", total_reward)

    env.close()

if __name__ == "__main__":
    train()
    evaluate(seed=42, episodes=3)