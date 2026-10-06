import { describe, expect, it, vi } from "vitest";
import { createLaunch, LaunchInviteValidationError } from "../src/index.js";

describe("invites", () => {
  it("distinguishes missing, invalid, and valid codes", async () => {
    const validate = vi.fn(({ code }: { code: string }) =>
      Promise.resolve(code === "BETA-X8F2"),
    );
    const launch = createLaunch({
      invite: { validate },
      phases: { beta: { inviteRequired: true } },
    });
    await expect(launch.canAccess({ id: "1" })).resolves.toMatchObject({
      reason: "INVITE_REQUIRED",
    });
    await expect(
      launch.canAccess({ id: "1" }, { inviteCode: "BAD" }),
    ).resolves.toMatchObject({ reason: "INVALID_INVITE" });
    await expect(
      launch.canAccess({ id: "1" }, { inviteCode: "BETA-X8F2" }),
    ).resolves.toMatchObject({ allowed: true });
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("wraps validator failures", async () => {
    const launch = createLaunch({
      invite: { validate: async () => Promise.reject(new Error("database unavailable")) },
      phases: { beta: { inviteRequired: true } },
    });
    await expect(
      launch.canAccess({ id: "1" }, { inviteCode: "x" }),
    ).rejects.toBeInstanceOf(LaunchInviteValidationError);
  });
});
