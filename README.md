# Launch-Kit

Control who gets access to what, and when.

```bash
npm install launchkit
```

```ts
import { createLaunch } from "launchkit";

const launch = createLaunch({
  phases: {
    beta: {
      from: "2026-10-01T00:00:00Z",
      until: "2026-11-01T00:00:00Z",
      roles: ["tester"],
    },
    public: { from: "2026-11-01T00:00:00Z", allow: ["everyone"] },
  },
});

const decision = await launch.canAccess({ id: "usr_123", roles: ["tester"] });
// { allowed: true, reason: "ALLOWED", message: "Access granted.", phase: "beta", ... }
```

## What is LaunchKit?

LaunchKit is a small, framework-independent TypeScript evaluation engine for product launches,
private betas, early access, staged rollouts, and separately launched features. Your application
owns authentication, users, persistence, and invite storage; LaunchKit evaluates your rules.

The core has no production dependencies, telemetry, network calls, database, or framework imports.
It runs anywhere modern server-side JavaScript runs, including Node.js, Next.js, Nuxt, Express,
Fastify, NestJS, and serverless functions.

## Installation

LaunchKit is ESM-first and requires Node.js 20 or newer.

```bash
npm install launchkit
```

## Quick Start

```ts
import { createLaunch } from "launchkit";

const launch = createLaunch({
  id: "acme-launch",
  phases: {
    internal: {
      from: "2026-10-01",
      until: "2026-10-10",
      roles: ["admin", "employee"],
    },
    public: { from: "2026-10-10", allow: ["everyone"] },
  },
});

console.log(launch.phase());
console.log(await launch.canAccess({ id: "usr_123", roles: ["employee"] }));
```

Dates are normalized to UTC. Phase intervals are half-open: `from` is inclusive and `until` is
exclusive. Adjacent phases can therefore hand off at exactly the same instant.

## Launch Phases

Phases are ordered chronologically, regardless of object property order. Gaps are allowed;
overlaps, invalid dates, and an end before a start are rejected when the launch is created.

```ts
launch.phase(); // "beta" | "public" | null
launch.is("beta");
launch.hasStarted();
launch.hasEnded();
launch.previousPhase();
launch.nextPhase();
launch.timeline();
```

Use an injected clock for deterministic tests:

```ts
const launch = createLaunch(config, {
  now: () => new Date("2026-10-15T12:00:00Z"),
});
```

## User Access

LaunchKit accepts your user object; it does not authenticate anyone. Direct phase criteria are
combined with AND semantics, while values inside an array use OR semantics.

```ts
const decision = await launch.canAccess(
  {
    id: "usr_123",
    email: "person@example.com",
    roles: ["tester"],
    plan: "pro",
    tags: ["beta-tester"],
    metadata: { verified: true, country: "PH" },
  },
  { context: { device: "mobile" } },
);

if (!decision.allowed) {
  console.log(decision.reason, decision.message, decision.nextPhaseAt);
}
```

Supported direct criteria are `roles`, `plans`, `tags`, `emails`, `emailDomains`, and `metadata`.
Email matching is case-insensitive. `*@example.com` is accepted and normalized as a domain rule.
Metadata matching is intentionally simple: every configured top-level property must equal the
corresponding user metadata property.

Decisions contain stable machine-readable reason codes and separate human-readable messages.
Branch on `reason`, never on `message`.

## Cohorts

Cohorts are reusable named criteria. A user may match any cohort listed in `allow`.

```ts
const launch = createLaunch({
  cohorts: {
    staff: { roles: ["admin", "employee"] },
    testers: { tags: ["beta-tester"] },
    paid: { plans: ["pro", "business"] },
    partners: { emailDomains: ["partner.example"] },
  },
  phases: {
    beta: { allow: ["staff", "testers", "paid"] },
    public: { from: "2026-11-01", allow: ["everyone"] },
  },
});
```

Unknown cohort references fail immediately with a `LaunchConfigurationError`.

## Percentage Rollouts

Rollouts assign each eligible user to a stable bucket from 0 through 99 using the launch id, phase
name, and user id. LaunchKit never uses `Math.random()`.

```ts
earlyAccess: { allow: ["paid"], rollout: 25 }
```

