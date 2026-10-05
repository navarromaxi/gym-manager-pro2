const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(fs.readFileSync("features/payments/recent-payment.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(data, accepted = false, error = null) {
  const calls = [];
  let confirmations = 0;
  const query = {};
  for (const method of ["from", "select", "eq", "gte", "lte"]) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.limit = async () => ({ data, error });
  const context = {
    exports: {}, require: () => ({ supabase: query }),
    window: { confirm: () => { confirmations++; return accepted; } },
  };
  vm.runInNewContext(source, context);
  return { check: context.exports.confirmRecentPayment, calls, confirmations: () => confirmations };
}

test("checks the same gym and member, including today and the tenth previous day across month boundaries", async () => {
  const state = setup([]);
  assert.equal(await state.check("gym", "member", "2026-10-05"), true);
  assert.deepEqual(state.calls, [
    ["from", "payments"], ["select", "id"], ["eq", "gym_id", "gym"],
    ["eq", "member_id", "member"], ["gte", "date", "2026-09-25"], ["lte", "date", "2026-10-05"],
  ]);
  assert.equal(state.confirmations(), 0);
});

test("a recent payment can be cancelled or explicitly confirmed", async () => {
  for (const accepted of [false, true]) {
    const state = setup([{ id: "existing" }], accepted);
    assert.equal(await state.check("gym", "member", "2026-10-05"), accepted);
    assert.equal(state.confirmations(), 1);
  }
});

test("query failure stops registration without offering an unchecked confirmation", async () => {
  const state = setup(null, true, { message: "offline" });
  await assert.rejects(state.check("gym", "member", "2026-10-05"), /verificar/);
  assert.equal(state.confirmations(), 0);
});
