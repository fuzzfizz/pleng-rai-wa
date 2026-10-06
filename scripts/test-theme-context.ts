import assert from "assert";

function resolveTheme(preference: string, systemDark: boolean): "light" | "dark" {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemDark ? "dark" : "light";
}

assert.strictEqual(resolveTheme("light", true), "light");
assert.strictEqual(resolveTheme("dark", false), "dark");
assert.strictEqual(resolveTheme("system", true), "dark");
assert.strictEqual(resolveTheme("system", false), "light");
console.log("✓ Theme resolution logic test passed.");
