import { describe, expect, it } from "vitest";
import { createLaunch } from "../src/index.js";

describe("cohorts", () => {
  const launch = createLaunch({
    cohorts: {
      staff: { roles: ["employee"] },
      paid: { plans: ["pro", "business"] },
      testers: { tags: ["beta-tester"] },
    },
    phases: { beta: { allow: ["staff", "paid", "testers"] } },
  });

  it("allows any one matching cohort", async () => {
    await expect(
      launch.canAccess({ id: "1", roles: ["employee"] }),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      launch.canAccess({ id: "2", plan: "pro", tags: ["beta-tester"] }),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("denies users in no allowed cohort", async () => {
    await expect(launch.canAccess({ id: "3", plan: "free" })).resolves.toMatchObject({
      allowed: false,
      reason: "NOT_IN_COHORT",
    });
  });
});
