import { createClock } from "./time/clock.js";
import type { LaunchConfig, LaunchOptions } from "./types/config.js";
import type { LaunchUser } from "./types/user.js";
import { LaunchKit } from "./core/launch.js";
import { validateConfig } from "./validation/config.js";

export function createLaunch<
  User extends LaunchUser = LaunchUser,
  Context = unknown,
  const Config extends LaunchConfig<User, Context> = LaunchConfig<User, Context>,
>(config: Config, options: LaunchOptions = {}): LaunchKit<Config, User, Context> {
  const validated = validateConfig(config);
  const clock = createClock(options.now);
  return new LaunchKit(validated.root as never, config, clock, validated.features);
}

export { bucket, stableHash } from "./utils/hash.js";
export {
  LaunchConfigurationError,
  LaunchFeatureNotFoundError,
  LaunchInviteValidationError,
  LaunchKitError,
  LaunchRuleEvaluationError,
} from "./errors/index.js";
export type { AccessDecision, AccessOptions, AccessReason } from "./types/access.js";
export type {
  CohortDefinition,
  CustomRule,
  DateInput,
  FeatureConfig,
  InviteConfig,
  InviteContext,
  LaunchConfig,
  LaunchOptions,
  PhaseConfig,
  RolloutConfig,
  RuleContext,
  ScheduledRollout,
} from "./types/config.js";
export type { PhaseStatus, TimelineEntry } from "./types/phase.js";
export type { LaunchUser } from "./types/user.js";
