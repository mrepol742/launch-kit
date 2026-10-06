import { matchCriteria } from "../access/cohorts.js";
import { evaluateRollout, rolloutPercentage } from "../access/rollout.js";
import {
  LaunchFeatureNotFoundError,
  LaunchInviteValidationError,
  LaunchRuleEvaluationError,
} from "../errors/index.js";
import type { AccessDecision, AccessOptions, AccessReason } from "../types/access.js";
import type { LaunchConfig, PhaseConfig } from "../types/config.js";
import type { TimelineEntry } from "../types/phase.js";
import type { LaunchUser } from "../types/user.js";
import type { Clock } from "../time/clock.js";
import type { CompiledLaunch, CompiledPhase } from "./compiled.js";

const messages: Record<AccessReason, string> = {
  ALLOWED: "Access granted.",
  PUBLIC: "Access granted because the active phase is public.",
  NO_ACTIVE_PHASE: "Access denied because no launch phase is currently active.",
  NOT_IN_COHORT: "Access denied because the user does not belong to an allowed cohort.",
  ROLE_REQUIRED: "Access denied because the user does not have a required role.",
  PLAN_REQUIRED: "Access denied because the user is not on a required plan.",
  EMAIL_NOT_ALLOWED: "Access denied because the user's email is not allowed.",
  INVITE_REQUIRED: "Access denied because an invite code is required.",
  INVALID_INVITE: "Access denied because the invite code is invalid.",
  ROLLOUT_EXCLUDED: "Access denied because the user is not included in the rollout.",
  METADATA_MISMATCH: "Access denied because the user's metadata does not match.",
  CUSTOM_RULE_DENIED: "Access denied by a custom rule.",
};

function isActive(phase: CompiledPhase, time: number): boolean {
  return (
    (phase.from?.getTime() ?? Number.NEGATIVE_INFINITY) <= time &&
    time < (phase.until?.getTime() ?? Number.POSITIVE_INFINITY)
  );
}

function hasCriteria(config: PhaseConfig): boolean {
  return Boolean(
    config.roles ||
    config.plans ||
    config.tags ||
    config.emails ||
    config.emailDomains ||
    config.metadata,
  );
}

export class LaunchController<
  PhaseName extends string,
  User extends LaunchUser = LaunchUser,
  Context = unknown,
