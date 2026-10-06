import { LaunchConfigurationError } from "../errors/index.js";
import type {
  CohortDefinition,
  DateInput,
  LaunchConfig,
  PhaseConfig,
  RolloutConfig,
} from "../types/config.js";
import type { LaunchUser } from "../types/user.js";
import { isValidEmail, normalizeDomain } from "../access/email.js";
import { sortRollout } from "../access/rollout.js";
import type { CompiledLaunch, CompiledPhase } from "../core/compiled.js";

function fail(path: string, detail: string): never {
  throw new LaunchConfigurationError(`${path}: ${detail}`);
}

function parseDate(value: DateInput, path: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) fail(path, `invalid date ${JSON.stringify(value)}.`);
  return date;
}

function validatePercentage(value: number, path: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    fail(
      path,
      `rollout percentage must be between 0 and 100; received ${String(value)}.`,
    );
  }
}

function validateRollout(rollout: RolloutConfig, path: string): RolloutConfig {
  if (typeof rollout === "number") {
    validatePercentage(rollout, path);
    return rollout;
  }
  if (rollout.length === 0)
    fail(path, "scheduled rollout must contain at least one step.");
  let previousAt = Number.NEGATIVE_INFINITY;
  let previousPercentage = 0;
  for (const [index, step] of rollout.entries()) {
    validatePercentage(step.percentage, `${path}[${index}].percentage`);
    const at = parseDate(step.at, `${path}[${index}].at`).getTime();
    if (at <= previousAt)
      fail(path, "scheduled rollout steps must be in ascending time order.");
    if (step.percentage < previousPercentage) {
      fail(path, "scheduled rollout percentages must not decrease.");
    }
    previousAt = at;
    previousPercentage = step.percentage;
  }
  return sortRollout(rollout);
}

function validateCriteria(criteria: CohortDefinition, path: string): void {
  for (const [index, email] of (criteria.emails ?? []).entries()) {
    if (!isValidEmail(email.replace(/^\*@/, "wildcard@"))) {
      fail(`${path}.emails[${index}]`, `invalid email ${JSON.stringify(email)}.`);
    }
  }
  for (const [index, domain] of (criteria.emailDomains ?? []).entries()) {
    const normalized = normalizeDomain(domain);
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(normalized)) {
      fail(
        `${path}.emailDomains[${index}]`,
        `invalid email domain ${JSON.stringify(domain)}.`,
      );
    }
  }
}

function compilePhases(
  phases: Readonly<Record<string, PhaseConfig>>,
  config: {
    cohorts?: Readonly<Record<string, CohortDefinition>>;
    rules?: Readonly<Record<string, unknown>>;
    invite?: unknown;
  },
  path: string,
): readonly CompiledPhase[] {
  const names = Object.keys(phases);
  const normalizedNames = new Set<string>();
  const compiled = names.map((name) => {
    if (!name.trim()) fail(path, "phase names cannot be empty.");
    const normalized = name.toLowerCase();
    if (normalizedNames.has(normalized)) fail(path, `duplicate phase name "${name}".`);
    normalizedNames.add(normalized);
    const phase = phases[name];
    if (!phase) fail(`${path}.${name}`, "phase configuration is missing.");
    validateCriteria(phase, `${path}.${name}`);
    for (const cohort of phase.allow ?? []) {
      if (cohort !== "everyone" && !config.cohorts?.[cohort]) {
        fail(`${path}.${name}.allow`, `unknown cohort "${cohort}".`);
      }
    }
    for (const rule of phase.rules ?? []) {
      if (!config.rules?.[rule])
        fail(`${path}.${name}.rules`, `unknown custom rule "${rule}".`);
    }
    if (phase.inviteRequired && !config.invite) {
      fail(`${path}.${name}.inviteRequired`, "an invite validator must be configured.");
    }
    const from =
      phase.from === undefined
        ? undefined
        : parseDate(phase.from, `${path}.${name}.from`);
    const until =
      phase.until === undefined
        ? undefined
        : parseDate(phase.until, `${path}.${name}.until`);
    if (from && until && until.getTime() <= from.getTime()) {
      fail(`${path}.${name}`, "phase end must be after phase start.");
    }
    const normalizedPhase: PhaseConfig = {
      ...phase,
      ...(phase.rollout === undefined
        ? {}
        : { rollout: validateRollout(phase.rollout, `${path}.${name}.rollout`) }),
    };
    return {
      name,
      config: normalizedPhase,
      ...(from ? { from } : {}),
      ...(until ? { until } : {}),
    };
  });

  compiled.sort((left, right) => {
    const difference =
      (left.from?.getTime() ?? Number.NEGATIVE_INFINITY) -
      (right.from?.getTime() ?? Number.NEGATIVE_INFINITY);
    return difference || names.indexOf(left.name) - names.indexOf(right.name);
  });
  for (let index = 1; index < compiled.length; index += 1) {
    const previous = compiled[index - 1];
    const current = compiled[index];
    if (!previous || !current) continue;
    if (
      !previous.until ||
      !current.from ||
      previous.until.getTime() > current.from.getTime()
    ) {
      fail(path, `phases "${previous.name}" and "${current.name}" overlap.`);
    }
  }
  return compiled;
}

export interface ValidatedConfig<
  User extends LaunchUser = LaunchUser,
  Context = unknown,
> {
  config: LaunchConfig<User, Context>;
  root: CompiledLaunch;
  features: Readonly<Record<string, CompiledLaunch>>;
}

export function validateConfig<User extends LaunchUser, Context>(
  config: LaunchConfig<User, Context>,
): ValidatedConfig<User, Context> {
  if (!config || typeof config !== "object") fail("config", "expected an object.");
  for (const [name, cohort] of Object.entries(config.cohorts ?? {})) {
    validateCriteria(cohort, `cohorts.${name}`);
  }
  if (!config.phases && !config.features) {
    fail("config", "at least one product phase or feature must be configured.");
  }
  const id = config.id?.trim() || "launchkit";
  const root: CompiledLaunch = {
    id,
    phases: compilePhases(config.phases ?? {}, config, "phases"),
  };
  const features: Record<string, CompiledLaunch> = {};
  for (const [name, feature] of Object.entries(config.features ?? {})) {
    if (!name.trim()) fail("features", "feature names cannot be empty.");
    features[name] = {
      id: feature.id?.trim() || `${id}:${name}`,
      phases: compilePhases(feature.phases, config, `features.${name}.phases`),
    };
  }
  return { config, root, features };
}
