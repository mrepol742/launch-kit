import { describe, expect, it } from "vitest";
import { createLaunch, LaunchConfigurationError } from "../src/index.js";

describe("configuration validation", () => {
  it.each([
    ["unknown cohort", { phases: { beta: { allow: ["missing"] } } }, "unknown cohort"],
    ["unknown rule", { phases: { beta: { rules: ["missing"] } } }, "unknown custom rule"],
    ["invalid date", { phases: { beta: { from: "not-a-date" } } }, "invalid date"],
    ["invalid rollout", { phases: { beta: { rollout: 101 } } }, "between 0 and 100"],
    ["negative rollout", { phases: { beta: { rollout: -1 } } }, "between 0 and 100"],
    [
      "backwards phase",
      { phases: { beta: { from: "2026-11-01", until: "2026-10-01" } } },
      "end must be after",
    ],
    [
      "overlap",
      {
        phases: {
          a: { from: "2026-10-01", until: "2026-10-20" },
          b: { from: "2026-10-10", until: "2026-11-01" },
        },
      },
      "overlap",
    ],
    [
      "invalid email",
      { cohorts: { bad: { emails: ["not-an-email"] } }, phases: { beta: {} } },
      "invalid email",
    ],
    [
      "missing invite validator",
      { phases: { beta: { inviteRequired: true } } },
      "invite validator",
    ],
    [
      "duplicate phase",
      { phases: { Beta: { until: "2026-10-01" }, beta: { from: "2026-10-01" } } },
      "duplicate phase",
    ],
    [
      "decreasing schedule",
      {
        phases: {
          beta: {
            rollout: [
              { percentage: 50, at: "2026-10-01" },
              { percentage: 25, at: "2026-10-02" },
            ],
          },
        },
      },
      "must not decrease",
    ],
  ] as const)("rejects %s", (_name, config, message) => {
    expect(() => createLaunch(config)).toThrowError(LaunchConfigurationError);
    expect(() => createLaunch(config)).toThrowError(message);
  });

  it("requires at least one launch target", () => {
    expect(() => createLaunch({})).toThrow("at least one product phase or feature");
  });
});
