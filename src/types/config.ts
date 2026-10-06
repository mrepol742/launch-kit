import type { LaunchUser } from "./user.js";

export type DateInput = string | Date;

export interface CohortDefinition {
  roles?: readonly string[];
  plans?: readonly string[];
  tags?: readonly string[];
  emails?: readonly string[];
  emailDomains?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ScheduledRollout {
  percentage: number;
  at: DateInput;
}

export type RolloutConfig = number | readonly ScheduledRollout[];

export interface RuleContext<
  User extends LaunchUser = LaunchUser,
  Context = unknown,
  PhaseName extends string = string,
> {
  user: User;
  phase: PhaseName;
  now: Date;
  context: Context | undefined;
}

export type CustomRule<
  User extends LaunchUser = LaunchUser,
  Context = unknown,
  PhaseName extends string = string,
> = (input: RuleContext<User, Context, PhaseName>) => boolean | Promise<boolean>;

export interface InviteContext<
  User extends LaunchUser = LaunchUser,
  PhaseName extends string = string,
> {
  code: string;
  user: User;
  phase: PhaseName;
}

export interface InviteConfig<User extends LaunchUser = LaunchUser> {
  validate: (input: InviteContext<User>) => boolean | Promise<boolean>;
}

/** A phase can reference cohorts and can also contain simple access criteria directly. */
export interface PhaseConfig extends CohortDefinition {
  from?: DateInput;
  until?: DateInput;
  allow?: readonly string[];
  rules?: readonly string[];
  inviteRequired?: boolean;
  rollout?: RolloutConfig;
}

export interface FeatureConfig {
  id?: string;
  phases: Readonly<Record<string, PhaseConfig>>;
}

export interface LaunchConfig<User extends LaunchUser = LaunchUser, Context = unknown> {
  id?: string;
  cohorts?: Readonly<Record<string, CohortDefinition>>;
  rules?: Readonly<Record<string, CustomRule<User, Context>>>;
  invite?: InviteConfig<User>;
  phases?: Readonly<Record<string, PhaseConfig>>;
  features?: Readonly<Record<string, FeatureConfig>>;
}

export interface LaunchOptions {
  now?: () => Date;
}
