import { describe, expect, it } from "vitest";
import { createLaunch } from "../src/index.js";

const now = () => new Date("2026-10-02T00:00:00Z");

async function decision(
  criteria: Record<string, unknown>,
  user: Parameters<ReturnType<typeof createLaunch>["canAccess"]>[0],
) {
  const launch = createLaunch({ phases: { beta: { ...criteria } } }, { now });
  return launch.canAccess(user);
}

describe("direct access criteria", () => {
  it("matches one of multiple roles", async () => {
    await expect(
      decision({ roles: ["admin", "tester"] }, { id: "1", roles: ["tester"] }),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      decision({ roles: ["admin"] }, { id: "1", roles: ["member"] }),
    ).resolves.toMatchObject({ allowed: false, reason: "ROLE_REQUIRED" });
  });

  it("matches plans", async () => {
    await expect(
      decision({ plans: ["pro"] }, { id: "1", plan: "pro" }),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      decision({ plans: ["pro"] }, { id: "1", plan: "free" }),
    ).resolves.toMatchObject({ allowed: false, reason: "PLAN_REQUIRED" });
  });

  it("matches exact emails case-insensitively", async () => {
    await expect(
      decision(
        { emails: ["Alice@Example.com"] },
        { id: "1", email: "alice@example.COM" },
      ),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      decision({ emails: ["alice@example.com"] }, { id: "1", email: "bob@example.com" }),
    ).resolves.toMatchObject({ allowed: false, reason: "EMAIL_NOT_ALLOWED" });
  });

  it("matches domains and wildcard emails", async () => {
    await expect(
      decision({ emailDomains: ["Example.com"] }, { id: "1", email: "a@example.com" }),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      decision({ emails: ["*@company.org"] }, { id: "1", email: "a@company.org" }),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      decision({ emailDomains: ["example.com"] }, { id: "1", email: "a@other.com" }),
    ).resolves.toMatchObject({ allowed: false });
  });

  it("requires every metadata property", async () => {
    const criteria = { metadata: { verified: true, country: "PH" } };
    await expect(
      decision(criteria, { id: "1", metadata: { verified: true, country: "PH" } }),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      decision(criteria, { id: "1", metadata: { verified: true } }),
    ).resolves.toMatchObject({ allowed: false, reason: "METADATA_MISMATCH" });
    await expect(
      decision(criteria, { id: "1", metadata: { verified: false, country: "PH" } }),
    ).resolves.toMatchObject({ allowed: false });
  });

  it("marks everyone phases public", async () => {
    const launch = createLaunch({ phases: { public: { allow: ["everyone"] } } });
    await expect(launch.canAccess({ id: "anyone" })).resolves.toMatchObject({
      allowed: true,
      reason: "PUBLIC",
    });
  });
});
