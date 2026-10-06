// In an installed application, import this from "launchkit".
import { createLaunch } from "../src/index.js";

const launch = createLaunch({
  id: "acme-launch",
  cohorts: {
    staff: { roles: ["admin", "employee"] },
    testers: { tags: ["beta-tester"] },
    paid: { plans: ["pro", "business"] },
  },
  invite: {
    validate: async ({ code }) => Promise.resolve(code.startsWith("BETA-")),
  },
  phases: {
    internal: { from: "2026-10-01", until: "2026-10-10", allow: ["staff"] },
    beta: {
      from: "2026-10-10",
      until: "2026-11-01",
      allow: ["staff", "testers"],
      inviteRequired: true,
    },
    earlyAccess: {
      from: "2026-11-01",
      until: "2026-11-15",
      allow: ["paid"],
      rollout: 25,
    },
    public: { from: "2026-11-15", allow: ["everyone"] },
  },
});

const decision = await launch.canAccess({
  id: "usr_123",
  email: "melvin@example.com",
  plan: "pro",
});

console.log(decision);