Buckets 0–24 are included. The public `bucket(value)` helper uses the same stable hash. Rollout
values must be between 0 and 100. A missing/empty user id is excluded unless a stable identifier is
provided with `{ identifier: "stable-session-id" }`.

Scheduled rollouts are also supported:

```ts
rollout: [
  { percentage: 10, at: "2026-11-01T09:00:00Z" },
  { percentage: 25, at: "2026-11-01T12:00:00Z" },
  { percentage: 100, at: "2026-11-01T18:00:00Z" },
];
```

Steps must be chronological and percentages cannot decrease.

## Invite Codes

LaunchKit coordinates validation but does not store invite codes. Supply trusted application logic:

```ts
const launch = createLaunch({
  invite: {
    validate: async ({ code, user, phase }) =>
      myDatabase.invites.exists({ code, userId: user.id, phase }),
  },
  phases: { privateBeta: { inviteRequired: true } },
});

await launch.canAccess(user, { inviteCode: "BETA-X8F2" });
```

Missing codes return `INVITE_REQUIRED`; rejected codes return `INVALID_INVITE`. Validator failures
throw `LaunchInviteValidationError` so infrastructure failures are not mistaken for denials.

## Custom Rules

Rules are developer-supplied functions and may be synchronous or asynchronous:

```ts
const launch = createLaunch({
  rules: {
    establishedAccount: ({ user, phase, now, context }) =>
      Number(user.metadata?.accountAge ?? 0) >= 30,
  },
  phases: { beta: { rules: ["establishedAccount"] } },
});
```

Every listed rule must pass. A false result returns `CUSTOM_RULE_DENIED`; thrown errors are wrapped
in `LaunchRuleEvaluationError`. LaunchKit never executes rules from JSON or remote configuration.

## Feature Launches

Features have independent timelines and share top-level cohorts, rules, and invite validation:

```ts
const launch = createLaunch({
  features: {
    dashboard: { phases: { beta: { rollout: 25 }, public: { from: "2026-12-01" } } },
    assistant: { phases: { internal: { roles: ["employee"] } } },
  },
});

launch.feature("dashboard").phase();
await launch.feature("assistant").canAccess(user);
```

Literal feature and phase names are preserved in TypeScript, so editor autocomplete works and
unknown feature names are type errors. A dynamic unknown name throws `LaunchFeatureNotFoundError`.

## Server-side Security

**Access checks protecting sensitive functionality must execute server-side.** A client-side check
may hide a beta button, but it is not a security boundary. Re-check access in the API route, server
action, function, or service that serves the protected operation or data.

Treat invite codes, user fields, request context, and all other client-provided values as untrusted.
Keep secrets out of LaunchKit configuration. Validate invites through trusted server-side logic.

## TypeScript

The package includes declarations and is written in strict TypeScript. Extend the user and context
types when custom rules need application-specific data:

```ts
interface AppUser extends LaunchUser<{ accountAge: number }> {
  organizationId: string;
}

const launch = createLaunch<AppUser, { country: string }>({
  rules: {
    eligible: ({ user, context }) =>
      user.metadata.accountAge >= 30 && context?.country === "PH",
  },
  phases: { beta: { rules: ["eligible"] } },
});
```

## API Reference

- `createLaunch(config, options?)` validates configuration and creates a launch controller.
- `phase()`, `previousPhase()`, `nextPhase()` return names or `null`.
- `is(name)`, `hasStarted()`, `hasEnded()` inspect the current timeline.
- `timeline()` returns normalized phases with `completed`, `active`, or `upcoming` status.
- `canAccess(user, options?)` returns a `Promise<AccessDecision>`.
- `feature(name)` returns a controller for a configured feature.
- `bucket(value)` and `stableHash(value)` expose deterministic bucketing primitives.
- `LaunchConfigurationError`, `LaunchFeatureNotFoundError`, `LaunchRuleEvaluationError`, and
  `LaunchInviteValidationError` provide actionable failure categories.

## Testing

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Use `npm run check` to run the complete verification pipeline.

## Privacy

LaunchKit contains no telemetry or analytics, collects no user information, sends no configuration
anywhere, and makes no external requests. Access evaluation is local and deterministic except for
the custom functions your application explicitly supplies.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the local workflow
and project expectations.

## License

[MIT](./LICENSE)
