import { describe, expect, it } from "vitest";
import { createLaunch, LaunchFeatureNotFoundError } from "../src/index.js";

describe("features", () => {
  it("keeps feature timelines independent", () => {
    const launch = createLaunch(
      {
        features: {
          dashboard: { phases: { beta: { from: "2026-10-01", until: "2026-11-01" } } },
          assistant: {
            phases: { internal: { from: "2026-11-01", until: "2026-12-01" } },
          },
        },
      },
      { now: () => new Date("2026-10-15T00:00:00Z") },
    );
    expect(launch.feature("dashboard").phase()).toBe("beta");
    expect(launch.feature("assistant").phase()).toBeNull();
    // @ts-expect-error Feature names are inferred and unknown names are rejected.
    expect(() => launch.feature("does-not-exist")).toThrow(LaunchFeatureNotFoundError);
  });

  it("evaluates access using shared cohorts", async () => {
    const launch = createLaunch({
      cohorts: { staff: { roles: ["employee"] } },
      features: { dashboard: { phases: { internal: { allow: ["staff"] } } } },
    });
    await expect(
      launch.feature("dashboard").canAccess({ id: "1", roles: ["employee"] }),
    ).resolves.toMatchObject({ allowed: true });
  });
});
