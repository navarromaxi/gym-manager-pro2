const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");

const source = ts.transpileModule(fs.readFileSync("lib/supabase.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function load({ storage = new Map(), userGym = "demo_gym", appGym, ownsGym = true, authenticated = true } = {}) {
  let options;
  let inserts = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? {
      id: "user", user_metadata: { gym_id: userGym }, app_metadata: { gym_id: appGym },
    } : null }, error: null }) },
    from: () => ({
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: ownsGym ? { id: "demo_gym" } : null, error: null }),
      insert: async () => { inserts++; return { error: null }; },
    }),
  };
  const context = {
    exports: {}, URL, console,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } },
    window: { crypto: { randomUUID }, sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    } },
    require: (name) => name === "@supabase/supabase-js" ? {
      createClient: (_url, _key, config) => { options = config; return client; },
    } : {},
  };
  vm.runInNewContext(source, context);
  return { api: context.exports, options, inserts: () => inserts };
}

test("las pestañas tienen canales de autenticación distintos y mantienen la sesión al recargar", () => {
  const storage = new Map();
  const first = load({ storage });
  assert.equal(first.options.auth.storageKey, load({ storage }).options.auth.storageKey);
  assert.notEqual(first.options.auth.storageKey, load().options.auth.storageKey);
});

test("permite crear socios con cuenta y gimnasio coincidentes", async () => {
  const state = load();
  await state.api.insertMemberWithFallback({ gym_id: "demo_gym" });
  assert.equal(state.inserts(), 1);
});

for (const config of [
  { userGym: "entrenamiento_online" },
  { appGym: "entrenamiento_online" },
  { ownsGym: false },
  { authenticated: false },
]) {
  test(`rechaza el alta antes de insertar: ${JSON.stringify(config)}`, async () => {
    const state = load(config);
    await assert.rejects(state.api.insertMemberWithFallback({ gym_id: "demo_gym" }));
    assert.equal(state.inserts(), 0);
  });
}
