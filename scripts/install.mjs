import { access, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const vault = process.argv[2];
if (!vault) {
  console.error('Usage: node scripts/install.mjs "/absolute/path/to/vault"');
  process.exit(1);
}
const vaultPath = resolve(vault);
try {
  await access(join(vaultPath, ".obsidian"));
} catch {
  console.error(
    "The selected folder has no .obsidian directory. Open it in Obsidian first, or select the actual vault folder.",
  );
  process.exit(1);
}
const project = fileURLToPath(new URL("..", import.meta.url));
const target = join(vaultPath, ".obsidian", "plugins", "algo-patterns-trainer");
await mkdir(target, { recursive: true });
for (const name of ["main.js", "manifest.json", "styles.css"])
  await copyFile(join(project, name), join(target, name));
console.log(
  "Installed files in " +
    target +
    "\nEnable Algo Patterns in Obsidian → Settings → Community plugins. Existing tracker data was preserved.",
);