> {
  constructor(
    private readonly compiled: CompiledLaunch<PhaseName>,
    private readonly config: LaunchConfig<User, Context>,
    private readonly clock: Clock,
  ) {}

  private current(now = this.clock.now()): CompiledPhase<PhaseName> | undefined {
    return this.compiled.phases.find((phase) => isActive(phase, now.getTime()));
  }

  phase(): PhaseName | null {
    return this.current()?.name ?? null;
  }

  is(phase: PhaseName): boolean {
    return this.phase() === phase;
  }

  hasStarted(): boolean {
    const first = this.compiled.phases[0];
    return Boolean(
      first && (!first.from || this.clock.now().getTime() >= first.from.getTime()),
    );
  }

  hasEnded(): boolean {
    const last = this.compiled.phases.at(-1);
    return Boolean(last?.until && this.clock.now().getTime() >= last.until.getTime());
  }

  previousPhase(): PhaseName | null {
    const now = this.clock.now();
    const active = this.current(now);
    if (active) {
      const index = this.compiled.phases.indexOf(active);
      return this.compiled.phases[index - 1]?.name ?? null;
    }
    return (
      [...this.compiled.phases]
        .reverse()
        .find((phase) => phase.until && phase.until.getTime() <= now.getTime())?.name ??
      null
    );
  }

  nextPhase(): PhaseName | null {
    return this.next(this.clock.now())?.name ?? null;
  }

  private next(now: Date): CompiledPhase<PhaseName> | undefined {
    const active = this.current(now);
    if (active) {
      return this.compiled.phases[this.compiled.phases.indexOf(active) + 1];
    }
    return this.compiled.phases.find(
      (phase) => phase.from && phase.from.getTime() > now.getTime(),
    );
  }

  timeline(): readonly TimelineEntry<PhaseName>[] {
    const now = this.clock.now();
    return this.compiled.phases.map((phase) => {
      const active = isActive(phase, now.getTime());
      const completed = Boolean(phase.until && phase.until.getTime() <= now.getTime());
      return {
        name: phase.name,
        status: active ? "active" : completed ? "completed" : "upcoming",
        ...(phase.from ? { from: phase.from.toISOString() } : {}),
        ...(phase.until ? { until: phase.until.toISOString() } : {}),
        ...(phase.config.rollout === undefined
          ? {}
          : { rollout: rolloutPercentage(phase.config.rollout, now) }),
      };
    });
  }

  async canAccess(
    user: User,
    options: AccessOptions<Context> = {},
  ): Promise<AccessDecision<PhaseName>> {
    const now = this.clock.now();
    const phase = this.current(now);
    if (!phase) return this.decision(false, "NO_ACTIVE_PHASE", null, now);

    const direct = matchCriteria(user, phase.config);
    if (hasCriteria(phase.config) && !direct.matches) {
      return this.decision(false, direct.reason ?? "NOT_IN_COHORT", phase.name, now);
    }

    const allowedCohorts = phase.config.allow ?? [];
    const isPublic = allowedCohorts.includes("everyone");
    if (allowedCohorts.length > 0 && !isPublic) {
      const matched = allowedCohorts.some((name) => {
        const cohort = this.config.cohorts?.[name];
        return cohort ? matchCriteria(user, cohort).matches : false;
      });
      if (!matched) return this.decision(false, "NOT_IN_COHORT", phase.name, now);
    }

    if (phase.config.inviteRequired) {
      if (!options.inviteCode) {
        return this.decision(false, "INVITE_REQUIRED", phase.name, now);
      }
      let valid: boolean;
      try {
        valid = Boolean(
          await this.config.invite?.validate({
            code: options.inviteCode,
            user,
            phase: phase.name,
          }),
        );
      } catch (error) {
        throw new LaunchInviteValidationError(error);
      }
      if (!valid) return this.decision(false, "INVALID_INVITE", phase.name, now);
    }

    for (const ruleName of phase.config.rules ?? []) {
      const rule = this.config.rules?.[ruleName];
      try {
        if (
          !(await rule?.({
            user,
            phase: phase.name,
            now: new Date(now),
            context: options.context,
          }))
        ) {
          return this.decision(false, "CUSTOM_RULE_DENIED", phase.name, now);
        }
      } catch (error) {
        throw new LaunchRuleEvaluationError(ruleName, error);
      }
    }

    if (phase.config.rollout !== undefined) {
      const identifier = options.identifier?.trim() || user.id?.trim();
      if (!identifier) return this.decision(false, "ROLLOUT_EXCLUDED", phase.name, now);
      const rollout = evaluateRollout(
        phase.config.rollout,
        `${this.compiled.id}:${phase.name}:${identifier}`,
        now,
      );
      if (!rollout.included) {
        return {
          ...this.decision(false, "ROLLOUT_EXCLUDED", phase.name, now),
          rollout: { bucket: rollout.bucket, percentage: rollout.percentage },
        };
      }
      return {
        ...this.decision(true, isPublic ? "PUBLIC" : "ALLOWED", phase.name, now),
        rollout: { bucket: rollout.bucket, percentage: rollout.percentage },
      };
    }

    return this.decision(true, isPublic ? "PUBLIC" : "ALLOWED", phase.name, now);
  }

  private decision(
    allowed: boolean,
    reason: AccessReason,
    phase: PhaseName | null,
    now: Date,
  ): AccessDecision<PhaseName> {
    const next = this.next(now);
    return {
      allowed,
      reason,
      message: messages[reason],
      phase,
      ...(next ? { nextPhase: next.name } : {}),
      ...(next?.from ? { nextPhaseAt: next.from.toISOString() } : {}),
    };
  }
}

type StringKey<T> = Extract<keyof T, string>;
type PhaseNames<T> = T extends { phases: infer P } ? StringKey<P> : never;
type FeatureMap<T> = T extends { features: infer F } ? F : Record<never, never>;

export class LaunchKit<
  Config extends LaunchConfig<User, Context>,
  User extends LaunchUser = LaunchUser,
  Context = unknown,
> extends LaunchController<PhaseNames<Config>, User, Context> {
  constructor(
    root: CompiledLaunch<PhaseNames<Config>>,
    config: Config,
    clock: Clock,
    private readonly compiledFeatures: Readonly<Record<string, CompiledLaunch>>,
  ) {
    super(root, config, clock);
    this.sourceConfig = config;
    this.sourceClock = clock;
  }

  private readonly sourceConfig: Config;
  private readonly sourceClock: Clock;

  feature<Name extends StringKey<FeatureMap<Config>>>(
    name: Name,
  ): LaunchController<PhaseNames<FeatureMap<Config>[Name]>, User, Context> {
    const feature = this.compiledFeatures[name];
    if (!feature) throw new LaunchFeatureNotFoundError(name);
    return new LaunchController(
      feature as CompiledLaunch<PhaseNames<FeatureMap<Config>[Name]>>,
      this.sourceConfig,
      this.sourceClock,
    );
  }
}
