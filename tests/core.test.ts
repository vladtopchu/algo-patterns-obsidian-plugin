import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDatabase,
  recordAttempt,
  buildQueue,
  elapsed,
  mergeCatalog,
  validateDatabase,
  nextCard,
} from "../src/core";
import { parseImport, csvRows } from "../src/importer";
import { Store } from "../src/store";
const seed = () => {
  const db = emptyDatabase();
  mergeCatalog(
    db,
    parseImport(
      "topic,pattern,title,id,difficulty\nArrays,Two pointers,Two Sum,1,Easy\nArrays,Window,Another,2,Medium\nTrees,BFS,Levels,3,Easy",
    ).catalog,
  );
  return db;
};
const attempt = (
  db = seed(),
  outcome: "independent" | "hint" | "solution" | "failed" = "independent",
  at = "2026-09-17T09:00:00.000Z",
  mode: "solve" | "recall" = "solve",
) => ({
  id: crypto.randomUUID(),
  problemId: db.problems[0].id,
  patternId: db.problems[0].patternIds[0],
  mode,
  outcome,
  minutes: 20,
  at,
  note: "",
});
test("CSV handles quoted multiline fields, escaped quotes and semicolon export", () => {
  assert.deepEqual(
    csvRows('topic;pattern;title\nArrays;Pointers;"a, b\n\"\"quoted\"\""'),
    [
      ["topic", "pattern", "title"],
      ["Arrays", "Pointers", 'a, b\n"quoted"'],
    ],
  );
  assert.throws(() => csvRows('a,b\n"unterminated'));
});
test("Numbers layout deduplicates tasks across patterns and recovers noisy numeric prefixes", () => {
  const r = parseImport(
    'Pattern,Problems\nI. Arrays,\nPattern 1,"1. Two Sum, 3  547. Number of Provinces"\nPattern 2,"1. Two Sum"',
  );
  assert.equal(r.catalog.problems.length, 2);
  assert.equal(r.catalog.problems[0].patternIds.length, 2);
  assert.equal(r.catalog.problems[1].id, "lc-547");
  assert.ok(r.warnings.some((w) => w.includes("лишние")));
});
test("Import preserves attempt history, suspension and existing difficulty", () => {
  const db = seed();
  recordAttempt(db, attempt(db));
  db.problems[0].suspended = true;
  mergeCatalog(
    db,
    parseImport("topic,pattern,title,id\nGraphs,DSU,Two Sum,1").catalog,
  );
  assert.equal(db.problems.length, 3);
  assert.equal(db.problems[0].patternIds.length, 2);
  assert.equal(db.problems[0].difficulty, "Easy");
  assert.equal(db.problems[0].suspended, true);
  assert.equal(db.attempts.length, 1);
});
test("Unsafe links stay inert; malformed JSON is rejected", () => {
  const r = parseImport("topic,pattern,title,url\nA,B,C,javascript:alert(1)");
  assert.equal(r.catalog.problems[0].url, "");
  assert.equal(r.warnings.length, 1);
  assert.throws(() => parseImport('{"problems":[]}'));
});
test("Full solve and recall have independent schedules and first-attempt semantics", () => {
  const db = seed();
  recordAttempt(db, attempt(db));
  assert.equal(db.cards.length, 2);
  assert.equal(db.attempts[0].first, true);
  const fullDue = db.cards.find((c) => c.mode === "solve")!.due;
  recordAttempt(
    db,
    attempt(db, "independent", "2026-09-18T09:00:00.000Z", "recall"),
  );
  assert.equal(db.cards.find((c) => c.mode === "solve")!.due, fullDue);
  assert.equal(db.attempts[1].first, false);
  recordAttempt(db, attempt(db, "independent", "2026-09-19T09:00:00.000Z"));
  assert.equal(db.attempts[2].first, false);
  assert.equal(
    db.cards.find((c) => c.mode === "solve")!.due,
    "2026-09-22T09:00:00.000Z",
  );
});
test("A different approach gets its own schedule", () => {
  const db = seed();
  db.problems[0].patternIds.push(db.patterns[1].id);
  recordAttempt(db, attempt(db));
  const previous = db.cards[0].due;
  recordAttempt(db, {
    ...attempt(db, "independent", "2026-09-18T09:00:00.000Z"),
    patternId: db.patterns[1].id,
  });
  assert.equal(db.cards[0].due, previous);
  assert.equal(db.cards.filter((c) => c.mode === "solve").length, 2);
});
test("Failed and assisted attempts return in one day; duplicate or invalid times are rejected", () => {
  const db = seed();
  for (const outcome of ["hint", "solution", "failed"] as const) {
    const input = attempt(db, outcome);
    recordAttempt(db, input);
    assert.equal(db.cards[0].due, "2026-09-18T09:00:00.000Z");
    assert.throws(() => recordAttempt(db, input));
  }
  assert.throws(() => recordAttempt(db, { ...attempt(db), minutes: NaN }));
  assert.throws(() => recordAttempt(db, { ...attempt(db), minutes: 0 }));
});
test("Queue contains only current/learned material, prioritizes due work and fits budget", () => {
  const db = seed();
  recordAttempt(db, attempt(db));
  db.settings.budget = 45;
  const queue = buildQueue(db, Date.parse("2026-09-19T09:00:00Z"));
  assert.equal(queue[0].kind, "review");
  assert.ok(queue.every((i) => i.problemId !== "lc-3"));
  assert.ok(queue.reduce((s, i) => s + i.minutes, 0) <= 45);
  assert.equal(new Set(queue.map((i) => i.problemId)).size, queue.length);
});
test("Suspension and not-yet-due dates are honored, recall cannot duplicate full solve", () => {
  const db = seed();
  recordAttempt(db, attempt(db));
  db.settings.includeRecall = true;
  assert.ok(
    !buildQueue(db, Date.parse("2026-09-17T10:00:00Z")).some(
      (i) => i.problemId === "lc-1",
    ),
  );
  const q = buildQueue(db, Date.parse("2026-09-19T10:00:00Z"));
  assert.equal(q.filter((i) => i.problemId === "lc-1").length, 1);
  assert.equal(q.find((i) => i.problemId === "lc-1")!.mode, "solve");
  db.problems[0].suspended = true;
  assert.ok(
    !buildQueue(db, Date.parse("2026-09-19T10:00:00Z")).some(
      (i) => i.problemId === "lc-1",
    ),
  );
});
test("An unseen task from a practiced pattern is offered as transfer", () => {
  const db = seed();
  recordAttempt(db, attempt(db));
  mergeCatalog(
    db,
    parseImport(
      "topic,pattern,title,id,difficulty\nArrays,Two pointers,Variation,4,Easy",
    ).catalog,
  );
  db.settings.topicId = db.topics[1].id;
  const q = buildQueue(db, Date.parse("2026-09-17T10:00:00Z"));
  assert.ok(q.some((i) => i.problemId === "lc-4" && i.kind === "transfer"));
});
test("Timer uses timestamps, pause excludes idle time", () => {
  const active = {
    id: "a",
    problemId: "p",
    patternId: "p",
    mode: "solve" as const,
    startedAt: "",
    runningSince: 1000,
    elapsedMs: 3000,
    hinted: false,
    reason: "",
  };
  assert.equal(elapsed(active, 5000), 7000);
  assert.equal(elapsed({ ...active, runningSince: null }, 500000), 3000);
});
test("Database validation rejects unsupported version and broken references", () => {
  assert.equal(validateDatabase(seed()).version, 1);
  assert.throws(() => validateDatabase({ ...seed(), version: 2 }));
  const broken = seed();
  broken.problems[0].patternIds = ["missing"];
  assert.throws(() => validateDatabase(broken));
});
test("Store serializes concurrent writes and never commits failed writes in memory", async () => {
  let raw = JSON.stringify(seed());
  let fail = false;
  const store = new Store({
    read: async () => raw,
    create: async (s) => {
      raw = s;
    },
    replace: async (expected, next) => {
      assert.equal(raw, expected);
      if (fail) throw new Error("disk full");
      await new Promise((r) => setTimeout(r, 2));
      raw = next;
    },
  });
  await store.load();
  await Promise.all([
    store.change((d) => {
      d.settings.budget = 90;
    }),
    store.change((d) => {
      d.settings.newPercent = 80;
    }),
  ]);
  assert.equal(store.db.settings.budget, 90);
  assert.equal(store.db.settings.newPercent, 80);
  const revision = store.db.revision;
  fail = true;
  await assert.rejects(
    store.change((d) => {
      d.settings.budget = 120;
    }),
  );
  assert.equal(store.db.settings.budget, 90);
  assert.equal(store.db.revision, revision);
  fail = false;
  await store.change((d) => {
    d.settings.budget = 30;
  });
  assert.equal(store.db.settings.budget, 30);
});
test("External edits are detected before overwriting data", async () => {
  let raw = JSON.stringify(seed());
  const store = new Store({
    read: async () => raw,
    create: async (text) => {
      raw = text;
    },
    replace: async (expected, next) => {
      if (expected !== raw) throw new Error("conflict");
      raw = next;
    },
  });
  await store.load();
  raw = raw + " ";
  await assert.rejects(
    store.change((d) => {
      d.settings.budget = 20;
    }),
  );
  assert.equal(store.db.settings.budget, 60);
  await store.reload();
  await store.change((d) => {
    d.settings.budget = 20;
  });
  assert.equal(store.db.settings.budget, 20);
});
