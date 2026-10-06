import type { AccessReason } from "../types/access.js";
import type { CohortDefinition } from "../types/config.js";
import type { LaunchUser } from "../types/user.js";
import { matchesEmail } from "./email.js";
import { matchesMetadata } from "./metadata.js";

export interface MatchResult {
  matches: boolean;
  reason?: AccessReason;
}

function overlaps(
  actual: readonly string[] | undefined,
  expected: readonly string[],
): boolean {
  return Boolean(actual?.some((value) => expected.includes(value)));
}

export function matchCriteria(user: LaunchUser, criteria: CohortDefinition): MatchResult {
  if (criteria.roles && !overlaps(user.roles, criteria.roles))
    return { matches: false, reason: "ROLE_REQUIRED" };

  if (criteria.plans && (!user.plan || !criteria.plans.includes(user.plan)))
    return { matches: false, reason: "PLAN_REQUIRED" };

  if (criteria.tags && !overlaps(user.tags, criteria.tags))
    return { matches: false, reason: "NOT_IN_COHORT" };

  if (
    (criteria.emails || criteria.emailDomains) &&
    !matchesEmail(user.email, criteria.emails, criteria.emailDomains)
  )
    return { matches: false, reason: "EMAIL_NOT_ALLOWED" };

  if (!matchesMetadata(user.metadata, criteria.metadata))
    return { matches: false, reason: "METADATA_MISMATCH" };

  return { matches: true };
}
