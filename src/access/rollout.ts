import type { RolloutConfig, ScheduledRollout } from "../types/config.js";
import { bucket } from "../utils/hash.js";

export interface RolloutResult {
  included: boolean;
  percentage: number;
  bucket: number;
}

export function rolloutPercentage(rollout: RolloutConfig, now: Date): number {
  if (typeof rollout === "number") return rollout;
  let percentage = 0;
  for (const step of rollout) {
    if (new Date(step.at).getTime() <= now.getTime()) percentage = step.percentage;
    else break;
  }
  return percentage;
}

export function evaluateRollout(
  rollout: RolloutConfig,
  key: string,
  now: Date,
): RolloutResult {
  const percentage = rolloutPercentage(rollout, now);
  const assignedBucket = bucket(key);
  return {
    included: assignedBucket < percentage,
    percentage,
    bucket: assignedBucket,
  };
}

export function sortRollout(rollout: RolloutConfig): RolloutConfig {
  if (typeof rollout === "number") return rollout;
  return [...rollout].sort(
    (left: ScheduledRollout, right: ScheduledRollout) =>
      new Date(left.at).getTime() - new Date(right.at).getTime(),
  );
}
