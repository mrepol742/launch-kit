import { describe, expect, it } from "vitest";
import {
  createLaunch,
  LaunchRuleEvaluationError,
  type LaunchUser,
} from "../src/index.js";

interface User extends LaunchUser<{ accountAge: number }> {
  organizationId?: string;
  metadata: { accountAge: number };
}

describe("custom rules", () => {
  it.each([
    ["sync allow", (): boolean => true, true],
    ["sync deny", (): boolean => false, false],
    ["async allow", (): Promise<boolean> => Promise.resolve(true), true],
    ["async deny", (): Promise<boolean> => Promise.resolve(false), false],
  ] as const)("supports %s", async (_name, rule, expected) => {
    const launch = createLaunch({
      rules: { check: rule },
      phases: { beta: { rules: ["check"] } },
    });
    expect((await launch.canAccess({ id: "1" })).allowed).toBe(expected);
  });

  it("passes typed users and request context to rules", async () => {
    const launch = createLaunch<User, { country: string }>({
      rules: {
        established: ({ user, context }) =>
          user.metadata.accountAge >= 30 && context?.country === "PH",
      },
      phases: { beta: { rules: ["established"] } },
    });
    await expect(
      launch.canAccess(
        { id: "1", metadata: { accountAge: 45 } },
        { context: { country: "PH" } },
      ),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("wraps errors thrown by a rule", async () => {
    const launch = createLaunch({
      rules: {
        broken: () => {
          throw new Error("boom");
        },
      },
      phases: { beta: { rules: ["broken"] } },
    });
    await expect(launch.canAccess({ id: "1" })).rejects.toBeInstanceOf(
      LaunchRuleEvaluationError,
    );
  });
});
