import { describe, expect, it } from "vitest";
import { bucket, createLaunch } from "../src/index.js";

describe("rollouts", () => {
  it("buckets identifiers deterministically", () => {
    expect(bucket("launch:phase:user-123")).toBe(bucket("launch:phase:user-123"));
    expect(bucket("launch:phase:user-123")).toBeGreaterThanOrEqual(0);
    expect(bucket("launch:phase:user-123")).toBeLessThan(100);
  });

  it.each([0, 10, 25, 50, 100])("distributes a %i% rollout", async (percentage) => {
    const launch = createLaunch({
      id: "distribution",
      phases: { beta: { rollout: percentage } },
    });
    let allowed = 0;
    for (let index = 0; index < 5_000; index += 1) {
      if ((await launch.canAccess({ id: `user-${index}` })).allowed) allowed += 1;
    }
    if (percentage === 0 || percentage === 100) {
      expect(allowed).toBe((percentage / 100) * 5_000);
    } else {
      expect(allowed / 5_000).toBeCloseTo(percentage / 100, 1);
    }
  });

  it("keeps repeated evaluations stable", async () => {
    const launch = createLaunch({ id: "stable", phases: { beta: { rollout: 25 } } });
    const first = await launch.canAccess({ id: "user-123" });
    for (let index = 0; index < 20; index += 1) {
      expect(await launch.canAccess({ id: "user-123" })).toEqual(first);
    }
  });

  it("supports scheduled rollout growth", async () => {
    let now = new Date("2026-11-01T08:00:00Z");
    const launch = createLaunch(
      {
        phases: {
          beta: {
            rollout: [
              { percentage: 10, at: "2026-11-01T09:00:00Z" },
              { percentage: 50, at: "2026-11-01T12:00:00Z" },
              { percentage: 100, at: "2026-11-01T18:00:00Z" },
            ],
          },
        },
      },
      { now: () => now },
    );
    expect((await launch.canAccess({ id: "a" })).rollout?.percentage).toBe(0);
    now = new Date("2026-11-01T12:00:00Z");
    expect((await launch.canAccess({ id: "a" })).rollout?.percentage).toBe(50);
    now = new Date("2026-11-01T18:00:00Z");
    expect(await launch.canAccess({ id: "a" })).toMatchObject({
      allowed: true,
      rollout: { percentage: 100 },
    });
  });

  it("excludes a user without a stable identifier", async () => {
    const launch = createLaunch({ phases: { beta: { rollout: 100 } } });
    await expect(launch.canAccess({ id: "" })).resolves.toMatchObject({
      allowed: false,
      reason: "ROLLOUT_EXCLUDED",
    });
    await expect(
      launch.canAccess({ id: "" }, { identifier: "anonymous-session" }),
    ).resolves.toMatchObject({ allowed: true });
  });
});
