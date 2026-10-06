export class LaunchKitError extends Error {
  override readonly name: string = "LaunchKitError";
}

export class LaunchConfigurationError extends LaunchKitError {
  override readonly name = "LaunchConfigurationError";
}

export class LaunchFeatureNotFoundError extends LaunchKitError {
  override readonly name = "LaunchFeatureNotFoundError";

  constructor(feature: string) {
    super(`Feature "${feature}" was not found in the LaunchKit configuration.`);
  }
}

export class LaunchRuleEvaluationError extends LaunchKitError {
  override readonly name = "LaunchRuleEvaluationError";
  readonly cause: unknown;

  constructor(rule: string, cause: unknown) {
    super(`Custom rule "${rule}" threw while evaluating access.`);
    this.cause = cause;
  }
}

export class LaunchInviteValidationError extends LaunchKitError {
  override readonly name = "LaunchInviteValidationError";
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("The invite validator threw while evaluating access.");
    this.cause = cause;
  }
}
