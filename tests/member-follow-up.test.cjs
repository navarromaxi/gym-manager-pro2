const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(fs.readFileSync("features/members/member-utils.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [2026, 8, 10, 12]));
  }
}
const context = { exports: {}, Date: FixedDate };
vm.runInNewContext(source, context);
const { getMembersToFollowUp, filterMembers } = context.exports;
const member = (id, join_date, followed_up = false) => ({
  id, join_date, followed_up, next_payment: "2026-10-10",
});
const payment = (member_id, start_date, type = "plan") => ({ member_id, start_date, type });

test("dashboard count and filtered list agree for new members and renewals", () => {
  const members = [member("new", "2026-09-05"), member("renewal", "2026-01-01"), member("done", "2026-09-01", true)];
  const payments = [payment("renewal", "2026-09-01")];
  const pending = getMembersToFollowUp(members, payments);
  assert.deepEqual(Array.from(pending, (m) => m.id), ["new", "renewal"]);
  const filtered = filterMembers({ members, search: "", statusFilter: "follow_up",
    followUpMemberIds: new Set(pending.map((m) => m.id)),
    longTermFollowUpMemberIds: new Set(), expiringCustomPlanMemberIds: null,
    hasOverduePartialInstallment: () => false });
  assert.equal(filtered.length, pending.length);
});

test("includes days 5 and 12, excludes dates outside the window and contacted members", () => {
  const members = [member("day4", "2026-09-06"), member("day5", "2026-09-05"),
    member("day12", "2026-08-29"), member("day13", "2026-08-28"),
    member("future", "2026-09-11"), member("invalid", "invalid"), member("done", "2026-09-05", true)];
  assert.deepEqual(Array.from(getMembersToFollowUp(members, []), (m) => m.id), ["day5", "day12"]);
});

test("uses latest valid plan start and falls back to joining when unavailable", () => {
  const members = [member("renewal", "2026-01-01"), member("fallback", "2026-09-05")];
  const payments = [payment("renewal", "2026-09-01"), payment("renewal", "2026-08-01"),
    payment("renewal", "2026-09-09", "other"), payment("fallback", "invalid")];
  assert.equal(getMembersToFollowUp(members, payments).length, 2);
  assert.equal(getMembersToFollowUp(members, [...payments, payment("renewal", "2026-09-10")]).length, 1);
});
