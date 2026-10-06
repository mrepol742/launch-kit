import { describe, expect, it } from "vitest";
import { createLaunch } from "../src/index.js";

function setup(initial: string) {
  let now = new Date(initial);
  const launch = createLaunch(
    {
      phases: {
        internal: { from: "2026-10-01T00:00:00Z", until: "2026-10-10T00:00:00Z" },
        beta: { from: "2026-10-12T00:00:00Z", until: "2026-11-01T00:00:00Z" },
        public: { from: "2026-11-01T00:00:00Z", until: "2026-12-01T00:00:00Z" },
      },
    },
    { now: () => now },
  );
  return { launch, setNow: (value: string) => (now = new Date(value)) };
}

describe("phases", () => {
  it("handles phase and gap boundaries", () => {
    const { launch, setNow } = setup("2026-09-30T23:59:59Z");
    expect(launch.phase()).toBeNull();
    expect(launch.hasStarted()).toBe(false);
    expect(launch.nextPhase()).toBe("internal");

    setNow("2026-10-01T00:00:00Z");
    expect(launch.phase()).toBe("internal");
    expect(launch.hasStarted()).toBe(true);

    setNow("2026-10-05T00:00:00Z");
    expect(launch.is("internal")).toBe(true);
    expect(launch.nextPhase()).toBe("beta");

    setNow("2026-10-10T00:00:00Z");
    expect(launch.phase()).toBeNull();
    expect(launch.previousPhase()).toBe("internal");
    expect(launch.nextPhase()).toBe("beta");

    setNow("2026-11-01T00:00:00Z");
    expect(launch.phase()).toBe("public");

    setNow("2026-12-01T00:00:00Z");
    expect(launch.phase()).toBeNull();
    expect(launch.hasEnded()).toBe(true);
    expect(launch.previousPhase()).toBe("public");
  });

  it("returns a normalized timeline", () => {
    const { launch } = setup("2026-10-15T00:00:00Z");
    expect(launch.timeline()).toEqual([
      {
        name: "internal",
        status: "completed",
        from: "2026-10-01T00:00:00.000Z",
        until: "2026-10-10T00:00:00.000Z",
      },
      {
        name: "beta",
        status: "active",
        from: "2026-10-12T00:00:00.000Z",
        until: "2026-11-01T00:00:00.000Z",
      },
      {
        name: "public",
        status: "upcoming",
        from: "2026-11-01T00:00:00.000Z",
        until: "2026-12-01T00:00:00.000Z",
      },
    ]);
  });

  it("reports the next phase in access decisions", async () => {
    const { launch } = setup("2026-10-10T12:00:00Z");
    await expect(launch.canAccess({ id: "user" })).resolves.toMatchObject({
      allowed: false,
      reason: "NO_ACTIVE_PHASE",
      phase: null,
      nextPhase: "beta",
      nextPhaseAt: "2026-10-12T00:00:00.000Z",
    });
  });
});
