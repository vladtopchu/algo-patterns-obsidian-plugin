import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
test("Installer copies only runtime files and preserves existing tracker data", async () => {
  await mkdir("work", { recursive: true });
  const vault = await mkdtemp("work/install-test-");
  await mkdir(vault + "/.obsidian");
  await mkdir(vault + "/Algo Patterns");
  await writeFile(vault + "/Algo Patterns/tracker.json", "keep existing data");
  execFileSync(process.execPath, ["scripts/install.mjs", vault]);
  assert.deepEqual(
    (await readdir(vault + "/.obsidian/plugins/algo-patterns-trainer")).sort(),
    ["main.js", "manifest.json", "styles.css"],
  );
  assert.equal(
    await readFile(vault + "/Algo Patterns/tracker.json", "utf8"),
    "keep existing data",
  );
  assert.equal(
    await readFile(
      vault + "/.obsidian/plugins/algo-patterns-trainer/main.js",
      "utf8",
    ),
    await readFile("main.js", "utf8"),
  );
});
