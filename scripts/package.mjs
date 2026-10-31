import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const target = "dist/algo-patterns-trainer";
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
      "algo-patterns-trainer-1.0.1.zip",
      "algo-patterns-trainer",
      "INSTALL.md",
    ],
    { cwd: "dist" },
  );
  console.log("Ready: dist/algo-patterns-trainer-1.0.1.zip");
} catch {
  console.log(
    "zip unavailable; copy dist/algo-patterns-trainer as described in INSTALL.md.",
  );
}
