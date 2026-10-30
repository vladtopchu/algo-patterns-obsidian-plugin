import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { emptyDatabase, mergeCatalog } from "../src/core";
import { parseImport } from "../src/importer";
import { Store } from "../src/store";
test("UI journey: import preview → plan → timed solve → finish → progress → persistence", async () => {
  const dom = new JSDOM("<body></body>", { url: "https://test.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  await build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: "work/ui-test.cjs",
    alias: { obsidian: "./tests/obsidian-mock.ts" },
  });
  const require = createRequire(import.meta.url);
  const {
    TrainerView,
    FinishModal,
    ImportModal,
  } = require("../work/ui-test.cjs");
  let raw: string | null = null;
  const store = new Store({
    read: async () => raw,
    create: async (s) => {
      raw = s;
    },
    replace: async (expected, next) => {
      assert.equal(raw, expected);
      raw = next;
    },
  });
  await store.load();
  const plugin: any = {
    store,
    get db() {
      return store.db;
    },
    ready: Promise.resolve(),
    app: {},
    change: async (fn: any) => {
      await store.change(fn);
      view.render();
    },
    backup: async () => {},
    note: async () => {},
    refresh: () => view.render(),
    start: async (item: any) => {
      await plugin.change((db: any) => {
        db.active = {
          id: "attempt-ui",
          problemId: item.problemId,
          patternId: item.patternId,
          mode: item.mode,
          startedAt: new Date().toISOString(),
          runningSince: Date.now() - 120000,
          elapsedMs: 0,
          hinted: false,
          reason: item.reason,
        };
      });
    },
  };
  const view = new TrainerView({}, plugin);
  document.body.append(view.contentEl);
  view.render();
  assert.match(view.contentEl.textContent, /Начните со своего каталога/);
  const modal = new ImportModal(
    plugin,
    "topic,pattern,title,id,difficulty\nArrays,Pointers,Two Sum,1,Easy",
  );
  modal.open();
  assert.match(modal.contentEl.textContent, /1 уникальных задач/);
  const click = async (root: HTMLElement, label: string) => {
    const b = [...root.querySelectorAll("button")].find(
      (b) => b.textContent === label,
    );
    assert.ok(b, `Missing button ${label}`);
    b.click();
    await new Promise((r) => setTimeout(r, 25));
  };
  await click(modal.contentEl, "Импортировать");
  assert.equal(store.db.problems.length, 1);
  assert.match(view.contentEl.textContent, /Two Sum/);
  await click(view.contentEl, "Начать");
  assert.ok(store.db.active);
  view.tick();
  assert.match(
    view.contentEl.querySelector("[data-timer]")!.textContent!,
    /^02:/,
  );
  await click(view.contentEl, "Использовал подсказку");
  assert.equal(store.db.active!.hinted, true);
  const finish = new FinishModal(plugin);
  finish.open();
  const result = [...finish.contentEl.querySelectorAll("select")].at(-1)!;
  assert.equal(result.value, "hint");
  assert.ok(
    [...result.options].find((o) => o.value === "independent")!.disabled,
  );
  await click(finish.contentEl, "Сохранить результат");
  assert.equal(store.db.attempts.length, 1);
  assert.equal(store.db.attempts[0].outcome, "hint");
  assert.equal(store.db.active, null);
  await click(view.contentEl, "Прогресс");
  assert.match(view.contentEl.textContent, /Первые попытки без помощи/);
  assert.match(view.contentEl.textContent, /0%/);
  await click(view.contentEl, "История");
  assert.match(view.contentEl.textContent, /С подсказкой/);
  const fresh = new Store({
    read: async () => raw,
    create: async () => {},
    replace: async () => {},
  });
  await fresh.load();
  assert.equal(fresh.db.attempts.length, 1);
  assert.equal(fresh.db.cards.length, 2);
  dom.window.close();
});
test("Imported HTML is rendered as text and never as executable markup", async () => {
  const dom = new JSDOM("<body></body>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  const require = createRequire(import.meta.url);
  const { TrainerView } = require("../work/ui-test.cjs");
  const db = emptyDatabase();
  mergeCatalog(
    db,
    parseImport("topic,pattern,title,id\nA,B,<img src=x onerror=alert(1)>,9")
      .catalog,
  );
  const plugin: any = { db };
  const view = new TrainerView({}, plugin);
  view.render();
  assert.equal(view.contentEl.querySelector("img"), null);
  assert.match(view.contentEl.textContent, /<img src=x/);
  dom.window.close();
});

test("Restored views do not block workspace readiness", async () => {
  const dom = new JSDOM("<body></body>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  const require = createRequire(import.meta.url);
  const { TrainerView } = require("../work/ui-test.cjs");
  let ready!: () => void;
  const plugin = {
    db: emptyDatabase(),
    ready: new Promise<void>((resolve) => {
      ready = resolve;
    }),
  };
  const view = new TrainerView({}, plugin);
  await view.onOpen();
  assert.match(view.contentEl.textContent, /Загрузка каталога/);
  ready();
  await Promise.resolve();
  assert.match(view.contentEl.textContent, /Начните со своего каталога/);
  dom.window.close();
});
