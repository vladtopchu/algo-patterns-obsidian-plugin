import { mkdir, copyFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const target = "dist/algo-patterns-trainer";
const { version } = JSON.parse(await readFile("manifest.json", "utf8"));
const archive = `algo-patterns-trainer-${version}.zip`;
await mkdir(target, { recursive: true });
for (const name of ["main.js", "manifest.json", "styles.css"])
  await copyFile(name, target + "/" + name);
await copyFile("INSTALL.md", "dist/INSTALL.md");
// macOS/Linux zip is used only for distribution; the folder itself is installable everywhere.
try {
  execFileSync(
    "zip",
    [
      "-q",
      "-r",
      archive,
      "algo-patterns-trainer",
      "INSTALL.md",
    ],
    { cwd: "dist" },
  );
  console.log("Ready: dist/" + archive);
} catch {
  console.log(
    "zip unavailable; copy dist/algo-patterns-trainer as described in INSTALL.md.",
  );
}
