export type AccessReason =
  | "ALLOWED"
  | "PUBLIC"
  | "NO_ACTIVE_PHASE"
  | "NOT_IN_COHORT"
  | "ROLE_REQUIRED"
  | "PLAN_REQUIRED"
  | "EMAIL_NOT_ALLOWED"
  | "INVITE_REQUIRED"
  | "INVALID_INVITE"
  | "ROLLOUT_EXCLUDED"
  | "METADATA_MISMATCH"
  | "CUSTOM_RULE_DENIED";

export interface AccessDecision<PhaseName extends string = string> {
  allowed: boolean;
  reason: AccessReason;
  /** A stable, human-readable explanation. Do not branch application logic on this text. */
  message: string;
  phase: PhaseName | null;
  nextPhase?: PhaseName;
  nextPhaseAt?: string;
  rollout?: {
    bucket: number;
    percentage: number;
  };
}

export interface AccessOptions<Context = unknown> {
  inviteCode?: string;
  context?: Context;
  /** Used for deterministic rollouts when the user does not have a stable id. */
  identifier?: string;
}
