import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { emptyDatabase, mergeCatalog, recordAttempt } from "../src/core";
import { parseImport } from "../src/importer";

// Re-export the mock through the plugin bundle so instanceof uses the same classes.
buildSync({
  stdin: {
    contents:
      'export { default } from "./src/main"; export * from "./src/main"; export * from "./tests/obsidian-mock"; export * from "./src/settings";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "work/storage-test.cjs",
  alias: { obsidian: "./tests/obsidian-mock.ts" },
});
const require = createRequire(import.meta.url);
const {
  default: Plugin,
  TFile,
  TFolder,
  dataFolderPath,
  TrainerView,
  notices,
} = require("../work/storage-test.cjs");

function harness() {
  const dom = new JSDOM("<body></body>");
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
  });
  const files = new Map<string, any>();
  const contents = new Map<string, string>();
  const addFolder = (path: string) => {
    files.set(path, new TFolder(path));
  };
  const addFile = (path: string, text: string) => {
    const file = new TFile(path);
    files.set(path, file);
    contents.set(path, text);
    return file;
  };
  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      read: async (file: any) => contents.get(file.path),
      createFolder: async (path: string) => {
        assert.ok(!files.has(path));
        addFolder(path);
      },
      create: async (path: string, text: string) => {
        assert.ok(!files.has(path));
        return addFile(path, text);
      },
      process: async (file: any, fn: any) =>
        contents.set(file.path, fn(contents.get(file.path))),
    },
    fileManager: {
      renameFile: async (source: any, next: string) => {
        const previous = source.path;
        assert.ok(!files.has(next));
        for (const [path, file] of [...files]) {
          if (path !== previous && !path.startsWith(previous + "/")) continue;
          const target = next + path.slice(previous.length);
          files.delete(path);
          file.path = target;
          files.set(target, file);
          if (contents.has(path)) {
            contents.set(target, contents.get(path)!);
            contents.delete(path);
          }
        }
      },
    },
    workspace: {
      onLayoutReady: (fn: any) => fn(),
      getLeavesOfType: () => [],
      getLeaf: () => ({ openFile: async () => {} }),
    },
  };
  const plugin = new Plugin(app);
  const load = async () => {
    await plugin.onload();
    await plugin.ready;
  };
  return { plugin, files, contents, addFolder, addFile, load, dom };
}

test("Fresh install uses _algo_patterns and persists the path outside tracker.json", async () => {
  const h = harness();
  await h.load();
  assert.ok(h.files.has("_algo_patterns/tracker.json"));
  assert.deepEqual(h.plugin.savedData, { dataFolder: "_algo_patterns" });
  assert.equal(h.plugin.settingTabs.length, 1);
  h.dom.window.close();
});

test("Header reload reads synced data, refreshes every open view and permits later writes", async () => {
  const h = harness();
  await h.load();
  await h.plugin.changeDataFolder("Study/Algo");
  const today = new TrainerView({}, h.plugin);
  const history = new TrainerView({}, h.plugin);
  history.tab = "history";
  h.plugin.app.workspace.getLeavesOfType = () => [
    { view: today },
    { view: history },
  ];
  today.render();
  history.render();
  assert.equal(
    today.contentEl
      .querySelector("header")!
      .textContent!.includes("Импорт каталога"),
    false,
  );
  const synced = emptyDatabase();
  mergeCatalog(
    synced,
    parseImport("topic,pattern,title,id\nSynced topic,B,Synced task,1").catalog,
  );
  recordAttempt(synced, {
    id: "synced-attempt",
    problemId: "lc-1",
    patternId: synced.patterns[0].id,
    mode: "solve",
    outcome: "independent",
    minutes: 20,
    at: "2026-10-31T09:00:00.000Z",
    note: "Result from another device",
  });
  const raw = JSON.stringify(synced);
  h.contents.set(h.plugin.dataPath, raw);
  const reload = today.contentEl.querySelector(
    "header button",
  ) as HTMLButtonElement;
  assert.equal(reload.textContent, "Обновить базу данных");
  reload.click();
  assert.equal(reload.disabled, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(h.plugin.db, synced);
  assert.equal(h.contents.get(h.plugin.dataPath), raw);
  assert.match(today.contentEl.textContent, /Synced topic/);
  assert.match(history.contentEl.textContent, /Synced task/);
  assert.match(history.contentEl.textContent, /Result from another device/);
  assert.equal(notices.at(-1), "База перечитана с диска.");
  await h.plugin.change((db: any) => {
    db.settings.budget = 75;
  });
  assert.equal(
    JSON.parse(h.contents.get(h.plugin.dataPath)!).settings.budget,
    75,
  );
  assert.equal(h.plugin.db.attempts.length, 1);
  today.tab = "data";
  today.render();
  const importButton = [
    ...today.contentEl.querySelectorAll("main button"),
  ].find(
    (button: any) => button.textContent === "Импорт каталога",
  ) as HTMLButtonElement;
  assert.ok(importButton);
  importButton.click();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.match(
    h.dom.window.document.body.textContent!,
    /CSV: topic, pattern, title/,
  );
  h.dom.window.close();
});

test("Header reload rejects broken synced data without replacing the current database or file", async () => {
  const h = harness();
  await h.load();
  const view = new TrainerView({}, h.plugin);
  view.render();
  const before = structuredClone(h.plugin.db);
  for (const raw of ["{broken", JSON.stringify({ schemaVersion: 999 })]) {
    h.contents.set(h.plugin.dataPath, raw);
    const count = notices.length;
    const reload = view.contentEl.querySelector(
      "header button",
    ) as HTMLButtonElement;
    reload.click();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(h.plugin.db, before);
    assert.equal(h.contents.get(h.plugin.dataPath), raw);
    assert.equal(reload.disabled, false);
    assert.equal(notices.length, count + 1);
    assert.notEqual(notices.at(-1), "База перечитана с диска.");
  }
  h.dom.window.close();
});

test("Obsidian settings change the folder and practice preferences, then survive a restart", async () => {
  const h = harness();
  await h.load();
  const tab = h.plugin.settingTabs[0];
  tab.display();
  await Promise.resolve();
  const field = (name: string, selector = "input") =>
    tab.containerEl.querySelector(
      `[data-name="${name}"] ${selector}`,
    ) as HTMLInputElement;
  const changeField = async (
    name: string,
    value: string | boolean,
    selector = "input",
  ) => {
    const control = field(name, selector);
    assert.ok(control, name);
    if (typeof value === "boolean") control.checked = value;
    else control.value = value;
    control.dispatchEvent(
      new h.dom.window.Event(control.type === "text" ? "input" : "change"),
    );
    await Promise.resolve();
    await h.plugin.store.exclusive(async () => {});
  };
  assert.match(tab.containerEl.textContent, /_algo_patterns\/tracker.json/);
  await changeField("Время на план, мин", "75");
  await changeField("Доля времени на новые задачи", "80", "select");
  await changeField("Скрывать паттерн при смешанной практике", false);
  await changeField("Добавлять короткие проверки подхода", true);
  assert.equal(h.plugin.db.settings.budget, 75);
  assert.equal(h.plugin.db.settings.newPercent, 80);
  assert.equal(h.plugin.db.settings.hidePattern, false);
  assert.equal(h.plugin.db.settings.includeRecall, true);
  await changeField("Папка данных", "Study/Algo");
  const change = h.plugin.changeDataFolder.bind(h.plugin);
  const changed = new Promise<void>((resolve, reject) => {
    h.plugin.changeDataFolder = async (path: string) => {
      try {
        await change(path);
        resolve();
      } catch (error) {
        reject(error);
        throw error;
      }
    };
  });
  field("Папка данных", "button").click();
  await changed;
  assert.ok(h.files.has("Study/Algo/tracker.json"));
  await h.load();
  assert.equal(h.plugin.dataFolder, "Study/Algo");
  assert.equal(h.plugin.db.settings.budget, 75);
  assert.equal(h.plugin.db.settings.newPercent, 80);
  assert.equal(h.plugin.db.settings.hidePattern, false);
  assert.equal(h.plugin.db.settings.includeRecall, true);
  h.dom.window.close();
});

test("Upgrade preserves attempts, timer, notes and backups when moving the legacy folder", async () => {
  const h = harness();
  const db = emptyDatabase();
  mergeCatalog(db, parseImport("topic,pattern,title,id\nA,B,Task,1").catalog);
  recordAttempt(db, {
    id: "old-attempt",
    problemId: "lc-1",
    patternId: db.patterns[0].id,
    mode: "solve",
    outcome: "independent",
    minutes: 20,
    at: "2026-10-30T09:00:00.000Z",
    note: "Existing result",
  });
  db.active = {
    id: "active",
    problemId: "lc-1",
    patternId: db.patterns[0].id,
    mode: "recall",
    startedAt: "2026-10-31T09:00:00.000Z",
    runningSince: Date.now(),
    elapsedMs: 1000,
    hinted: false,
    reason: "review",
  };
  db.settings.budget = 95;
  h.addFolder("Algo Patterns");
  h.addFolder("Algo Patterns/Tasks");
  h.addFolder("Algo Patterns/Backups");
  h.addFile("Algo Patterns/tracker.json", JSON.stringify(db));
  h.addFile("Algo Patterns/Tasks/one.md", "existing note");
  h.addFile("Algo Patterns/Backups/old.json", "existing backup");
  await h.load();
  assert.equal(h.plugin.db.settings.budget, 95);
  assert.deepEqual(h.plugin.db, db);
  assert.equal(h.contents.get("_algo_patterns/Tasks/one.md"), "existing note");
  assert.equal(
    h.contents.get("_algo_patterns/Backups/old.json"),
    "existing backup",
  );
  assert.ok(!h.files.has("Algo Patterns"));
  h.dom.window.close();
});

test("Data screen applies a folder change and displays the resulting paths", async () => {
  const h = harness();
  await h.load();
  const view = new TrainerView({}, h.plugin);
  view.tab = "data";
  view.render();
  const field = view.contentEl.querySelector(
    "input[type=text]",
  ) as HTMLInputElement;
  assert.equal(field.value, "_algo_patterns");
  field.value = "Practice/Metadata";
  const save = [...view.contentEl.querySelectorAll("button")].find(
    (button: any) =>
      button.textContent === "Сохранить папку и перенести данные",
  ) as HTMLButtonElement;
  assert.ok(save);
  const change = h.plugin.changeDataFolder.bind(h.plugin);
  const changed = new Promise<void>((resolve, reject) => {
    h.plugin.changeDataFolder = async (path: string) => {
      try {
        await change(path);
        resolve();
      } catch (error) {
        reject(error);
        throw error;
      }
    };
  });
  save.click();
  await changed;
  view.render();
  assert.match(view.contentEl.textContent, /Practice\/Metadata\/tracker.json/);
  assert.ok(h.files.has("Practice/Metadata/tracker.json"));
  h.dom.window.close();
});

test("Occupied default keeps the legacy database instead of starting an empty history", async () => {
  const h = harness();
  h.addFolder("Algo Patterns");
  h.addFolder("_algo_patterns");
  const db = emptyDatabase();
  db.settings.budget = 75;
  h.addFile("Algo Patterns/tracker.json", JSON.stringify(db));
  await h.load();
  assert.equal(h.plugin.dataFolder, "Algo Patterns");
  assert.equal(h.plugin.db.settings.budget, 75);
  h.dom.window.close();
});

test("Changing a nested path serializes with writes and sends notes/backups to the new folder; restart reads it", async () => {
  const h = harness();
  await h.load();
  await h.plugin.change((db: any) =>
    mergeCatalog(db, parseImport("topic,pattern,title,id\nA,B,Task,1").catalog),
  );
  await h.plugin.note("lc-1");
  const note = h.contents.get("_algo_patterns/Tasks/lc-1.md");
  await Promise.all([
    h.plugin.change((db: any) => {
      db.settings.budget = 80;
    }),
    h.plugin.changeDataFolder("Учёба/Алгоритмы"),
    h.plugin.change((db: any) => {
      db.settings.newPercent = 70;
    }),
    h.plugin.backup(),
    h.plugin.note("lc-1"),
  ]);
  assert.ok(!h.files.has("_algo_patterns"));
  assert.equal(h.contents.get("Учёба/Алгоритмы/Tasks/lc-1.md"), note);
  assert.ok(
    [...h.files.keys()].some((p) =>
      p.startsWith("Учёба/Алгоритмы/Backups/tracker-"),
    ),
  );
  await h.load();
  assert.equal(h.plugin.dataFolder, "Учёба/Алгоритмы");
  assert.equal(h.plugin.db.settings.budget, 80);
  assert.equal(h.plugin.db.settings.newPercent, 70);
  h.dom.window.close();
});

test("Occupied, hidden, absolute and recursive destinations are rejected without moving data", async () => {
  const h = harness();
  await h.load();
  h.addFolder("Taken");
  for (const path of [
    "Taken",
    "_algo_patterns/child",
    "",
    "../outside",
    "/tmp",
    ".obsidian/plugins",
    "A/../B",
    "C:\\tmp",
    "A//B",
    "CON",
    "A.",
  ]) {
    await assert.rejects(h.plugin.changeDataFolder(path), undefined, path);
    assert.equal(h.plugin.dataFolder, "_algo_patterns");
    assert.ok(h.files.has("_algo_patterns/tracker.json"));
  }
  assert.equal(dataFolderPath("  Notes\\Algo  "), "Notes/Algo");
  h.dom.window.close();
});

test("Rename failure and settings failure preserve the previous location and allow later writes", async () => {
  const h = harness();
  await h.load();
  const rename = h.plugin.app.fileManager.renameFile;
  h.plugin.app.fileManager.renameFile = async () => {
    throw new Error("rename failed");
  };
  await assert.rejects(h.plugin.changeDataFolder("Next"), /rename failed/);
  h.plugin.app.fileManager.renameFile = rename;
  const save = h.plugin.saveData.bind(h.plugin);
  h.plugin.saveData = async () => {
    throw new Error("settings failed");
  };
  await assert.rejects(h.plugin.changeDataFolder("Next"), /settings failed/);
  assert.ok(h.files.has("_algo_patterns/tracker.json"));
  assert.ok(!h.files.has("Next"));
  h.plugin.saveData = save;
  await h.plugin.change((db: any) => {
    db.settings.budget = 90;
  });
  assert.equal(
    JSON.parse(h.contents.get("_algo_patterns/tracker.json")!).settings.budget,
    90,
  );
  h.dom.window.close();
});
