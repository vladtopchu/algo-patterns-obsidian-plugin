/* Algo Patterns — local algorithm practice tracker */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  FinishModal: () => FinishModal,
  ImportModal: () => ImportModal,
  ProblemModal: () => ProblemModal,
  TrainerView: () => TrainerView,
  default: () => AlgoPatternsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/core.ts
var outcomeLabels = {
  independent: "\u0421\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E",
  hint: "\u0421 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u043E\u0439",
  solution: "\u0420\u0430\u0437\u043E\u0431\u0440\u0430\u043B \u0440\u0435\u0448\u0435\u043D\u0438\u0435",
  failed: "\u041D\u0435 \u0440\u0435\u0448\u0438\u043B"
};
var modeLabels = {
  solve: "\u041F\u043E\u043B\u043D\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435",
  recall: "\u0412\u0441\u043F\u043E\u043C\u043D\u0438\u0442\u044C \u043F\u043E\u0434\u0445\u043E\u0434"
};
var intervals = [1, 3, 7, 14, 30, 60, 90];
var uid = () => crypto.randomUUID();
var emptyDatabase = () => ({
  version: 1,
  revision: 0,
  topics: [],
  patterns: [],
  problems: [],
  attempts: [],
  cards: [],
  active: null,
  settings: {
    topicId: "",
    patternId: "",
    budget: 60,
    newPercent: 60,
    hidePattern: true,
    includeRecall: false
  }
});
function elapsed(active, now = Date.now()) {
  return Math.max(
    0,
    active.elapsedMs + (active.runningSince === null ? 0 : now - active.runningSince)
  );
}
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
function nextCard(previous, attempt) {
  const step = attempt.outcome === "independent" ? Math.min((previous?.step ?? -1) + 1, intervals.length - 1) : 0;
  return {
    problemId: attempt.problemId,
    patternId: attempt.patternId,
    mode: attempt.mode,
    step,
    lastAt: attempt.at,
    due: new Date(
      Date.parse(attempt.at) + intervals[step] * 864e5
    ).toISOString()
  };
}
function recordAttempt(db, input2) {
  if (!db.problems.some(
    (p) => p.id === input2.problemId && p.patternIds.includes(input2.patternId)
  ))
    throw new Error("\u0417\u0430\u0434\u0430\u0447\u0430 \u0438\u043B\u0438 \u043F\u0430\u0442\u0442\u0435\u0440\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B.");
  if (!Number.isFinite(input2.minutes) || input2.minutes <= 0 || input2.minutes > 1440)
    throw new Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0432\u0440\u0435\u043C\u044F \u043E\u0442 0,01 \u0434\u043E 1440 \u043C\u0438\u043D\u0443\u0442.");
  if (db.attempts.some((a) => a.id === input2.id))
    throw new Error("\u042D\u0442\u0430 \u043F\u043E\u043F\u044B\u0442\u043A\u0430 \u0443\u0436\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430.");
  const first = !db.attempts.some(
    (a) => a.problemId === input2.problemId && a.mode === "solve"
  );
  const attempt = { ...input2, first: input2.mode === "solve" && first };
  db.attempts.push(attempt);
  const index = db.cards.findIndex(
    (c) => c.problemId === input2.problemId && c.patternId === input2.patternId && c.mode === input2.mode
  );
  const card = nextCard(db.cards[index], attempt);
  if (index < 0) db.cards.push(card);
  else db.cards[index] = card;
  if (input2.mode === "solve" && !db.cards.some(
    (c) => c.problemId === input2.problemId && c.patternId === input2.patternId && c.mode === "recall"
  )) {
    db.cards.push({
      ...card,
      mode: "recall",
      step: 0,
      due: new Date(Date.parse(input2.at) + 864e5).toISOString()
    });
  }
  db.active = null;
}
function estimate(db, problem, mode) {
  if (mode === "recall") return 5;
  const same = db.attempts.filter(
    (a) => a.mode === "solve" && a.outcome === "independent" && a.problemId === problem.id
  ).slice(-5).map((a) => a.minutes);
  return Math.max(
    5,
    Math.round(
      median(same) || { Easy: 15, Medium: 30, Hard: 45, Unknown: 30 }[problem.difficulty]
    )
  );
}
function buildQueue(db, now = Date.now()) {
  const tried = new Set(
    db.attempts.filter((a) => a.mode === "solve").map((a) => a.problemId)
  );
  const learned = new Set(
    db.attempts.filter((a) => a.mode === "solve").map((a) => a.patternId)
  );
  const seen = /* @__PURE__ */ new Set();
  const reviews = [];
  for (const card of [...db.cards].sort(
    (a, b) => a.due.localeCompare(b.due) || (a.mode === "solve" ? -1 : 1)
  )) {
    const problem = db.problems.find((p) => p.id === card.problemId);
    if (!problem || problem.suspended || Date.parse(card.due) > now || card.mode === "recall" && !db.settings.includeRecall)
      continue;
    if (card.mode === "recall" && db.cards.some(
      (c) => c.problemId === card.problemId && c.mode === "solve" && Date.parse(c.due) <= now
    ))
      continue;
    if (seen.has(problem.id)) continue;
    seen.add(problem.id);
    reviews.push({
      problemId: problem.id,
      patternId: card.patternId,
      mode: card.mode,
      kind: "review",
      minutes: estimate(db, problem, card.mode),
      reason: `\u041F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u0435 \xB7 \u0441\u0440\u043E\u043A ${new Date(card.due).toLocaleDateString("ru-RU")}`
    });
  }
  const fresh = [];
  for (const problem of db.problems) {
    if (problem.suspended || tried.has(problem.id)) continue;
    const current = problem.patternIds.find(
      (id) => db.patterns.some(
        (p) => p.id === id && p.topicId === db.settings.topicId && (!db.settings.patternId || p.id === db.settings.patternId)
      )
    );
    const transfer = problem.patternIds.find((id) => learned.has(id));
    const patternId = current || transfer;
    if (!patternId) continue;
    const item = {
      problemId: problem.id,
      patternId,
      mode: "solve",
      kind: current ? "new" : "transfer",
      minutes: estimate(db, problem, "solve"),
      reason: current ? "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430" : "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u043D\u0430 \u0437\u043D\u0430\u043A\u043E\u043C\u044B\u0439 \u043F\u0430\u0442\u0442\u0435\u0440\u043D"
    };
    if (current) fresh.push(item);
    else reviews.push(item);
  }
  fresh.sort((a, b) => a.minutes - b.minutes);
  const result = [];
  const selected = /* @__PURE__ */ new Set();
  let remaining = db.settings.budget;
  const take = (items, cap) => {
    let used = 0;
    for (const item of items)
      if (!selected.has(item.problemId) && item.minutes <= remaining && used + item.minutes <= cap) {
        result.push(item);
        selected.add(item.problemId);
        remaining -= item.minutes;
        used += item.minutes;
      }
  };
  const newCap = db.settings.budget * db.settings.newPercent / 100;
  take(reviews, db.settings.budget - newCap);
  take(fresh, newCap);
  take(reviews, remaining);
  take(fresh, remaining);
  return result;
}
function mergeCatalog(db, incoming) {
  for (const topic of incoming.topics)
    if (!db.topics.some((t) => t.id === topic.id)) db.topics.push(topic);
  for (const pattern of incoming.patterns)
    if (!db.patterns.some((p) => p.id === pattern.id))
      db.patterns.push(pattern);
  let added = 0, updated = 0;
  for (const item of incoming.problems) {
    const existing = db.problems.find((p) => p.id === item.id);
    if (existing) {
      existing.patternIds = [
        .../* @__PURE__ */ new Set([...existing.patternIds, ...item.patternIds])
      ];
      existing.title = item.title;
      existing.url = item.url || existing.url;
      if (item.difficulty !== "Unknown") existing.difficulty = item.difficulty;
      updated++;
    } else {
      db.problems.push(item);
      added++;
    }
  }
  if (!db.settings.topicId) db.settings.topicId = db.topics[0]?.id ?? "";
  return { added, updated };
}
function validateDatabase(value) {
  const d = value;
  if (!d || d.version !== 1 || !Number.isInteger(d.revision) || !Array.isArray(d.topics) || !Array.isArray(d.patterns) || !Array.isArray(d.problems) || !Array.isArray(d.attempts) || !Array.isArray(d.cards) || !d.settings)
    throw new Error(
      "\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0438\u043B\u0438 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0431\u0430\u0437\u044B. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0444\u0430\u0439\u043B \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D."
    );
  const unique = (items) => items.every((i) => i && typeof i.id === "string" && i.id.length > 0) && new Set(items.map((i) => i.id)).size === items.length;
  if (!unique(d.topics) || !unique(d.patterns) || !unique(d.problems) || !unique(d.attempts))
    throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u0431\u0430\u0437\u044B.");
  if (d.topics.some((t) => typeof t.name !== "string") || d.patterns.some(
    (p) => typeof p.name !== "string" || !d.topics.some((t) => t.id === p.topicId)
  ) || d.problems.some(
    (p) => typeof p.title !== "string" || typeof p.url !== "string" || !["Easy", "Medium", "Hard", "Unknown"].includes(p.difficulty) || !Array.isArray(p.patternIds) || !p.patternIds.length || p.patternIds.some((id) => !d.patterns.some((t) => t.id === id))
  ))
    throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u0441\u0432\u044F\u0437\u0438 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430.");
  const validRef = (a) => d.problems.some(
    (p) => p.id === a.problemId && p.patternIds.includes(a.patternId)
  ) && ["solve", "recall"].includes(a.mode);
  if (d.attempts.some(
    (a) => !validRef(a) || !Object.keys(outcomeLabels).includes(a.outcome) || !Number.isFinite(a.minutes) || a.minutes <= 0 || !Number.isFinite(Date.parse(a.at)) || typeof a.note !== "string" || typeof a.first !== "boolean"
  ) || d.cards.some(
    (c) => !validRef(c) || !Number.isInteger(c.step) || c.step < 0 || c.step >= intervals.length || !Number.isFinite(Date.parse(c.due)) || !Number.isFinite(Date.parse(c.lastAt))
  ))
    throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u043F\u043E\u043F\u044B\u0442\u043A\u0438 \u0438\u043B\u0438 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435.");
  if (!Number.isFinite(d.settings.budget) || d.settings.budget < 5 || d.settings.budget > 480 || !Number.isFinite(d.settings.newPercent) || d.settings.newPercent < 0 || d.settings.newPercent > 100 || typeof d.settings.hidePattern !== "boolean" || typeof d.settings.includeRecall !== "boolean" || typeof d.settings.topicId !== "string" || typeof d.settings.patternId !== "string")
    throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438.");
  if (d.active && (!validRef(d.active) || typeof d.active.id !== "string" || !Number.isFinite(d.active.elapsedMs) || d.active.elapsedMs < 0 || d.active.runningSince !== null && !Number.isFinite(d.active.runningSince)))
    throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u0442\u0430\u0439\u043C\u0435\u0440.");
  return d;
}

// src/importer.ts
var key = (text) => {
  let h = 2166136261;
  for (const c of text.normalize("NFKC").trim().toLowerCase())
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
function csvRows(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const separator = first.includes("	") ? "	" : first.split(";").length > first.split(",").length ? ";" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || !field) quoted = !quoted;
      else field += c;
    } else if (c === separator && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("\u041D\u0435\u0437\u0430\u043A\u0440\u044B\u0442\u0430\u044F \u043A\u0430\u0432\u044B\u0447\u043A\u0430 \u0432 CSV. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u044D\u043A\u0441\u043F\u043E\u0440\u0442.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function difficulty(text) {
  const value = text.trim().toLowerCase();
  return {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    unknown: "Unknown",
    \u043B\u0451\u0433\u043A\u0430\u044F: "Easy",
    \u043B\u0435\u0433\u043A\u0430\u044F: "Easy",
    \u0441\u0440\u0435\u0434\u043D\u044F\u044F: "Medium",
    \u0441\u043B\u043E\u0436\u043D\u0430\u044F: "Hard"
  }[value] ?? "Unknown";
}
function parseImport(text) {
  const catalog = { topics: [], patterns: [], problems: [] };
  const warnings = [];
  const add = (topicName, patternName, title, id, url = "", level = "") => {
    if (!topicName || !patternName || !title)
      throw new Error("\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0443\u0436\u043D\u044B \u0442\u0435\u043C\u0430, \u043F\u0430\u0442\u0442\u0435\u0440\u043D \u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435.");
    const topicId = "topic-" + key(topicName);
    const patternId = "pattern-" + key(topicName + "|" + patternName);
    if (!catalog.topics.some((t) => t.id === topicId))
      catalog.topics.push({ id: topicId, name: topicName });
    if (!catalog.patterns.some((p) => p.id === patternId))
      catalog.patterns.push({ id: patternId, name: patternName, topicId });
    const problemId = /^\d+$/.test(id) ? "lc-" + id : id || "custom-" + key(title);
    let safeUrl = "";
    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        safeUrl = parsed.href;
      } catch {
        warnings.push(`\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 \u0443 \xAB${title}\xBB \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430.`);
      }
    }
    if (!safeUrl && problemId.startsWith("lc-"))
      safeUrl = "https://leetcode.com/problemset/?search=" + encodeURIComponent(problemId.slice(3));
    const existing = catalog.problems.find((p) => p.id === problemId);
    if (existing) {
      if (!existing.patternIds.includes(patternId))
        existing.patternIds.push(patternId);
      if (difficulty(level) !== "Unknown")
        existing.difficulty = difficulty(level);
    } else
      catalog.problems.push({
        id: problemId,
        title,
        url: safeUrl,
        difficulty: difficulty(level),
        patternIds: [patternId]
      });
    if (level && difficulty(level) === "Unknown" && level.toLowerCase() !== "unknown")
      warnings.push(`\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \xAB${level}\xBB: ${title}.`);
  };
  if (text.trimStart().startsWith("{")) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.topics) || !Array.isArray(data.patterns) || !Array.isArray(data.problems))
      throw new Error("JSON \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C topics, patterns \u0438 problems.");
    for (const problem of data.problems) {
      if (!Array.isArray(problem.patternIds) || !problem.patternIds.length || typeof problem.title !== "string" || typeof problem.id !== "string")
        throw new Error("\u0417\u0430\u0434\u0430\u0447\u0430 JSON \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 title, id \u0438\u043B\u0438 patternIds.");
      for (const id of problem.patternIds) {
        const pattern = data.patterns.find((p) => p.id === id);
        const topic = data.topics.find(
          (t) => t.id === pattern?.topicId
        );
        if (!pattern || !topic || typeof pattern.name !== "string" || typeof topic.name !== "string")
          throw new Error("\u0423 \u0437\u0430\u0434\u0430\u0447\u0438 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u0435\u043C\u0430 \u0438\u043B\u0438 \u043F\u0430\u0442\u0442\u0435\u0440\u043D.");
        add(
          topic.name,
          pattern.name,
          problem.title,
          problem.id,
          problem.url ?? "",
          problem.difficulty ?? ""
        );
      }
    }
    if (data.attempts?.length)
      warnings.push(
        "\u042D\u0442\u043E\u0442 \u0438\u043C\u043F\u043E\u0440\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433. \u0414\u043B\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \xAB\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E\xBB."
      );
  } else {
    const rows = csvRows(text);
    if (!rows.length) throw new Error("\u0424\u0430\u0439\u043B \u043F\u0443\u0441\u0442.");
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (...names) => headers.findIndex((h) => names.includes(h));
    const ti = idx("topic", "\u0442\u0435\u043C\u0430"), pi = idx("pattern", "\u043F\u0430\u0442\u0442\u0435\u0440\u043D"), ni = idx("title", "problem", "\u0437\u0430\u0434\u0430\u0447\u0430", "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"), ids = idx("id", "\u043D\u043E\u043C\u0435\u0440"), ui = idx("url", "\u0441\u0441\u044B\u043B\u043A\u0430"), di = idx("difficulty", "\u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C");
    if (ti >= 0 && pi >= 0 && ni >= 0) {
      rows.slice(1).forEach((row, i) => {
        try {
          add(
            row[ti] ?? "",
            row[pi] ?? "",
            row[ni] ?? "",
            row[ids] ?? "",
            row[ui] ?? "",
            row[di] ?? ""
          );
        } catch (e) {
          warnings.push(`\u0421\u0442\u0440\u043E\u043A\u0430 ${i + 2}: ${e.message}`);
        }
      });
    } else if (pi >= 0 && idx("problems") >= 0) {
      const problemsIndex = idx("problems");
      let topic = "";
      for (const [index, row] of rows.slice(1).entries()) {
        const pattern = row[pi] ?? "", problems = row[problemsIndex] ?? "";
        if (!pattern && !problems) continue;
        if (pattern && !problems && !/^Pattern\s+\d/i.test(pattern)) {
          topic = pattern;
          continue;
        }
        if (!topic || !pattern) {
          warnings.push(`\u0421\u0442\u0440\u043E\u043A\u0430 ${index + 2}: \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0442\u0435\u043C\u0430 \u0438\u043B\u0438 \u043F\u0430\u0442\u0442\u0435\u0440\u043D.`);
          continue;
        }
        const matches = [
          ...problems.matchAll(/(?:^|,)\s*(?:\d+\s+)?(\d+)\s*\.\s*([^,]+)/g)
        ];
        if (!matches.length) {
          warnings.push(`\u0421\u0442\u0440\u043E\u043A\u0430 ${index + 2}: \u0441\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u0434\u0430\u0447 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D.`);
          continue;
        }
        for (const match of matches)
          add(topic, pattern, match[2].trim(), match[1]);
        if (/\d+\s+\d+\s*\./.test(problems))
          warnings.push(
            `\u0421\u0442\u0440\u043E\u043A\u0430 ${index + 2}: \u0443\u0431\u0440\u0430\u043D\u044B \u043B\u0438\u0448\u043D\u0438\u0435 \u0447\u0438\u0441\u043B\u0430 \u043F\u0435\u0440\u0435\u0434 ID; \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A.`
          );
      }
      warnings.push(
        "\u0421\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0434\u0432\u0443\u0445 \u043A\u043E\u043B\u043E\u043D\u043A\u0430\u0445: \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u043A\u0430\u043A \xABUnknown\xBB. \u0421\u0432\u044F\u0437\u0438 \u0441 \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u0430\u043C\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0438\u0437 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B \u043D\u0430 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C."
      );
    } else
      throw new Error(
        "\u041D\u0443\u0436\u043D\u044B \u043A\u043E\u043B\u043E\u043D\u043A\u0438 topic, pattern, title (\u043E\u043F\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E id, url, difficulty) \u043B\u0438\u0431\u043E Pattern, Problems \u0438\u0437 Numbers."
      );
  }
  if (!catalog.problems.length)
    throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u043D\u0438 \u043E\u0434\u043D\u043E\u0439 \u0437\u0430\u0434\u0430\u0447\u0438.");
  return { catalog, warnings };
}

// src/store.ts
var Store = class {
  constructor(port) {
    this.port = port;
  }
  db = emptyDatabase();
  raw = "";
  queue = Promise.resolve();
  async load() {
    const raw = await this.port.read();
    if (raw === null) {
      const db = emptyDatabase();
      const text = JSON.stringify(db, null, 2);
      await this.port.create(text);
      this.db = db;
      this.raw = text;
    } else {
      const db = validateDatabase(JSON.parse(raw));
      this.db = db;
      this.raw = raw;
    }
  }
  change(mutator) {
    return this.exclusive(async () => {
      const draft = structuredClone(this.db);
      mutator(draft);
      draft.revision = this.db.revision + 1;
      validateDatabase(draft);
      const next = JSON.stringify(draft, null, 2);
      await this.port.replace(this.raw, next);
      this.raw = next;
      this.db = draft;
    });
  }
  // Folder moves and other disk operations share the same queue as writes.
  exclusive(action) {
    const operation = this.queue.then(action);
    this.queue = operation.catch(() => {
    });
    return operation;
  }
  async reload() {
    await this.exclusive(() => this.load());
  }
};

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_DATA_FOLDER = "_algo_patterns";
var LEGACY_DATA_FOLDER = "Algo Patterns";
function dataFolderPath(value) {
  const path = value.trim().replace(/\\/g, "/");
  const parts = path.split("/");
  if (!path || parts.some(
    (part) => !part || part.startsWith(".") || part !== part.trim() || /[<>:"|?*\x00-\x1f]/.test(part) || part.endsWith(".") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
  )) {
    throw new Error(
      "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u0443\u044E \u043F\u0430\u043F\u043A\u0443 \u0432\u043D\u0443\u0442\u0440\u0438 vault, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 _algo_patterns \u0438\u043B\u0438 \u0423\u0447\u0451\u0431\u0430/\u0410\u043B\u0433\u043E\u0440\u0438\u0442\u043C\u044B. \u0421\u043A\u0440\u044B\u0442\u044B\u0435 \u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0435 \u043F\u0443\u0442\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B."
    );
  }
  return (0, import_obsidian.normalizePath)(path);
}

// data/starter-catalog.json
var starter_catalog_default = {
  topics: [
    {
      id: "topic-1mwvr40",
      name: "I. Two Pointer Patterns"
    },
    {
      id: "topic-au8lmu",
      name: "II. Sliding Window Patterns"
    },
    {
      id: "topic-nnkf3m",
      name: "III. Tree Traversal Patterns (DFS & BFS)"
    },
    {
      id: "topic-z09v6i",
      name: "IV. Graph Traversal Patterns (DFS & BFS)"
    },
    {
      id: "topic-1qgoxqf",
      name: "V. Dynamic Programming (DP) Patterns"
    },
    {
      id: "topic-1v43kfd",
      name: "VI. Heap (Priority Queue) Patterns"
    },
    {
      id: "topic-h9ud9a",
      name: "VII. Backtracking Patterns"
    },
    {
      id: "topic-1f6u3wb",
      name: "VIII. Greedy Patterns"
    },
    {
      id: "topic-149jgy4",
      name: "IX. Binary Search Patterns"
    },
    {
      id: "topic-ti7xuy",
      name: "X. Stack Patterns"
    },
    {
      id: "topic-1f3thwf",
      name: "XI. Bit Manipulation Patterns"
    },
    {
      id: "topic-k563jm",
      name: "XII. Linked List Manipulation Patterns"
    },
    {
      id: "topic-3fr2pt",
      name: "XIII. Array/Matrix Manipulation Patterns"
    },
    {
      id: "topic-eiig6z",
      name: "XIV. String Manipulation Patterns"
    },
    {
      id: "topic-1grxg2u",
      name: "XV. Design Patterns"
    }
  ],
  patterns: [
    {
      id: "pattern-12gp12f",
      name: "Pattern 1: Two Pointers - Converging (Sorted Array Target Sum)",
      topicId: "topic-1mwvr40"
    },
    {
      id: "pattern-2r3apw",
      name: "Pattern 2: Two Pointers - Fast & Slow (Cycle Detection)",
      topicId: "topic-1mwvr40"
    },
    {
      id: "pattern-h1go7m",
      name: "Pattern 3: Two Pointers - Fixed Separation (Nth Node from End)",
      topicId: "topic-1mwvr40"
    },
    {
      id: "pattern-tmd5yv",
      name: "Pattern 4: Two Pointers - In-place Array Modification",
      topicId: "topic-1mwvr40"
    },
    {
      id: "pattern-jd7dva",
      name: "Pattern 5: Two Pointers - String Comparison with Backspaces",
      topicId: "topic-1mwvr40"
    },
    {
      id: "pattern-c28bx7",
      name: "Pattern 6: Two Pointers - Expanding From Center (Palindromes)",
      topicId: "topic-1mwvr40"
    },
    {
      id: "pattern-dahuv",
      name: "Pattern 7: Two Pointers - String Reversal",
      topicId: "topic-1mwvr40"
    },
    {
      id: "pattern-fon3hz",
      name: "Pattern 8: Sliding Window - Fixed Size (Subarray Calculation)",
      topicId: "topic-au8lmu"
    },
    {
      id: "pattern-4rr7nf",
      name: "Pattern 9: Sliding Window - Variable Size (Condition-Based)",
      topicId: "topic-au8lmu"
    },
    {
      id: "pattern-1qtw4h3",
      name: "Pattern 10: Sliding Window - Monotonic Queue for Max/Min",
      topicId: "topic-au8lmu"
    },
    {
      id: "pattern-1ougwf7",
      name: "Pattern 11: Sliding Window - Character Frequency Matching",
      topicId: "topic-au8lmu"
    },
    {
      id: "pattern-ainyqn",
      name: "Pattern 12: Tree BFS - Level Order Traversal",
      topicId: "topic-nnkf3m"
    },
    {
      id: "pattern-gfry4n",
      name: "Pattern 13: Tree DFS - Recursive Preorder Traversal",
      topicId: "topic-nnkf3m"
    },
    {
      id: "pattern-1c71rfs",
      name: "Pattern 14: Tree DFS - Recursive Inorder Traversal",
      topicId: "topic-nnkf3m"
    },
    {
      id: "pattern-2p0ln4",
      name: "Pattern 15: Tree DFS - Recursive Postorder Traversal",
      topicId: "topic-nnkf3m"
    },
    {
      id: "pattern-x497z0",
      name: "Pattern 16: Tree - Lowest Common Ancestor (LCA) Finding",
      topicId: "topic-nnkf3m"
    },
    {
      id: "pattern-17b590d",
      name: "Pattern 17: Tree - Serialization and Deserialization",
      topicId: "topic-nnkf3m"
    },
    {
      id: "pattern-d5bxtt",
      name: "Pattern 18: Graph DFS - Connected Components / Island Counting",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-1lvkts0",
      name: "Pattern 19: Graph BFS - Connected Components / Island Counting",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-fyucrs",
      name: "Pattern 20: Graph DFS - Cycle Detection (Directed Graph)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-1rp37cs",
      name: "Pattern 21: Graph BFS - Topological Sort (Kahn's Algorithm)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-10sw9ch",
      name: "Pattern 22: Graph - Deep Copy / Cloning",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-1qawopj",
      name: "Pattern 23: Graph - Shortest Path (Dijkstra's Algorithm)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-11yowli",
      name: "Pattern 24: Graph - Shortest Path (Bellman-Ford / BFS+K)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-1v5decy",
      name: "Pattern 25: Graph - Union-Find (Disjoint Set Union - DSU)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-178gwr3",
      name: "Pattern 26: Strongly Connected Components (Kosaraju / Tarjan)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-xy910j",
      name: "Pattern 27: Bridges & Articulation Points (Tarjan low-link)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-efc9q5",
      name: "Pattern 28: Minimum Spanning Tree (Kruskal / Prim / DSU + heap)",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-160mi2h",
      name: "Pattern 29: Bidirectional BFS (BFS optimization for known source & target",
      topicId: "topic-z09v6i"
    },
    {
      id: "pattern-1bs2guj",
      name: "Pattern 30: DP - 1D Array (Fibonacci Style)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-1tq0i9n",
      name: "Pattern 31: DP - 1D Array (Kadane's Algorithm for Max/Min Subarray)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-1xdph7l",
      name: "Pattern 32 DP - 1D Array (Coin Change / Unbounded Knapsack Style)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-cu7f6h",
      name: "Pattern 33: DP - 1D Array (0/1 Knapsack Subset Sum Style)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-lhg8a8",
      name: "Pattern 34: DP - 1D Array (Word Break Style)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-v0m8i7",
      name: "Pattern 35: DP - 2D Array (Longest Common Subsequence - LCS)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-15911qd",
      name: "Pattern 36: DP - 2D Array (Edit Distance / Levenshtein Distance)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-1wihp9i",
      name: "Pattern 37: DP - 2D Array (Unique Paths on Grid)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-10pk1u2",
      name: "Pattern 38: DP - Interval DP",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-13dqpnm",
      name: "Pattern 39: DP - Catalan Numbers",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-1mlrzsn",
      name: "Pattern 40: DP - Longest Increasing Subsequence (LIS)",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-ly2455",
      name: "Pattern 41: DP - Stock problems",
      topicId: "topic-1qgoxqf"
    },
    {
      id: "pattern-1gonlr5",
      name: "Pattern 42: Heap - Top K Elements (Selection/Frequency)",
      topicId: "topic-1v43kfd"
    },
    {
      id: "pattern-oq05l8",
      name: "Pattern 43: Heap - Two Heaps for Median Finding",
      topicId: "topic-1v43kfd"
    },
    {
      id: "pattern-1lq1lid",
      name: "Pattern 44: Heap - K-way Merge",
      topicId: "topic-1v43kfd"
    },
    {
      id: "pattern-ywkch9",
      name: "Pattern 45: Heap - Scheduling / Minimum Cost (Greedy with Priority Queue)",
      topicId: "topic-1v43kfd"
    },
    {
      id: "pattern-1mrzwhe",
      name: "Pattern 46: Backtracking - Subsets (Include/Exclude)",
      topicId: "topic-h9ud9a"
    },
    {
      id: "pattern-d02o6r",
      name: "Pattern 47: Backtracking - Permutations",
      topicId: "topic-h9ud9a"
    },
    {
      id: "pattern-qmt1v7",
      name: "Pattern 48: Backtracking - Combination Sum",
      topicId: "topic-h9ud9a"
    },
    {
      id: "pattern-18ohraa",
      name: "Pattern 49: Backtracking - Parentheses Generation",
      topicId: "topic-h9ud9a"
    },
    {
      id: "pattern-1u2uuzu",
      name: "Pattern 50: Backtracking - Word Search / Path Finding in Grid",
      topicId: "topic-h9ud9a"
    },
    {
      id: "pattern-8magw1",
      name: "Pattern 51: Backtracking - N-Queens / Constraint Satisfaction",
      topicId: "topic-h9ud9a"
    },
    {
      id: "pattern-mbs5p3",
      name: "Pattern 52: Backtracking - Palindrome Partitioning",
      topicId: "topic-h9ud9a"
    },
    {
      id: "pattern-itbfu7",
      name: "Pattern 53: Greedy - Interval Merging/Scheduling",
      topicId: "topic-1f6u3wb"
    },
    {
      id: "pattern-16mt16n",
      name: "Pattern 54: Greedy - Jump Game Reachability/Minimization",
      topicId: "topic-1f6u3wb"
    },
    {
      id: "pattern-12ny99j",
      name: "Pattern 55: Greedy - Buy/Sell Stock",
      topicId: "topic-1f6u3wb"
    },
    {
      id: "pattern-18tw7m7",
      name: "Pattern 56: Greedy - Gas Station Circuit",
      topicId: "topic-1f6u3wb"
    },
    {
      id: "pattern-1u8b6nf",
      name: "Pattern 57: Greedy - Task Scheduling (Frequency Based)",
      topicId: "topic-1f6u3wb"
    },
    {
      id: "pattern-4pxbco",
      name: "Pattern 58: Greedy - Sorting Based",
      topicId: "topic-1f6u3wb"
    },
    {
      id: "pattern-udcl86",
      name: "Pattern 59: Binary Search - On Sorted Array/List",
      topicId: "topic-149jgy4"
    },
    {
      id: "pattern-f2siui",
      name: "Pattern 60: Binary Search - Find Min/Max in Rotated Sorted Array",
      topicId: "topic-149jgy4"
    },
    {
      id: "pattern-1kq8b9y",
      name: "Pattern 61: Binary Search - On Answer / Condition Function",
      topicId: "topic-149jgy4"
    },
    {
      id: "pattern-sn15e3",
      name: "Pattern 62: Binary Search - Find First/Last Occurrence",
      topicId: "topic-149jgy4"
    },
    {
      id: "pattern-1swltnp",
      name: "Pattern 63: Binary Search - Median / Kth across Two Sorted Arrays",
      topicId: "topic-149jgy4"
    },
    {
      id: "pattern-nfb40k",
      name: "Pattern 64: Stack - Valid Parentheses Matching",
      topicId: "topic-ti7xuy"
    },
    {
      id: "pattern-1ba92cq",
      name: "Pattern 65: Stack - Monotonic Stack",
      topicId: "topic-ti7xuy"
    },
    {
      id: "pattern-ttlnjl",
      name: "Pattern 66: Stack - Expression Evaluation (RPN/Infix)",
      topicId: "topic-ti7xuy"
    },
    {
      id: "pattern-t2cxls",
      name: "Pattern 67: Stack - Simulation / Backtracking Helper",
      topicId: "topic-ti7xuy"
    },
    {
      id: "pattern-luy1jn",
      name: "Pattern 68: Stack - Min Stack Design",
      topicId: "topic-ti7xuy"
    },
    {
      id: "pattern-1en2olk",
      name: "Pattern 69: Stack - Largest Rectangle in Histogram",
      topicId: "topic-ti7xuy"
    },
    {
      id: "pattern-ggg52i",
      name: "Pattern 70: Bitwise XOR - Finding Single/Missing Number",
      topicId: "topic-1f3thwf"
    },
    {
      id: "pattern-17cb4jx",
      name: "Pattern 71:Bitwise AND - Counting Set Bits (Hamming Weight)",
      topicId: "topic-1f3thwf"
    },
    {
      id: "pattern-1vvxkz2",
      name: "Pattern 72: Bitwise DP - Counting Bits Optimization",
      topicId: "topic-1f3thwf"
    },
    {
      id: "pattern-123ysvi",
      name: "Pattern 73: Bitwise Operations - Power of Two/Four Check",
      topicId: "topic-1f3thwf"
    },
    {
      id: "pattern-14wit1i",
      name: "Pattern 74: Linked List - In-place Reversal",
      topicId: "topic-k563jm"
    },
    {
      id: "pattern-65lvhd",
      name: "Pattern 75: Linked List - Merging Two Sorted Lists",
      topicId: "topic-k563jm"
    },
    {
      id: "pattern-1q4dxbe",
      name: "Pattern 76: Linked List - Addition of Numbers",
      topicId: "topic-k563jm"
    },
    {
      id: "pattern-utu17i",
      name: "Pattern 77: Linked List - Intersection Detection",
      topicId: "topic-k563jm"
    },
    {
      id: "pattern-136icjh",
      name: "Pattern 78: Linked List - Reordering / Partitioning",
      topicId: "topic-k563jm"
    },
    {
      id: "pattern-1sv3txq",
      name: "Pattern 79: Array/Matrix - In-place Rotation",
      topicId: "topic-3fr2pt"
    },
    {
      id: "pattern-1v82cb6",
      name: "Pattern 80: Array/Matrix - Spiral Traversal",
      topicId: "topic-3fr2pt"
    },
    {
      id: "pattern-y29w42",
      name: "Pattern 81: Array/Matrix - Set Matrix Zeroes (In-place Marking)",
      topicId: "topic-3fr2pt"
    },
    {
      id: "pattern-1bn69ia",
      name: "Pattern 82: Array - Product Except Self (Prefix/Suffix Products)",
      topicId: "topic-3fr2pt"
    },
    {
      id: "pattern-1suwftd",
      name: "Pattern 83: Array - Plus One (Handling Carry)",
      topicId: "topic-3fr2pt"
    },
    {
      id: "pattern-21dvb0",
      name: "Pattern 84: Array - Merge Sorted Array (In-place from End)",
      topicId: "topic-3fr2pt"
    },
    {
      id: "pattern-1vp24t3",
      name: "Pattern 85: Array - Cyclic Sort",
      topicId: "topic-3fr2pt"
    },
    {
      id: "pattern-igs84m",
      name: "Pattern 86: String - Palindrome Check (Two Pointers / Reverse)",
      topicId: "topic-eiig6z"
    },
    {
      id: "pattern-1y3ybhc",
      name: "Pattern 87: String - Anagram Check (Frequency Count/Sort)",
      topicId: "topic-eiig6z"
    },
    {
      id: "pattern-weflnr",
      name: "Pattern 88: String - Roman to Integer Conversion",
      topicId: "topic-eiig6z"
    },
    {
      id: "pattern-wwkn2c",
      name: "Pattern 89: String - String to Integer (atoi)",
      topicId: "topic-eiig6z"
    },
    {
      id: "pattern-apflh8",
      name: "Pattern 90: String - Multiply Strings (Manual Simulation)",
      topicId: "topic-eiig6z"
    },
    {
      id: "pattern-1rhkwyy",
      name: "Pattern 91: String Matching - Naive / KMP / Rabin-Karp",
      topicId: "topic-eiig6z"
    },
    {
      id: "pattern-hu5lnk",
      name: "Pattern 92: String - Repeated Substring Pattern Detection",
      topicId: "topic-eiig6z"
    },
    {
      id: "pattern-8x6ycg",
      name: "Pattern 93: Design (General/Specific)",
      topicId: "topic-1grxg2u"
    },
    {
      id: "pattern-1mhdtac",
      name: "Pattern 94. Tries",
      topicId: "topic-1grxg2u"
    }
  ],
  problems: [
    {
      id: "lc-11",
      title: "Container With Most Water",
      url: "https://leetcode.com/problemset/?search=11",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-15",
      title: "3Sum",
      url: "https://leetcode.com/problemset/?search=15",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-16",
      title: "3Sum Closest",
      url: "https://leetcode.com/problemset/?search=16",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-18",
      title: "4Sum",
      url: "https://leetcode.com/problemset/?search=18",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-167",
      title: "Two Sum II - Input Array Is Sorted",
      url: "https://leetcode.com/problemset/?search=167",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-349",
      title: "Intersection of Two Arrays",
      url: "https://leetcode.com/problemset/?search=349",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-881",
      title: "Boats to Save People",
      url: "https://leetcode.com/problemset/?search=881",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-977",
      title: "Squares of a Sorted Array",
      url: "https://leetcode.com/problemset/?search=977",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f",
        "pattern-21dvb0"
      ]
    },
    {
      id: "lc-259",
      title: "3Sum Smaller",
      url: "https://leetcode.com/problemset/?search=259",
      difficulty: "Unknown",
      patternIds: [
        "pattern-12gp12f"
      ]
    },
    {
      id: "lc-141",
      title: "Linked List Cycle",
      url: "https://leetcode.com/problemset/?search=141",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2r3apw"
      ]
    },
    {
      id: "lc-202",
      title: "Happy Number",
      url: "https://leetcode.com/problemset/?search=202",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2r3apw"
      ]
    },
    {
      id: "lc-287",
      title: "Find the Duplicate Number",
      url: "https://leetcode.com/problemset/?search=287",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2r3apw",
        "pattern-1vp24t3"
      ]
    },
    {
      id: "lc-392",
      title: "Is Subsequence",
      url: "https://leetcode.com/problemset/?search=392",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2r3apw"
      ]
    },
    {
      id: "lc-19",
      title: "Remove Nth Node From End of List",
      url: "https://leetcode.com/problemset/?search=19",
      difficulty: "Unknown",
      patternIds: [
        "pattern-h1go7m"
      ]
    },
    {
      id: "lc-876",
      title: "Middle of the Linked List",
      url: "https://leetcode.com/problemset/?search=876",
      difficulty: "Unknown",
      patternIds: [
        "pattern-h1go7m"
      ]
    },
    {
      id: "lc-2095",
      title: "Delete the Middle Node of a Linked List",
      url: "https://leetcode.com/problemset/?search=2095",
      difficulty: "Unknown",
      patternIds: [
        "pattern-h1go7m"
      ]
    },
    {
      id: "lc-26",
      title: "Remove Duplicates from Sorted Array",
      url: "https://leetcode.com/problemset/?search=26",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-27",
      title: "Remove Element",
      url: "https://leetcode.com/problemset/?search=27",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-75",
      title: "Sort Colors",
      url: "https://leetcode.com/problemset/?search=75",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-80",
      title: "Remove Duplicates from Sorted Array II",
      url: "https://leetcode.com/problemset/?search=80",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-283",
      title: "Move Zeroes",
      url: "https://leetcode.com/problemset/?search=283",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-443",
      title: "String Compression",
      url: "https://leetcode.com/problemset/?search=443",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-905",
      title: "Sort Array By Parity",
      url: "https://leetcode.com/problemset/?search=905",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-2337",
      title: "Move Pieces to Obtain a String",
      url: "https://leetcode.com/problemset/?search=2337",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-2938",
      title: "Separate Black and White Balls",
      url: "https://leetcode.com/problemset/?search=2938",
      difficulty: "Unknown",
      patternIds: [
        "pattern-tmd5yv"
      ]
    },
    {
      id: "lc-844",
      title: "Backspace String Compare",
      url: "https://leetcode.com/problemset/?search=844",
      difficulty: "Unknown",
      patternIds: [
        "pattern-jd7dva"
      ]
    },
    {
      id: "lc-1598",
      title: "Crawler Log Folder",
      url: "https://leetcode.com/problemset/?search=1598",
      difficulty: "Unknown",
      patternIds: [
        "pattern-jd7dva"
      ]
    },
    {
      id: "lc-2390",
      title: "Removing Stars From a String",
      url: "https://leetcode.com/problemset/?search=2390",
      difficulty: "Unknown",
      patternIds: [
        "pattern-jd7dva"
      ]
    },
    {
      id: "lc-5",
      title: "Longest Palindromic Substring",
      url: "https://leetcode.com/problemset/?search=5",
      difficulty: "Unknown",
      patternIds: [
        "pattern-c28bx7"
      ]
    },
    {
      id: "lc-647",
      title: "Palindromic Substrings",
      url: "https://leetcode.com/problemset/?search=647",
      difficulty: "Unknown",
      patternIds: [
        "pattern-c28bx7"
      ]
    },
    {
      id: "lc-151",
      title: "Reverse Words in a String",
      url: "https://leetcode.com/problemset/?search=151",
      difficulty: "Unknown",
      patternIds: [
        "pattern-dahuv"
      ]
    },
    {
      id: "lc-344",
      title: "Reverse String",
      url: "https://leetcode.com/problemset/?search=344",
      difficulty: "Unknown",
      patternIds: [
        "pattern-dahuv"
      ]
    },
    {
      id: "lc-345",
      title: "Reverse Vowels of a String",
      url: "https://leetcode.com/problemset/?search=345",
      difficulty: "Unknown",
      patternIds: [
        "pattern-dahuv"
      ]
    },
    {
      id: "lc-541",
      title: "Reverse String II",
      url: "https://leetcode.com/problemset/?search=541",
      difficulty: "Unknown",
      patternIds: [
        "pattern-dahuv"
      ]
    },
    {
      id: "lc-346",
      title: "Moving Average from Data Stream",
      url: "https://leetcode.com/problemset/?search=346",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fon3hz",
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-643",
      title: "Maximum Average Subarray I",
      url: "https://leetcode.com/problemset/?search=643",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fon3hz"
      ]
    },
    {
      id: "lc-2985",
      title: "Calculate Compressed Mean",
      url: "https://leetcode.com/problemset/?search=2985",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fon3hz"
      ]
    },
    {
      id: "lc-3254",
      title: "Find the Power of K-Size Subarrays I",
      url: "https://leetcode.com/problemset/?search=3254",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fon3hz"
      ]
    },
    {
      id: "lc-3318",
      title: "Find X-Sum of All K-Long Subarrays I",
      url: "https://leetcode.com/problemset/?search=3318",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fon3hz"
      ]
    },
    {
      id: "lc-3",
      title: "Longest Substring Without Repeating Characters",
      url: "https://leetcode.com/problemset/?search=3",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-76",
      title: "Minimum Window Substring",
      url: "https://leetcode.com/problemset/?search=76",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-209",
      title: "Minimum Size Subarray Sum",
      url: "https://leetcode.com/problemset/?search=209",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-219",
      title: "Contains Duplicate II",
      url: "https://leetcode.com/problemset/?search=219",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-424",
      title: "Longest Repeating Character Replacement",
      url: "https://leetcode.com/problemset/?search=424",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-713",
      title: "Subarray Product Less Than K",
      url: "https://leetcode.com/problemset/?search=713",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-904",
      title: "Fruit Into Baskets",
      url: "https://leetcode.com/problemset/?search=904",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-1004",
      title: "Max Consecutive Ones III",
      url: "https://leetcode.com/problemset/?search=1004",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-1438",
      title: "Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit",
      url: "https://leetcode.com/problemset/?search=1438",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-1493",
      title: "Longest Subarray of 1's After Deleting One Element",
      url: "https://leetcode.com/problemset/?search=1493",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-1658",
      title: "Minimum Operations to Reduce X to Zero",
      url: "https://leetcode.com/problemset/?search=1658",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-1838",
      title: "Frequency of the Most Frequent Element",
      url: "https://leetcode.com/problemset/?search=1838",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-2461",
      title: "Maximum Sum of Distinct Subarrays With Length K",
      url: "https://leetcode.com/problemset/?search=2461",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-2516",
      title: "Take K of Each Character From Left and Right",
      url: "https://leetcode.com/problemset/?search=2516",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-2762",
      title: "Continuous Subarrays",
      url: "https://leetcode.com/problemset/?search=2762",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-2779",
      title: "Maximum Beauty of an Array After Applying Operation",
      url: "https://leetcode.com/problemset/?search=2779",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-2981",
      title: "Find Longest Special Substring That Occurs Thrice I",
      url: "https://leetcode.com/problemset/?search=2981",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-3026",
      title: "Maximum Good Subarray Sum",
      url: "https://leetcode.com/problemset/?search=3026",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-3346",
      title: "Maximum Frequency of an Element After Performing Operations I",
      url: "https://leetcode.com/problemset/?search=3346",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-3347",
      title: "Maximum Frequency of an Element After Performing Operations II 2",
      url: "https://leetcode.com/problemset/?search=3347",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4rr7nf"
      ]
    },
    {
      id: "lc-239",
      title: "Sliding Window Maximum",
      url: "https://leetcode.com/problemset/?search=239",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qtw4h3"
      ]
    },
    {
      id: "lc-862",
      title: "Shortest Subarray with Sum at Least K",
      url: "https://leetcode.com/problemset/?search=862",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qtw4h3"
      ]
    },
    {
      id: "lc-1696",
      title: "Jump Game VI",
      url: "https://leetcode.com/problemset/?search=1696",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qtw4h3"
      ]
    },
    {
      id: "lc-1",
      title: "TwoSum",
      url: "https://leetcode.com/problemset/?search=1",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ougwf7"
      ]
    },
    {
      id: "lc-438",
      title: "Find All Anagrams in a String",
      url: "https://leetcode.com/problemset/?search=438",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ougwf7"
      ]
    },
    {
      id: "lc-567",
      title: "Permutation in String",
      url: "https://leetcode.com/problemset/?search=567",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ougwf7"
      ]
    },
    {
      id: "lc-102",
      title: "Binary Tree Level Order Traversal",
      url: "https://leetcode.com/problemset/?search=102",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ainyqn"
      ]
    },
    {
      id: "lc-103",
      title: "Binary Tree Zigzag Level Order Traversal",
      url: "https://leetcode.com/problemset/?search=103",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ainyqn"
      ]
    },
    {
      id: "lc-199",
      title: "Binary Tree Right Side View",
      url: "https://leetcode.com/problemset/?search=199",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ainyqn"
      ]
    },
    {
      id: "lc-515",
      title: "Find Largest Value in Each Tree Row",
      url: "https://leetcode.com/problemset/?search=515",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ainyqn"
      ]
    },
    {
      id: "lc-1161",
      title: "Maximum Level Sum of a Binary Tree",
      url: "https://leetcode.com/problemset/?search=1161",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ainyqn"
      ]
    },
    {
      id: "lc-100",
      title: "Same Tree",
      url: "https://leetcode.com/problemset/?search=100",
      difficulty: "Unknown",
      patternIds: [
        "pattern-gfry4n"
      ]
    },
    {
      id: "lc-101",
      title: "Symmetric Tree",
      url: "https://leetcode.com/problemset/?search=101",
      difficulty: "Unknown",
      patternIds: [
        "pattern-gfry4n"
      ]
    },
    {
      id: "lc-105",
      title: "Construct Binary Tree from Preorder and Inorder Traversal",
      url: "https://leetcode.com/problemset/?search=105",
      difficulty: "Unknown",
      patternIds: [
        "pattern-gfry4n"
      ]
    },
    {
      id: "lc-114",
      title: "Flatten Binary Tree to Linked List",
      url: "https://leetcode.com/problemset/?search=114",
      difficulty: "Unknown",
      patternIds: [
        "pattern-gfry4n"
      ]
    },
    {
      id: "lc-226",
      title: "Invert Binary Tree",
      url: "https://leetcode.com/problemset/?search=226",
      difficulty: "Unknown",
      patternIds: [
        "pattern-gfry4n"
      ]
    },
    {
      id: "lc-257",
      title: "Binary Tree Paths",
      url: "https://leetcode.com/problemset/?search=257",
      difficulty: "Unknown",
      patternIds: [
        "pattern-gfry4n"
      ]
    },
    {
      id: "lc-988",
      title: "Smallest String Starting From Leaf",
      url: "https://leetcode.com/problemset/?search=988",
      difficulty: "Unknown",
      patternIds: [
        "pattern-gfry4n"
      ]
    },
    {
      id: "lc-94",
      title: "Binary Tree Inorder Traversal",
      url: "https://leetcode.com/problemset/?search=94",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1c71rfs"
      ]
    },
    {
      id: "lc-98",
      title: "Validate Binary Search Tree",
      url: "https://leetcode.com/problemset/?search=98",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1c71rfs"
      ]
    },
    {
      id: "lc-173",
      title: "Binary Search Tree Iterator",
      url: "https://leetcode.com/problemset/?search=173",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1c71rfs"
      ]
    },
    {
      id: "lc-230",
      title: "Kth Smallest Element in a BST",
      url: "https://leetcode.com/problemset/?search=230",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1c71rfs"
      ]
    },
    {
      id: "lc-501",
      title: "Find Mode in Binary Search Tree",
      url: "https://leetcode.com/problemset/?search=501",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1c71rfs"
      ]
    },
    {
      id: "lc-530",
      title: "Minimum Absolute Difference in BST",
      url: "https://leetcode.com/problemset/?search=530",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1c71rfs"
      ]
    },
    {
      id: "lc-104",
      title: "Maximum Depth of Binary Tree",
      url: "https://leetcode.com/problemset/?search=104",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-110",
      title: "Balanced Binary Tree",
      url: "https://leetcode.com/problemset/?search=110",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-124",
      title: "Binary Tree Maximum Path Sum",
      url: "https://leetcode.com/problemset/?search=124",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-145",
      title: "Binary Tree Postorder Traversal",
      url: "https://leetcode.com/problemset/?search=145",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-337",
      title: "House Robber III",
      url: "https://leetcode.com/problemset/?search=337",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4",
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-366",
      title: "Find Leaves of Binary Tree",
      url: "https://leetcode.com/problemset/?search=366",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-543",
      title: "Diameter of Binary Tree",
      url: "https://leetcode.com/problemset/?search=543",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-863",
      title: "All Nodes Distance K in Binary Tree",
      url: "https://leetcode.com/problemset/?search=863",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-1110",
      title: "Delete Nodes And Return Forest",
      url: "https://leetcode.com/problemset/?search=1110",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-2458",
      title: "Height of Binary Tree After Subtree Removal Queries",
      url: "https://leetcode.com/problemset/?search=2458",
      difficulty: "Unknown",
      patternIds: [
        "pattern-2p0ln4"
      ]
    },
    {
      id: "lc-235",
      title: "Lowest Common Ancestor of a Binary Search Tree",
      url: "https://leetcode.com/problemset/?search=235",
      difficulty: "Unknown",
      patternIds: [
        "pattern-x497z0"
      ]
    },
    {
      id: "lc-236",
      title: "Lowest Common Ancestor of a Binary Tree",
      url: "https://leetcode.com/problemset/?search=236",
      difficulty: "Unknown",
      patternIds: [
        "pattern-x497z0"
      ]
    },
    {
      id: "lc-297",
      title: "Serialize and Deserialize Binary Tree",
      url: "https://leetcode.com/problemset/?search=297",
      difficulty: "Unknown",
      patternIds: [
        "pattern-17b590d"
      ]
    },
    {
      id: "lc-572",
      title: "Subtree of Another Tree",
      url: "https://leetcode.com/problemset/?search=572",
      difficulty: "Unknown",
      patternIds: [
        "pattern-17b590d"
      ]
    },
    {
      id: "lc-652",
      title: "Find Duplicate Subtrees",
      url: "https://leetcode.com/problemset/?search=652",
      difficulty: "Unknown",
      patternIds: [
        "pattern-17b590d"
      ]
    },
    {
      id: "lc-130",
      title: "Surrounded Regions",
      url: "https://leetcode.com/problemset/?search=130",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-200",
      title: "Number of Islands",
      url: "https://leetcode.com/problemset/?search=200",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt",
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-417",
      title: "Pacific Atlantic Water Flow",
      url: "https://leetcode.com/problemset/?search=417",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-547",
      title: "Number of Provinces",
      url: "https://leetcode.com/problemset/?search=547",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt",
        "pattern-1v5decy",
        "pattern-178gwr3"
      ]
    },
    {
      id: "lc-695",
      title: "Max Area of Island",
      url: "https://leetcode.com/problemset/?search=695",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-733",
      title: "Flood Fill",
      url: "https://leetcode.com/problemset/?search=733",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-841",
      title: "Keys and Rooms",
      url: "https://leetcode.com/problemset/?search=841",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-1020",
      title: "Number of Enclaves",
      url: "https://leetcode.com/problemset/?search=1020",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-1254",
      title: "Number of Closed Islands",
      url: "https://leetcode.com/problemset/?search=1254",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-1905",
      title: "Count Sub Islands",
      url: "https://leetcode.com/problemset/?search=1905",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-2101",
      title: "Detonate the Maximum Bombs",
      url: "https://leetcode.com/problemset/?search=2101",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d5bxtt"
      ]
    },
    {
      id: "lc-542",
      title: "01 Matrix",
      url: "https://leetcode.com/problemset/?search=542",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1lvkts0"
      ]
    },
    {
      id: "lc-994",
      title: "Rotting Oranges",
      url: "https://leetcode.com/problemset/?search=994",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1lvkts0"
      ]
    },
    {
      id: "lc-1091",
      title: "Shortest Path in Binary Matrix",
      url: "https://leetcode.com/problemset/?search=1091",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1lvkts0"
      ]
    },
    {
      id: "lc-207",
      title: "Course Schedule",
      url: "https://leetcode.com/problemset/?search=207",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fyucrs"
      ]
    },
    {
      id: "lc-210",
      title: "Course Schedule II",
      url: "https://leetcode.com/problemset/?search=210",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fyucrs",
        "pattern-1rp37cs",
        "pattern-178gwr3"
      ]
    },
    {
      id: "lc-802",
      title: "Find Eventual Safe States",
      url: "https://leetcode.com/problemset/?search=802",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fyucrs"
      ]
    },
    {
      id: "lc-1059",
      title: "All Paths from Source Lead to Destination",
      url: "https://leetcode.com/problemset/?search=1059",
      difficulty: "Unknown",
      patternIds: [
        "pattern-fyucrs"
      ]
    },
    {
      id: "lc-269",
      title: "Alien Dictionary",
      url: "https://leetcode.com/problemset/?search=269",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-310",
      title: "Minimum Height Trees",
      url: "https://leetcode.com/problemset/?search=310",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-444",
      title: "Sequence Reconstruction",
      url: "https://leetcode.com/problemset/?search=444",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-1136",
      title: "Parallel Courses",
      url: "https://leetcode.com/problemset/?search=1136",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-1857",
      title: "Largest Color Value in a Directed Graph",
      url: "https://leetcode.com/problemset/?search=1857",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-2050",
      title: "Parallel Courses III",
      url: "https://leetcode.com/problemset/?search=2050",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-2115",
      title: "Find All Possible Recipes from Given Supplies",
      url: "https://leetcode.com/problemset/?search=2115",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-2392",
      title: "Build a Matrix With Conditions",
      url: "https://leetcode.com/problemset/?search=2392",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rp37cs"
      ]
    },
    {
      id: "lc-133",
      title: "Clone Graph",
      url: "https://leetcode.com/problemset/?search=133",
      difficulty: "Unknown",
      patternIds: [
        "pattern-10sw9ch"
      ]
    },
    {
      id: "lc-1334",
      title: "Find the City With the Smallest Number of Neighbors at a Threshold Distance",
      url: "https://leetcode.com/problemset/?search=1334",
      difficulty: "Unknown",
      patternIds: [
        "pattern-10sw9ch"
      ]
    },
    {
      id: "lc-138",
      title: "Copy List with Random Pointer",
      url: "https://leetcode.com/problemset/?search=138",
      difficulty: "Unknown",
      patternIds: [
        "pattern-10sw9ch"
      ]
    },
    {
      id: "lc-1490",
      title: "Clone N-ary Tree",
      url: "https://leetcode.com/problemset/?search=1490",
      difficulty: "Unknown",
      patternIds: [
        "pattern-10sw9ch"
      ]
    },
    {
      id: "lc-743",
      title: "Network Delay Time",
      url: "https://leetcode.com/problemset/?search=743",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-778",
      title: "Swim in Rising Water",
      url: "https://leetcode.com/problemset/?search=778",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-1514",
      title: "Path with Maximum Probability",
      url: "https://leetcode.com/problemset/?search=1514",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-1631",
      title: "Path With Minimum Effort",
      url: "https://leetcode.com/problemset/?search=1631",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-1976",
      title: "Number of Ways to Arrive at Destination",
      url: "https://leetcode.com/problemset/?search=1976",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-2045",
      title: "Second Minimum Time to Reach Destination",
      url: "https://leetcode.com/problemset/?search=2045",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-2203",
      title: "Minimum Weighted Subgraph With the Required Paths",
      url: "https://leetcode.com/problemset/?search=2203",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-2290",
      title: "Minimum Obstacle Removal to Reach Corner",
      url: "https://leetcode.com/problemset/?search=2290",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-2577",
      title: "Minimum Time to Visit a Cell In a Grid",
      url: "https://leetcode.com/problemset/?search=2577",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-2812",
      title: "Find the Safest Path in a Grid",
      url: "https://leetcode.com/problemset/?search=2812",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1qawopj"
      ]
    },
    {
      id: "lc-787",
      title: "Cheapest Flights Within K Stops",
      url: "https://leetcode.com/problemset/?search=787",
      difficulty: "Unknown",
      patternIds: [
        "pattern-11yowli"
      ]
    },
    {
      id: "lc-1129",
      title: "Shortest Path with Alternating Colors",
      url: "https://leetcode.com/problemset/?search=1129",
      difficulty: "Unknown",
      patternIds: [
        "pattern-11yowli"
      ]
    },
    {
      id: "lc-261",
      title: "Graph Valid Tree",
      url: "https://leetcode.com/problemset/?search=261",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-305",
      title: "Number of Islands II",
      url: "https://leetcode.com/problemset/?search=305",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-323",
      title: "Number of Connected Components in an Undirected Graph",
      url: "https://leetcode.com/problemset/?search=323",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-684",
      title: "Redundant Connection",
      url: "https://leetcode.com/problemset/?search=684",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-721",
      title: "Accounts Merge",
      url: "https://leetcode.com/problemset/?search=721",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-737",
      title: "Sentence Similarity II",
      url: "https://leetcode.com/problemset/?search=737",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-947",
      title: "Most Stones Removed with Same Row or Column",
      url: "https://leetcode.com/problemset/?search=947",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-952",
      title: "Largest Component Size by Common Factor",
      url: "https://leetcode.com/problemset/?search=952",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-959",
      title: "Regions Cut By Slashes",
      url: "https://leetcode.com/problemset/?search=959",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-1101",
      title: "The Earliest Moment When Everyone Become Friends",
      url: "https://leetcode.com/problemset/?search=1101",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v5decy"
      ]
    },
    {
      id: "lc-1192",
      title: "Critical Connections in a Network",
      url: "https://leetcode.com/problemset/?search=1192",
      difficulty: "Unknown",
      patternIds: [
        "pattern-178gwr3",
        "pattern-xy910j"
      ]
    },
    {
      id: "lc-2127",
      title: "Maximum Employees to Be Invited to a Meeting",
      url: "https://leetcode.com/problemset/?search=2127",
      difficulty: "Unknown",
      patternIds: [
        "pattern-178gwr3"
      ]
    },
    {
      id: "lc-2360",
      title: "Longest Cycle in a Graph",
      url: "https://leetcode.com/problemset/?search=2360",
      difficulty: "Unknown",
      patternIds: [
        "pattern-xy910j"
      ]
    },
    {
      id: "lc-1135",
      title: "Connecting Cities With Minimum Cost",
      url: "https://leetcode.com/problemset/?search=1135",
      difficulty: "Unknown",
      patternIds: [
        "pattern-efc9q5"
      ]
    },
    {
      id: "lc-1584",
      title: "Min Cost to Connect All Points",
      url: "https://leetcode.com/problemset/?search=1584",
      difficulty: "Unknown",
      patternIds: [
        "pattern-efc9q5"
      ]
    },
    {
      id: "lc-1168",
      title: "Optimize Water Distribution in a Village",
      url: "https://leetcode.com/problemset/?search=1168",
      difficulty: "Unknown",
      patternIds: [
        "pattern-efc9q5"
      ]
    },
    {
      id: "lc-1489",
      title: "Find Critical and Pseudo-Critical Edges in Minimum Spanning Tree",
      url: "https://leetcode.com/problemset/?search=1489",
      difficulty: "Unknown",
      patternIds: [
        "pattern-efc9q5"
      ]
    },
    {
      id: "lc-127",
      title: "Word Ladder",
      url: "https://leetcode.com/problemset/?search=127",
      difficulty: "Unknown",
      patternIds: [
        "pattern-160mi2h"
      ]
    },
    {
      id: "lc-126",
      title: "Word Ladder II",
      url: "https://leetcode.com/problemset/?search=126",
      difficulty: "Unknown",
      patternIds: [
        "pattern-160mi2h"
      ]
    },
    {
      id: "lc-815",
      title: "Bus Routes",
      url: "https://leetcode.com/problemset/?search=815",
      difficulty: "Unknown",
      patternIds: [
        "pattern-160mi2h"
      ]
    },
    {
      id: "lc-70",
      title: "Climbing Stairs",
      url: "https://leetcode.com/problemset/?search=70",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-91",
      title: "Decode Ways",
      url: "https://leetcode.com/problemset/?search=91",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-198",
      title: "House Robber",
      url: "https://leetcode.com/problemset/?search=198",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-213",
      title: "House Robber II",
      url: "https://leetcode.com/problemset/?search=213",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-509",
      title: "Fibonacci Number",
      url: "https://leetcode.com/problemset/?search=509",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-740",
      title: "Delete and Earn",
      url: "https://leetcode.com/problemset/?search=740",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-746",
      title: "Min Cost Climbing Stairs",
      url: "https://leetcode.com/problemset/?search=746",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bs2guj"
      ]
    },
    {
      id: "lc-53",
      title: "Maximum Subarray",
      url: "https://leetcode.com/problemset/?search=53",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1tq0i9n"
      ]
    },
    {
      id: "lc-918",
      title: "Maximum Sum Circular Subarray",
      url: "https://leetcode.com/problemset/?search=918",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1tq0i9n"
      ]
    },
    {
      id: "lc-2321",
      title: "Maximum Score Of Spliced Array",
      url: "https://leetcode.com/problemset/?search=2321",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1tq0i9n"
      ]
    },
    {
      id: "lc-1749",
      title: "Maximum Absolute Sum of Any Subarray",
      url: "https://leetcode.com/problemset/?search=1749",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1tq0i9n"
      ]
    },
    {
      id: "lc-152",
      title: "Maximum Product Subarray",
      url: "https://leetcode.com/problemset/?search=152",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1tq0i9n"
      ]
    },
    {
      id: "lc-322",
      title: "Coin Change",
      url: "https://leetcode.com/problemset/?search=322",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1xdph7l"
      ]
    },
    {
      id: "lc-377",
      title: "Combination Sum IV",
      url: "https://leetcode.com/problemset/?search=377",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1xdph7l"
      ]
    },
    {
      id: "lc-518",
      title: "Coin Change II",
      url: "https://leetcode.com/problemset/?search=518",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1xdph7l"
      ]
    },
    {
      id: "lc-416",
      title: "Partition Equal Subset Sum",
      url: "https://leetcode.com/problemset/?search=416",
      difficulty: "Unknown",
      patternIds: [
        "pattern-cu7f6h"
      ]
    },
    {
      id: "lc-494",
      title: "Target Sum",
      url: "https://leetcode.com/problemset/?search=494",
      difficulty: "Unknown",
      patternIds: [
        "pattern-cu7f6h"
      ]
    },
    {
      id: "lc-139",
      title: "Word Break",
      url: "https://leetcode.com/problemset/?search=139",
      difficulty: "Unknown",
      patternIds: [
        "pattern-lhg8a8"
      ]
    },
    {
      id: "lc-140",
      title: "Word Break II",
      url: "https://leetcode.com/problemset/?search=140",
      difficulty: "Unknown",
      patternIds: [
        "pattern-lhg8a8"
      ]
    },
    {
      id: "lc-1143",
      title: "Longest Common Subsequence",
      url: "https://leetcode.com/problemset/?search=1143",
      difficulty: "Unknown",
      patternIds: [
        "pattern-v0m8i7"
      ]
    },
    {
      id: "lc-1092",
      title: "Shortest Common Supersequence",
      url: "https://leetcode.com/problemset/?search=1092",
      difficulty: "Unknown",
      patternIds: [
        "pattern-v0m8i7"
      ]
    },
    {
      id: "lc-1312",
      title: "Minimum Insertion Steps to Make a String Palindrome",
      url: "https://leetcode.com/problemset/?search=1312",
      difficulty: "Unknown",
      patternIds: [
        "pattern-v0m8i7"
      ]
    },
    {
      id: "lc-72",
      title: "Edit Distance",
      url: "https://leetcode.com/problemset/?search=72",
      difficulty: "Unknown",
      patternIds: [
        "pattern-15911qd"
      ]
    },
    {
      id: "lc-583",
      title: "Delete Operation for Two Strings",
      url: "https://leetcode.com/problemset/?search=583",
      difficulty: "Unknown",
      patternIds: [
        "pattern-15911qd"
      ]
    },
    {
      id: "lc-712",
      title: "Minimum ASCII Delete Sum for Two Strings",
      url: "https://leetcode.com/problemset/?search=712",
      difficulty: "Unknown",
      patternIds: [
        "pattern-15911qd"
      ]
    },
    {
      id: "lc-62",
      title: "Unique Paths",
      url: "https://leetcode.com/problemset/?search=62",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1wihp9i"
      ]
    },
    {
      id: "lc-63",
      title: "Unique Paths II",
      url: "https://leetcode.com/problemset/?search=63",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1wihp9i"
      ]
    },
    {
      id: "lc-64",
      title: "Minimum Path Sum",
      url: "https://leetcode.com/problemset/?search=64",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1wihp9i"
      ]
    },
    {
      id: "lc-120",
      title: "Triangle",
      url: "https://leetcode.com/problemset/?search=120",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1wihp9i"
      ]
    },
    {
      id: "lc-221",
      title: "Maximal Square",
      url: "https://leetcode.com/problemset/?search=221",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1wihp9i"
      ]
    },
    {
      id: "lc-931",
      title: "Minimum Falling Path Sum",
      url: "https://leetcode.com/problemset/?search=931",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1wihp9i"
      ]
    },
    {
      id: "lc-1277",
      title: "Count Square Submatrices with All Ones",
      url: "https://leetcode.com/problemset/?search=1277",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1wihp9i"
      ]
    },
    {
      id: "lc-312",
      title: "Burst Balloons",
      url: "https://leetcode.com/problemset/?search=312",
      difficulty: "Unknown",
      patternIds: [
        "pattern-10pk1u2"
      ]
    },
    {
      id: "lc-546",
      title: "Remove Boxes",
      url: "https://leetcode.com/problemset/?search=546",
      difficulty: "Unknown",
      patternIds: [
        "pattern-10pk1u2"
      ]
    },
    {
      id: "lc-95",
      title: "Unique Binary Search Trees II",
      url: "https://leetcode.com/problemset/?search=95",
      difficulty: "Unknown",
      patternIds: [
        "pattern-13dqpnm"
      ]
    },
    {
      id: "lc-96",
      title: "Unique Binary Search Trees",
      url: "https://leetcode.com/problemset/?search=96",
      difficulty: "Unknown",
      patternIds: [
        "pattern-13dqpnm"
      ]
    },
    {
      id: "lc-241",
      title: "Different Ways to Add Parentheses",
      url: "https://leetcode.com/problemset/?search=241",
      difficulty: "Unknown",
      patternIds: [
        "pattern-13dqpnm"
      ]
    },
    {
      id: "lc-300",
      title: "Longest Increasing Subsequence",
      url: "https://leetcode.com/problemset/?search=300",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mlrzsn"
      ]
    },
    {
      id: "lc-354",
      title: "Russian Doll Envelopes",
      url: "https://leetcode.com/problemset/?search=354",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mlrzsn"
      ]
    },
    {
      id: "lc-1671",
      title: "Minimum Number of Removals to Make Mountain Array",
      url: "https://leetcode.com/problemset/?search=1671",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mlrzsn"
      ]
    },
    {
      id: "lc-2407",
      title: "Longest Increasing Subsequence II",
      url: "https://leetcode.com/problemset/?search=2407",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mlrzsn"
      ]
    },
    {
      id: "lc-121",
      title: "Best Time to Buy and Sell Stock",
      url: "https://leetcode.com/problemset/?search=121",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ly2455",
        "pattern-12ny99j"
      ]
    },
    {
      id: "lc-122",
      title: "Best Time to Buy and Sell Stock II",
      url: "https://leetcode.com/problemset/?search=122",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ly2455",
        "pattern-12ny99j"
      ]
    },
    {
      id: "lc-123",
      title: "Best Time to Buy and Sell Stock III",
      url: "https://leetcode.com/problemset/?search=123",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ly2455"
      ]
    },
    {
      id: "lc-188",
      title: "Best Time to Buy and Sell Stock IV",
      url: "https://leetcode.com/problemset/?search=188",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ly2455"
      ]
    },
    {
      id: "lc-309",
      title: "Best Time to Buy and Sell Stock with Cooldown",
      url: "https://leetcode.com/problemset/?search=309",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ly2455"
      ]
    },
    {
      id: "lc-215",
      title: "Kth Largest Element in an Array",
      url: "https://leetcode.com/problemset/?search=215",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-347",
      title: "Top K Frequent Elements",
      url: "https://leetcode.com/problemset/?search=347",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-451",
      title: "Sort Characters By Frequency",
      url: "https://leetcode.com/problemset/?search=451",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-506",
      title: "Relative Ranks",
      url: "https://leetcode.com/problemset/?search=506",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-703",
      title: "Kth Largest Element in a Stream",
      url: "https://leetcode.com/problemset/?search=703",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-973",
      title: "K Closest Points to Origin",
      url: "https://leetcode.com/problemset/?search=973",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-1046",
      title: "Last Stone Weight",
      url: "https://leetcode.com/problemset/?search=1046",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-2558",
      title: "Take Gifts From the Richest Pile",
      url: "https://leetcode.com/problemset/?search=2558",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1gonlr5"
      ]
    },
    {
      id: "lc-295",
      title: "Find Median from Data Stream",
      url: "https://leetcode.com/problemset/?search=295",
      difficulty: "Unknown",
      patternIds: [
        "pattern-oq05l8",
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-1825",
      title: "Finding MK Average",
      url: "https://leetcode.com/problemset/?search=1825",
      difficulty: "Unknown",
      patternIds: [
        "pattern-oq05l8"
      ]
    },
    {
      id: "lc-23",
      title: "Merge k Sorted Lists",
      url: "https://leetcode.com/problemset/?search=23",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1lq1lid"
      ]
    },
    {
      id: "lc-373",
      title: "Find K Pairs with Smallest Sums",
      url: "https://leetcode.com/problemset/?search=373",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1lq1lid"
      ]
    },
    {
      id: "lc-378",
      title: "Kth Smallest Element in a Sorted Matrix",
      url: "https://leetcode.com/problemset/?search=378",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1lq1lid",
        "pattern-1swltnp"
      ]
    },
    {
      id: "lc-632",
      title: "Smallest Range Covering Elements from K Lists",
      url: "https://leetcode.com/problemset/?search=632",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1lq1lid"
      ]
    },
    {
      id: "lc-253",
      title: "Meeting Rooms II",
      url: "https://leetcode.com/problemset/?search=253",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9"
      ]
    },
    {
      id: "lc-767",
      title: "Reorganize String",
      url: "https://leetcode.com/problemset/?search=767",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9",
        "pattern-1u8b6nf"
      ]
    },
    {
      id: "lc-857",
      title: "Minimum Cost to Hire K Workers",
      url: "https://leetcode.com/problemset/?search=857",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9"
      ]
    },
    {
      id: "lc-1642",
      title: "Furthest Building You Can Reach",
      url: "https://leetcode.com/problemset/?search=1642",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9"
      ]
    },
    {
      id: "lc-1792",
      title: "Maximum Average Pass Ratio",
      url: "https://leetcode.com/problemset/?search=1792",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9"
      ]
    },
    {
      id: "lc-1834",
      title: "Single-Threaded CPU",
      url: "https://leetcode.com/problemset/?search=1834",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9"
      ]
    },
    {
      id: "lc-1942",
      title: "The Number of the Smallest Unoccupied Chair",
      url: "https://leetcode.com/problemset/?search=1942",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9"
      ]
    },
    {
      id: "lc-2402",
      title: "Meeting Rooms III",
      url: "https://leetcode.com/problemset/?search=2402",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ywkch9"
      ]
    },
    {
      id: "lc-17",
      title: "Letter Combinations of a Phone Number",
      url: "https://leetcode.com/problemset/?search=17",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mrzwhe"
      ]
    },
    {
      id: "lc-77",
      title: "Combinations",
      url: "https://leetcode.com/problemset/?search=77",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mrzwhe"
      ]
    },
    {
      id: "lc-78",
      title: "Subsets",
      url: "https://leetcode.com/problemset/?search=78",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mrzwhe"
      ]
    },
    {
      id: "lc-90",
      title: "Subsets II",
      url: "https://leetcode.com/problemset/?search=90",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mrzwhe"
      ]
    },
    {
      id: "lc-31",
      title: "Next Permutation",
      url: "https://leetcode.com/problemset/?search=31",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d02o6r"
      ]
    },
    {
      id: "lc-46",
      title: "Permutations",
      url: "https://leetcode.com/problemset/?search=46",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d02o6r"
      ]
    },
    {
      id: "lc-60",
      title: "Permutation Sequence",
      url: "https://leetcode.com/problemset/?search=60",
      difficulty: "Unknown",
      patternIds: [
        "pattern-d02o6r"
      ]
    },
    {
      id: "lc-39",
      title: "Combination Sum",
      url: "https://leetcode.com/problemset/?search=39",
      difficulty: "Unknown",
      patternIds: [
        "pattern-qmt1v7"
      ]
    },
    {
      id: "lc-40",
      title: "Combination Sum II",
      url: "https://leetcode.com/problemset/?search=40",
      difficulty: "Unknown",
      patternIds: [
        "pattern-qmt1v7"
      ]
    },
    {
      id: "lc-22",
      title: "Generate Parentheses",
      url: "https://leetcode.com/problemset/?search=22",
      difficulty: "Unknown",
      patternIds: [
        "pattern-18ohraa"
      ]
    },
    {
      id: "lc-301",
      title: "Remove Invalid Parentheses",
      url: "https://leetcode.com/problemset/?search=301",
      difficulty: "Unknown",
      patternIds: [
        "pattern-18ohraa"
      ]
    },
    {
      id: "lc-79",
      title: "Word Search",
      url: "https://leetcode.com/problemset/?search=79",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1u2uuzu"
      ]
    },
    {
      id: "lc-212",
      title: "Word Search II",
      url: "https://leetcode.com/problemset/?search=212",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1u2uuzu"
      ]
    },
    {
      id: "lc-2018",
      title: "Check if Word Can Be Placed In Crossword",
      url: "https://leetcode.com/problemset/?search=2018",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1u2uuzu"
      ]
    },
    {
      id: "lc-37",
      title: "Sudoku Solver",
      url: "https://leetcode.com/problemset/?search=37",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8magw1"
      ]
    },
    {
      id: "lc-51",
      title: "N-Queens",
      url: "https://leetcode.com/problemset/?search=51",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8magw1"
      ]
    },
    {
      id: "lc-131",
      title: "Palindrome Partitioning",
      url: "https://leetcode.com/problemset/?search=131",
      difficulty: "Unknown",
      patternIds: [
        "pattern-mbs5p3"
      ]
    },
    {
      id: "lc-132",
      title: "Palindrome Partitioning II",
      url: "https://leetcode.com/problemset/?search=132",
      difficulty: "Unknown",
      patternIds: [
        "pattern-mbs5p3"
      ]
    },
    {
      id: "lc-1457",
      title: "Pseudo-Palindromic Paths in a Binary Tree",
      url: "https://leetcode.com/problemset/?search=1457",
      difficulty: "Unknown",
      patternIds: [
        "pattern-mbs5p3"
      ]
    },
    {
      id: "lc-56",
      title: "Merge Intervals",
      url: "https://leetcode.com/problemset/?search=56",
      difficulty: "Unknown",
      patternIds: [
        "pattern-itbfu7"
      ]
    },
    {
      id: "lc-57",
      title: "Insert Interval",
      url: "https://leetcode.com/problemset/?search=57",
      difficulty: "Unknown",
      patternIds: [
        "pattern-itbfu7"
      ]
    },
    {
      id: "lc-759",
      title: "Employee Free Time",
      url: "https://leetcode.com/problemset/?search=759",
      difficulty: "Unknown",
      patternIds: [
        "pattern-itbfu7"
      ]
    },
    {
      id: "lc-986",
      title: "Interval List Intersections",
      url: "https://leetcode.com/problemset/?search=986",
      difficulty: "Unknown",
      patternIds: [
        "pattern-itbfu7"
      ]
    },
    {
      id: "lc-2406",
      title: "Divide Intervals Into Minimum Number of Groups",
      url: "https://leetcode.com/problemset/?search=2406",
      difficulty: "Unknown",
      patternIds: [
        "pattern-itbfu7"
      ]
    },
    {
      id: "lc-45",
      title: "Jump Game II",
      url: "https://leetcode.com/problemset/?search=45",
      difficulty: "Unknown",
      patternIds: [
        "pattern-16mt16n"
      ]
    },
    {
      id: "lc-55",
      title: "Jump Game",
      url: "https://leetcode.com/problemset/?search=55",
      difficulty: "Unknown",
      patternIds: [
        "pattern-16mt16n"
      ]
    },
    {
      id: "lc-134",
      title: "Gas Station",
      url: "https://leetcode.com/problemset/?search=134",
      difficulty: "Unknown",
      patternIds: [
        "pattern-18tw7m7"
      ]
    },
    {
      id: "lc-2202",
      title: "Maximize the Topmost Element After K Moves",
      url: "https://leetcode.com/problemset/?search=2202",
      difficulty: "Unknown",
      patternIds: [
        "pattern-18tw7m7"
      ]
    },
    {
      id: "lc-621",
      title: "Task Scheduler",
      url: "https://leetcode.com/problemset/?search=621",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1u8b6nf"
      ]
    },
    {
      id: "lc-1054",
      title: "Distant Barcodes",
      url: "https://leetcode.com/problemset/?search=1054",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1u8b6nf"
      ]
    },
    {
      id: "lc-455",
      title: "Assign Cookies",
      url: "https://leetcode.com/problemset/?search=455",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4pxbco"
      ]
    },
    {
      id: "lc-135",
      title: "Candy",
      url: "https://leetcode.com/problemset/?search=135",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4pxbco"
      ]
    },
    {
      id: "lc-406",
      title: "Queue Reconstruction by Height",
      url: "https://leetcode.com/problemset/?search=406",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4pxbco"
      ]
    },
    {
      id: "lc-1029",
      title: "Two City Scheduling",
      url: "https://leetcode.com/problemset/?search=1029",
      difficulty: "Unknown",
      patternIds: [
        "pattern-4pxbco"
      ]
    },
    {
      id: "lc-35",
      title: "Search Insert Position",
      url: "https://leetcode.com/problemset/?search=35",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-69",
      title: "Sqrt(x)",
      url: "https://leetcode.com/problemset/?search=69",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-74",
      title: "Search a 2D Matrix",
      url: "https://leetcode.com/problemset/?search=74",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-278",
      title: "First Bad Version",
      url: "https://leetcode.com/problemset/?search=278",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-374",
      title: "Guess Number Higher or Lower",
      url: "https://leetcode.com/problemset/?search=374",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-540",
      title: "Single Element in a Sorted Array",
      url: "https://leetcode.com/problemset/?search=540",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-704",
      title: "Binary Search",
      url: "https://leetcode.com/problemset/?search=704",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-1539",
      title: "Kth Missing Positive Number",
      url: "https://leetcode.com/problemset/?search=1539",
      difficulty: "Unknown",
      patternIds: [
        "pattern-udcl86"
      ]
    },
    {
      id: "lc-33",
      title: "Search in Rotated Sorted Array",
      url: "https://leetcode.com/problemset/?search=33",
      difficulty: "Unknown",
      patternIds: [
        "pattern-f2siui"
      ]
    },
    {
      id: "lc-81",
      title: "Search in Rotated Sorted Array II",
      url: "https://leetcode.com/problemset/?search=81",
      difficulty: "Unknown",
      patternIds: [
        "pattern-f2siui"
      ]
    },
    {
      id: "lc-153",
      title: "Find Minimum in Rotated Sorted Array",
      url: "https://leetcode.com/problemset/?search=153",
      difficulty: "Unknown",
      patternIds: [
        "pattern-f2siui"
      ]
    },
    {
      id: "lc-162",
      title: "Find Peak Element",
      url: "https://leetcode.com/problemset/?search=162",
      difficulty: "Unknown",
      patternIds: [
        "pattern-f2siui"
      ]
    },
    {
      id: "lc-852",
      title: "Peak Index in a Mountain Array",
      url: "https://leetcode.com/problemset/?search=852",
      difficulty: "Unknown",
      patternIds: [
        "pattern-f2siui"
      ]
    },
    {
      id: "lc-1095",
      title: "Find in Mountain Array",
      url: "https://leetcode.com/problemset/?search=1095",
      difficulty: "Unknown",
      patternIds: [
        "pattern-f2siui"
      ]
    },
    {
      id: "lc-410",
      title: "Split Array Largest Sum",
      url: "https://leetcode.com/problemset/?search=410",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-774",
      title: "Minimize Max Distance to Gas Station",
      url: "https://leetcode.com/problemset/?search=774",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-875",
      title: "Koko Eating Bananas",
      url: "https://leetcode.com/problemset/?search=875",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-1011",
      title: "Capacity To Ship Packages 6  Within D Days",
      url: "https://leetcode.com/problemset/?search=1011",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-1482",
      title: "Minimum Number of Days to Make m Bouquets",
      url: "https://leetcode.com/problemset/?search=1482",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-1760",
      title: "Minimum Limit of Balls in a Bag",
      url: "https://leetcode.com/problemset/?search=1760",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-2064",
      title: "Minimized Maximum of Products Distributed to Any Store",
      url: "https://leetcode.com/problemset/?search=2064",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-2226",
      title: "Maximum Candies Allocated to K Children",
      url: "https://leetcode.com/problemset/?search=2226",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1kq8b9y"
      ]
    },
    {
      id: "lc-34",
      title: "Find First and Last Position of Element in Sorted Array",
      url: "https://leetcode.com/problemset/?search=34",
      difficulty: "Unknown",
      patternIds: [
        "pattern-sn15e3"
      ]
    },
    {
      id: "lc-658",
      title: "Find K Closest Elements",
      url: "https://leetcode.com/problemset/?search=658",
      difficulty: "Unknown",
      patternIds: [
        "pattern-sn15e3"
      ]
    },
    {
      id: "lc-4",
      title: "Median of Two Sorted Arrays",
      url: "https://leetcode.com/problemset/?search=4",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1swltnp"
      ]
    },
    {
      id: "lc-719",
      title: "Find K-th Smallest Pair Distance",
      url: "https://leetcode.com/problemset/?search=719",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1swltnp"
      ]
    },
    {
      id: "lc-20",
      title: "Valid Parentheses",
      url: "https://leetcode.com/problemset/?search=20",
      difficulty: "Unknown",
      patternIds: [
        "pattern-nfb40k"
      ]
    },
    {
      id: "lc-32",
      title: "Longest Valid Parentheses",
      url: "https://leetcode.com/problemset/?search=32",
      difficulty: "Unknown",
      patternIds: [
        "pattern-nfb40k"
      ]
    },
    {
      id: "lc-921",
      title: "Minimum Add to Make Parentheses Valid",
      url: "https://leetcode.com/problemset/?search=921",
      difficulty: "Unknown",
      patternIds: [
        "pattern-nfb40k"
      ]
    },
    {
      id: "lc-1249",
      title: "Minimum Remove to Make Valid Parentheses",
      url: "https://leetcode.com/problemset/?search=1249",
      difficulty: "Unknown",
      patternIds: [
        "pattern-nfb40k"
      ]
    },
    {
      id: "lc-1963",
      title: "Minimum Number of Swaps to Make the String Balanced",
      url: "https://leetcode.com/problemset/?search=1963",
      difficulty: "Unknown",
      patternIds: [
        "pattern-nfb40k"
      ]
    },
    {
      id: "lc-402",
      title: "Remove K Digits",
      url: "https://leetcode.com/problemset/?search=402",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-496",
      title: "Next Greater Element I",
      url: "https://leetcode.com/problemset/?search=496",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-503",
      title: "Next Greater Element II",
      url: "https://leetcode.com/problemset/?search=503",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-739",
      title: "Daily Temperatures",
      url: "https://leetcode.com/problemset/?search=739",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-901",
      title: "Online Stock Span",
      url: "https://leetcode.com/problemset/?search=901",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq",
        "pattern-luy1jn"
      ]
    },
    {
      id: "lc-907",
      title: "Sum of Subarray Minimums",
      url: "https://leetcode.com/problemset/?search=907",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-962",
      title: "Maximum Width Ramp",
      url: "https://leetcode.com/problemset/?search=962",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-1475",
      title: "Final Prices With a Special Discount in a Shop",
      url: "https://leetcode.com/problemset/?search=1475",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-1673",
      title: "Find the Most Competitive Subsequence",
      url: "https://leetcode.com/problemset/?search=1673",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1ba92cq"
      ]
    },
    {
      id: "lc-150",
      title: "Evaluate Reverse Polish Notation",
      url: "https://leetcode.com/problemset/?search=150",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ttlnjl"
      ]
    },
    {
      id: "lc-224",
      title: "Basic Calculator",
      url: "https://leetcode.com/problemset/?search=224",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ttlnjl"
      ]
    },
    {
      id: "lc-227",
      title: "Basic Calculator II",
      url: "https://leetcode.com/problemset/?search=227",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ttlnjl"
      ]
    },
    {
      id: "lc-772",
      title: "Basic Calculator III",
      url: "https://leetcode.com/problemset/?search=772",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ttlnjl"
      ]
    },
    {
      id: "lc-71",
      title: "Simplify Path",
      url: "https://leetcode.com/problemset/?search=71",
      difficulty: "Unknown",
      patternIds: [
        "pattern-t2cxls"
      ]
    },
    {
      id: "lc-394",
      title: "Decode String",
      url: "https://leetcode.com/problemset/?search=394",
      difficulty: "Unknown",
      patternIds: [
        "pattern-t2cxls"
      ]
    },
    {
      id: "lc-735",
      title: "Asteroid Collision",
      url: "https://leetcode.com/problemset/?search=735",
      difficulty: "Unknown",
      patternIds: [
        "pattern-t2cxls"
      ]
    },
    {
      id: "lc-155",
      title: "Min Stack",
      url: "https://leetcode.com/problemset/?search=155",
      difficulty: "Unknown",
      patternIds: [
        "pattern-luy1jn",
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-895",
      title: "Maximum Frequency Stack",
      url: "https://leetcode.com/problemset/?search=895",
      difficulty: "Unknown",
      patternIds: [
        "pattern-luy1jn"
      ]
    },
    {
      id: "lc-84",
      title: "Largest Rectangle in Histogram",
      url: "https://leetcode.com/problemset/?search=84",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1en2olk"
      ]
    },
    {
      id: "lc-85",
      title: "Maximal Rectangle",
      url: "https://leetcode.com/problemset/?search=85",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1en2olk"
      ]
    },
    {
      id: "lc-136",
      title: "Single Number",
      url: "https://leetcode.com/problemset/?search=136",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ggg52i"
      ]
    },
    {
      id: "lc-137",
      title: "Single Number II",
      url: "https://leetcode.com/problemset/?search=137",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ggg52i"
      ]
    },
    {
      id: "lc-268",
      title: "Missing Number",
      url: "https://leetcode.com/problemset/?search=268",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ggg52i",
        "pattern-1vp24t3"
      ]
    },
    {
      id: "lc-389",
      title: "Find the Difference",
      url: "https://leetcode.com/problemset/?search=389",
      difficulty: "Unknown",
      patternIds: [
        "pattern-ggg52i"
      ]
    },
    {
      id: "lc-191",
      title: "Number of 1 Bits",
      url: "https://leetcode.com/problemset/?search=191",
      difficulty: "Unknown",
      patternIds: [
        "pattern-17cb4jx"
      ]
    },
    {
      id: "lc-231",
      title: "Power of Two",
      url: "https://leetcode.com/problemset/?search=231",
      difficulty: "Unknown",
      patternIds: [
        "pattern-17cb4jx",
        "pattern-123ysvi"
      ]
    },
    {
      id: "lc-477",
      title: "Total Hamming Distance",
      url: "https://leetcode.com/problemset/?search=477",
      difficulty: "Unknown",
      patternIds: [
        "pattern-17cb4jx"
      ]
    },
    {
      id: "lc-338",
      title: "Counting Bits",
      url: "https://leetcode.com/problemset/?search=338",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1vvxkz2"
      ]
    },
    {
      id: "lc-1494",
      title: "Parallel Courses II",
      url: "https://leetcode.com/problemset/?search=1494",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1vvxkz2"
      ]
    },
    {
      id: "lc-1442",
      title: "Count Triplets That Can Form Two Arrays of Equal XOR",
      url: "https://leetcode.com/problemset/?search=1442",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1vvxkz2"
      ]
    },
    {
      id: "lc-342",
      title: "Power of Four",
      url: "https://leetcode.com/problemset/?search=342",
      difficulty: "Unknown",
      patternIds: [
        "pattern-123ysvi"
      ]
    },
    {
      id: "lc-83",
      title: "Remove Duplicates from Sorted List",
      url: "https://leetcode.com/problemset/?search=83",
      difficulty: "Unknown",
      patternIds: [
        "pattern-14wit1i"
      ]
    },
    {
      id: "lc-92",
      title: "Reverse Linked List II",
      url: "https://leetcode.com/problemset/?search=92",
      difficulty: "Unknown",
      patternIds: [
        "pattern-14wit1i"
      ]
    },
    {
      id: "lc-206",
      title: "Reverse Linked List",
      url: "https://leetcode.com/problemset/?search=206",
      difficulty: "Unknown",
      patternIds: [
        "pattern-14wit1i"
      ]
    },
    {
      id: "lc-25",
      title: "Reverse Nodes in k-Group",
      url: "https://leetcode.com/problemset/?search=25",
      difficulty: "Unknown",
      patternIds: [
        "pattern-14wit1i"
      ]
    },
    {
      id: "lc-234",
      title: "Palindrome Linked List",
      url: "https://leetcode.com/problemset/?search=234",
      difficulty: "Unknown",
      patternIds: [
        "pattern-14wit1i"
      ]
    },
    {
      id: "lc-82",
      title: "Remove Duplicates from Sorted List II",
      url: "https://leetcode.com/problemset/?search=82",
      difficulty: "Unknown",
      patternIds: [
        "pattern-14wit1i"
      ]
    },
    {
      id: "lc-21",
      title: "Merge Two Sorted Lists",
      url: "https://leetcode.com/problemset/?search=21",
      difficulty: "Unknown",
      patternIds: [
        "pattern-65lvhd"
      ]
    },
    {
      id: "lc-2",
      title: "Add Two Numbers",
      url: "https://leetcode.com/problemset/?search=2",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1q4dxbe"
      ]
    },
    {
      id: "lc-369",
      title: "Plus One Linked List",
      url: "https://leetcode.com/problemset/?search=369",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1q4dxbe"
      ]
    },
    {
      id: "lc-160",
      title: "Intersection of Two Linked Lists",
      url: "https://leetcode.com/problemset/?search=160",
      difficulty: "Unknown",
      patternIds: [
        "pattern-utu17i"
      ]
    },
    {
      id: "lc-599",
      title: "Minimum Index Sum of Two Lists",
      url: "https://leetcode.com/problemset/?search=599",
      difficulty: "Unknown",
      patternIds: [
        "pattern-utu17i"
      ]
    },
    {
      id: "lc-24",
      title: "Swap Nodes in Pairs",
      url: "https://leetcode.com/problemset/?search=24",
      difficulty: "Unknown",
      patternIds: [
        "pattern-136icjh"
      ]
    },
    {
      id: "lc-61",
      title: "Rotate List",
      url: "https://leetcode.com/problemset/?search=61",
      difficulty: "Unknown",
      patternIds: [
        "pattern-136icjh"
      ]
    },
    {
      id: "lc-86",
      title: "Partition List",
      url: "https://leetcode.com/problemset/?search=86",
      difficulty: "Unknown",
      patternIds: [
        "pattern-136icjh"
      ]
    },
    {
      id: "lc-143",
      title: "Reorder List",
      url: "https://leetcode.com/problemset/?search=143",
      difficulty: "Unknown",
      patternIds: [
        "pattern-136icjh"
      ]
    },
    {
      id: "lc-328",
      title: "Odd Even Linked List",
      url: "https://leetcode.com/problemset/?search=328",
      difficulty: "Unknown",
      patternIds: [
        "pattern-136icjh"
      ]
    },
    {
      id: "lc-48",
      title: "Rotate Image",
      url: "https://leetcode.com/problemset/?search=48",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1sv3txq"
      ]
    },
    {
      id: "lc-189",
      title: "Rotate Array",
      url: "https://leetcode.com/problemset/?search=189",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1sv3txq"
      ]
    },
    {
      id: "lc-867",
      title: "Transpose Matrix",
      url: "https://leetcode.com/problemset/?search=867",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1sv3txq"
      ]
    },
    {
      id: "lc-54",
      title: "Spiral Matrix",
      url: "https://leetcode.com/problemset/?search=54",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v82cb6"
      ]
    },
    {
      id: "lc-59",
      title: "Spiral Matrix II",
      url: "https://leetcode.com/problemset/?search=59",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v82cb6"
      ]
    },
    {
      id: "lc-885",
      title: "Spiral Matrix III",
      url: "https://leetcode.com/problemset/?search=885",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v82cb6"
      ]
    },
    {
      id: "lc-2326",
      title: "Spiral Matrix IV",
      url: "https://leetcode.com/problemset/?search=2326",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1v82cb6"
      ]
    },
    {
      id: "lc-73",
      title: "Set Matrix Zeroes",
      url: "https://leetcode.com/problemset/?search=73",
      difficulty: "Unknown",
      patternIds: [
        "pattern-y29w42"
      ]
    },
    {
      id: "lc-289",
      title: "Game of Life",
      url: "https://leetcode.com/problemset/?search=289",
      difficulty: "Unknown",
      patternIds: [
        "pattern-y29w42"
      ]
    },
    {
      id: "lc-498",
      title: "Diagonal Traverse",
      url: "https://leetcode.com/problemset/?search=498",
      difficulty: "Unknown",
      patternIds: [
        "pattern-y29w42"
      ]
    },
    {
      id: "lc-238",
      title: "Product of Array Except Self",
      url: "https://leetcode.com/problemset/?search=238",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bn69ia"
      ]
    },
    {
      id: "lc-845",
      title: "Longest Mountain in Array",
      url: "https://leetcode.com/problemset/?search=845",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bn69ia"
      ]
    },
    {
      id: "lc-2483",
      title: "Minimum Penalty for a Shop",
      url: "https://leetcode.com/problemset/?search=2483",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1bn69ia"
      ]
    },
    {
      id: "lc-66",
      title: "Plus One",
      url: "https://leetcode.com/problemset/?search=66",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1suwftd"
      ]
    },
    {
      id: "lc-43",
      title: "Multiply Strings",
      url: "https://leetcode.com/problemset/?search=43",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1suwftd",
        "pattern-apflh8"
      ]
    },
    {
      id: "lc-989",
      title: "Add to Array-Form of Integer",
      url: "https://leetcode.com/problemset/?search=989",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1suwftd"
      ]
    },
    {
      id: "lc-67",
      title: "Add Binary",
      url: "https://leetcode.com/problemset/?search=67",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1suwftd",
        "pattern-apflh8"
      ]
    },
    {
      id: "lc-88",
      title: "Merge Sorted Array",
      url: "https://leetcode.com/problemset/?search=88",
      difficulty: "Unknown",
      patternIds: [
        "pattern-21dvb0"
      ]
    },
    {
      id: "lc-41",
      title: "First Missing Positive",
      url: "https://leetcode.com/problemset/?search=41",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1vp24t3"
      ]
    },
    {
      id: "lc-442",
      title: "Find All Duplicates in an Array",
      url: "https://leetcode.com/problemset/?search=442",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1vp24t3"
      ]
    },
    {
      id: "lc-448",
      title: "Find All Numbers Disappeared in an Array",
      url: "https://leetcode.com/problemset/?search=448",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1vp24t3"
      ]
    },
    {
      id: "lc-9",
      title: "Palindrome Number",
      url: "https://leetcode.com/problemset/?search=9",
      difficulty: "Unknown",
      patternIds: [
        "pattern-igs84m"
      ]
    },
    {
      id: "lc-125",
      title: "Valid Palindrome",
      url: "https://leetcode.com/problemset/?search=125",
      difficulty: "Unknown",
      patternIds: [
        "pattern-igs84m"
      ]
    },
    {
      id: "lc-680",
      title: "Valid Palindrome II",
      url: "https://leetcode.com/problemset/?search=680",
      difficulty: "Unknown",
      patternIds: [
        "pattern-igs84m"
      ]
    },
    {
      id: "lc-49",
      title: "Group Anagrams",
      url: "https://leetcode.com/problemset/?search=49",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1y3ybhc"
      ]
    },
    {
      id: "lc-242",
      title: "Valid Anagram",
      url: "https://leetcode.com/problemset/?search=242",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1y3ybhc"
      ]
    },
    {
      id: "lc-13",
      title: "Roman to Integer",
      url: "https://leetcode.com/problemset/?search=13",
      difficulty: "Unknown",
      patternIds: [
        "pattern-weflnr"
      ]
    },
    {
      id: "lc-12",
      title: "Integer to Roman",
      url: "https://leetcode.com/problemset/?search=12",
      difficulty: "Unknown",
      patternIds: [
        "pattern-weflnr"
      ]
    },
    {
      id: "lc-8",
      title: "String to Integer (atoi)",
      url: "https://leetcode.com/problemset/?search=8",
      difficulty: "Unknown",
      patternIds: [
        "pattern-wwkn2c"
      ]
    },
    {
      id: "lc-65",
      title: "Valid Number",
      url: "https://leetcode.com/problemset/?search=65",
      difficulty: "Unknown",
      patternIds: [
        "pattern-wwkn2c"
      ]
    },
    {
      id: "lc-415",
      title: "Add Strings",
      url: "https://leetcode.com/problemset/?search=415",
      difficulty: "Unknown",
      patternIds: [
        "pattern-apflh8"
      ]
    },
    {
      id: "lc-28",
      title: "Find the Index of the First Occurrence in a String",
      url: "https://leetcode.com/problemset/?search=28",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rhkwyy",
        "pattern-hu5lnk"
      ]
    },
    {
      id: "lc-214",
      title: "Shortest Palindrome",
      url: "https://leetcode.com/problemset/?search=214",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rhkwyy"
      ]
    },
    {
      id: "lc-686",
      title: "Repeated String Match",
      url: "https://leetcode.com/problemset/?search=686",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rhkwyy",
        "pattern-hu5lnk"
      ]
    },
    {
      id: "lc-796",
      title: "Rotate String",
      url: "https://leetcode.com/problemset/?search=796",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rhkwyy"
      ]
    },
    {
      id: "lc-3008",
      title: "Find Beautiful Indices in the Given Array II",
      url: "https://leetcode.com/problemset/?search=3008",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1rhkwyy"
      ]
    },
    {
      id: "lc-459",
      title: "Repeated Substring Pattern",
      url: "https://leetcode.com/problemset/?search=459",
      difficulty: "Unknown",
      patternIds: [
        "pattern-hu5lnk"
      ]
    },
    {
      id: "lc-146",
      title: "LRU Cache",
      url: "https://leetcode.com/problemset/?search=146",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-225",
      title: "Implement Stack using Queues",
      url: "https://leetcode.com/problemset/?search=225",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-232",
      title: "Implement Queue using Stacks",
      url: "https://leetcode.com/problemset/?search=232",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-251",
      title: "Flatten 2D Vector",
      url: "https://leetcode.com/problemset/?search=251",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-271",
      title: "Encode and Decode Strings",
      url: "https://leetcode.com/problemset/?search=271",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-341",
      title: "Flatten Nested List Iterator",
      url: "https://leetcode.com/problemset/?search=341",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-353",
      title: "Design Snake Game",
      url: "https://leetcode.com/problemset/?search=353",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-359",
      title: "Logger Rate Limiter",
      url: "https://leetcode.com/problemset/?search=359",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-362",
      title: "Design Hit Counter",
      url: "https://leetcode.com/problemset/?search=362",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-379",
      title: "Design Phone Directory",
      url: "https://leetcode.com/problemset/?search=379",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-380",
      title: "Insert Delete GetRandom O(1)",
      url: "https://leetcode.com/problemset/?search=380",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-432",
      title: "All O`one Data Structure",
      url: "https://leetcode.com/problemset/?search=432",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-460",
      title: "LFU Cache",
      url: "https://leetcode.com/problemset/?search=460",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-604",
      title: "Design Compressed String Iterator",
      url: "https://leetcode.com/problemset/?search=604",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-622",
      title: "Design Circular Queue",
      url: "https://leetcode.com/problemset/?search=622",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-641",
      title: "Design Circular Deque",
      url: "https://leetcode.com/problemset/?search=641",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-642",
      title: "Design Search Autocomplete System",
      url: "https://leetcode.com/problemset/?search=642",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg",
        "pattern-1mhdtac"
      ]
    },
    {
      id: "lc-706",
      title: "Design HashMap",
      url: "https://leetcode.com/problemset/?search=706",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-715",
      title: "Range Module",
      url: "https://leetcode.com/problemset/?search=715",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-900",
      title: "RLE Iterator",
      url: "https://leetcode.com/problemset/?search=900",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-981",
      title: "Time Based Key-Value Store",
      url: "https://leetcode.com/problemset/?search=981",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-1146",
      title: "Snapshot Array",
      url: "https://leetcode.com/problemset/?search=1146",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-1348",
      title: "Tweet Counts Per Frequency",
      url: "https://leetcode.com/problemset/?search=1348",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-1352",
      title: "Product of the Last K Numbers",
      url: "https://leetcode.com/problemset/?search=1352",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-1381",
      title: "Design a Stack With Increment Operation",
      url: "https://leetcode.com/problemset/?search=1381",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-1756",
      title: "Design Most Recently Used Queue",
      url: "https://leetcode.com/problemset/?search=1756",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-2013",
      title: "Detect Squares",
      url: "https://leetcode.com/problemset/?search=2013",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-2034",
      title: "Stock Price Fluctuation",
      url: "https://leetcode.com/problemset/?search=2034",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-2296",
      title: "Design a Text Editor",
      url: "https://leetcode.com/problemset/?search=2296",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-2336",
      title: "Smallest Number in Infinite Set",
      url: "https://leetcode.com/problemset/?search=2336",
      difficulty: "Unknown",
      patternIds: [
        "pattern-8x6ycg"
      ]
    },
    {
      id: "lc-208",
      title: "Implement Trie (Prefix Tree)",
      url: "https://leetcode.com/problemset/?search=208",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mhdtac"
      ]
    },
    {
      id: "lc-211",
      title: "Design Add and Search Words Data Structure",
      url: "https://leetcode.com/problemset/?search=211",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mhdtac"
      ]
    },
    {
      id: "lc-720",
      title: "Longest Word in Dictionary",
      url: "https://leetcode.com/problemset/?search=720",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mhdtac"
      ]
    },
    {
      id: "lc-648",
      title: "Replace Words",
      url: "https://leetcode.com/problemset/?search=648",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mhdtac"
      ]
    },
    {
      id: "lc-425",
      title: "Word Squares",
      url: "https://leetcode.com/problemset/?search=425",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mhdtac"
      ]
    },
    {
      id: "lc-745",
      title: "Prefix and Suffix Search",
      url: "https://leetcode.com/problemset/?search=745",
      difficulty: "Unknown",
      patternIds: [
        "pattern-1mhdtac"
      ]
    }
  ]
};

// src/main.ts
var VIEW = "algo-patterns-trainer";
var date = (at) => new Date(at).toLocaleString("ru-RU", {
  dateStyle: "short",
  timeStyle: "short"
});
var n = (value) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
var percent = (part, total) => total ? Math.round(part / total * 100) + "%" : "\u2014";
function el(parent, tag, text = "", cls = "") {
  const item = parent.ownerDocument.createElement(tag);
  if (text) item.textContent = text;
  if (cls) item.className = cls;
  parent.append(item);
  return item;
}
function button(parent, text, action, primary = false) {
  const b = el(parent, "button", text, primary ? "mod-cta" : "");
  b.type = "button";
  b.addEventListener("click", () => {
    b.disabled = true;
    Promise.resolve().then(action).catch((error) => new import_obsidian2.Notice(error.message, 8e3)).finally(() => {
      b.disabled = false;
    });
  });
  return b;
}
function select(parent, label, options, value, onChange) {
  const wrap = el(parent, "label", "", "ap-field");
  el(wrap, "span", label);
  const field = el(wrap, "select");
  for (const [key2, title] of options) {
    const option = el(field, "option", title);
    option.value = key2;
  }
  field.value = value;
  if (onChange)
    field.addEventListener("change", () => {
      Promise.resolve(onChange(field.value)).catch(
        (e) => new import_obsidian2.Notice(String(e))
      );
    });
  return field;
}
function input(parent, label, value, type = "text") {
  const wrap = el(parent, "label", "", "ap-field");
  el(wrap, "span", label);
  const field = el(wrap, "input");
  field.type = type;
  field.value = value;
  return field;
}
function checkbox(parent, label, checked) {
  const wrap = el(parent, "label", "", "ap-check");
  const field = el(wrap, "input");
  field.type = "checkbox";
  field.checked = checked;
  el(wrap, "span", label);
  return field;
}
function empty(parent, title, body) {
  const box = el(parent, "div", "", "ap-empty");
  el(box, "h3", title);
  el(box, "p", body);
  return box;
}
function table(parent, headers) {
  const wrap = el(parent, "div", "", "ap-table-wrap");
  const t = el(wrap, "table");
  const tr = el(el(t, "thead"), "tr");
  headers.forEach((h) => el(tr, "th", h));
  return el(t, "tbody");
}
function link(parent, title, url) {
  try {
    if (!["https:", "http:"].includes(new URL(url).protocol)) return;
    const a = el(parent, "a", title);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } catch {
  }
}
var AlgoPatternsPlugin = class extends import_obsidian2.Plugin {
  store;
  ready;
  startupError = "";
  dataFolder = DEFAULT_DATA_FOLDER;
  get dataPath() {
    return this.dataFolder + "/tracker.json";
  }
  get db() {
    return this.store.db;
  }
  async onload() {
    const saved = await this.loadData();
    if (saved?.dataFolder !== void 0)
      this.dataFolder = dataFolderPath(saved.dataFolder);
    this.store = new Store({
      read: async () => {
        const f = this.app.vault.getAbstractFileByPath(this.dataPath);
        if (f && !(f instanceof import_obsidian2.TFile))
          throw new Error("\u041F\u0443\u0442\u044C \u0431\u0430\u0437\u044B \u0437\u0430\u043D\u044F\u0442 \u043F\u0430\u043F\u043A\u043E\u0439: " + this.dataPath);
        return f instanceof import_obsidian2.TFile ? this.app.vault.read(f) : null;
      },
      create: async (text) => {
        await this.folder(this.dataFolder);
        await this.app.vault.create(this.dataPath, text);
      },
      replace: async (expected, next) => {
        const file = this.app.vault.getAbstractFileByPath(this.dataPath);
        if (!(file instanceof import_obsidian2.TFile))
          throw new Error(
            "\u0424\u0430\u0439\u043B \u0431\u0430\u0437\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0431\u0430\u0437\u0443 \u0434\u0430\u043D\u043D\u044B\u0445\xBB."
          );
        await this.app.vault.process(file, (current) => {
          if (current !== expected)
            throw new Error(
              "\u0411\u0430\u0437\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0430 \u0438\u0437\u0432\u043D\u0435. \u0412\u0430\u0448\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u044B. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0431\u0430\u0437\u0443 \u0434\u0430\u043D\u043D\u044B\u0445\xBB."
            );
          return next;
        });
      }
    });
    this.ready = new Promise(
      (resolve, reject) => this.app.workspace.onLayoutReady(() => {
        this.initializeStorage(saved?.dataFolder === void 0).then(resolve).catch((error) => {
          this.startupError = String(error);
          new import_obsidian2.Notice("Algo Patterns: " + this.startupError, 12e3);
          reject(error);
        });
      })
    );
    void this.ready.catch(() => {
    });
    this.addSettingTab(new AlgoPatternsSettings(this));
    this.registerView(VIEW, (leaf) => new TrainerView(leaf, this));
    this.addRibbonIcon("brain-circuit", "Algo Patterns", () => {
      void this.open();
    });
    this.addCommand({
      id: "open",
      name: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0442\u0440\u0435\u043D\u0430\u0436\u0451\u0440",
      callback: () => {
        void this.open();
      }
    });
    this.addCommand({
      id: "import",
      name: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433",
      callback: () => {
        void this.ready.then(() => new ImportModal(this).open()).catch(() => {
        });
      }
    });
    this.addCommand({
      id: "backup",
      name: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E",
      callback: () => {
        void this.ready.then(() => this.backup()).catch((error) => new import_obsidian2.Notice(String(error)));
      }
    });
  }
  async initializeStorage(firstRun) {
    if (firstRun) {
      const legacy = this.app.vault.getAbstractFileByPath(LEGACY_DATA_FOLDER);
      const oldData = this.app.vault.getAbstractFileByPath(
        LEGACY_DATA_FOLDER + "/tracker.json"
      );
      if (legacy instanceof import_obsidian2.TFolder && oldData instanceof import_obsidian2.TFile) {
        const destinationExists = this.app.vault.getAbstractFileByPath(
          this.dataFolder
        );
        this.dataFolder = LEGACY_DATA_FOLDER;
        await this.saveData({ dataFolder: this.dataFolder });
        if (!destinationExists) await this.moveDataFolder(DEFAULT_DATA_FOLDER);
        else
          new import_obsidian2.Notice(
            "\u041F\u0430\u043F\u043A\u0430 _algo_patterns \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u0431\u0430\u0437\u0430 \u0432 Algo Patterns; \u043D\u043E\u0432\u044B\u0439 \u043F\u0443\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445.",
            1e4
          );
      }
    }
    await this.store.load();
    await this.saveData({ dataFolder: this.dataFolder });
  }
  async changeDataFolder(value) {
    const next = dataFolderPath(value);
    await this.ready;
    await this.store.exclusive(() => this.moveDataFolder(next));
    this.refresh();
  }
  async moveDataFolder(next) {
    const previous = this.dataFolder;
    if (next === previous) return;
    if (next.startsWith(previous + "/") || previous.startsWith(next + "/"))
      throw new Error(
        "\u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430 \u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0438\u043B\u0438 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432\u043D\u0443\u0442\u0440\u0438 \u043D\u0435\u0451."
      );
    if (this.app.vault.getAbstractFileByPath(next))
      throw new Error(
        "\u041F\u0430\u043F\u043A\u0430 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439 \u043F\u0443\u0442\u044C; \u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u044F\u044E\u0442\u0441\u044F."
      );
    const source = this.app.vault.getAbstractFileByPath(previous);
    if (!(source instanceof import_obsidian2.TFolder))
      throw new Error("\u041F\u0430\u043F\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430: " + previous);
    const parent = next.split("/").slice(0, -1).join("/");
    if (parent) await this.folder(parent);
    await this.app.fileManager.renameFile(source, next);
    try {
      await this.saveData({ dataFolder: next });
    } catch (error) {
      try {
        await this.app.fileManager.renameFile(source, previous);
      } catch {
        this.dataFolder = next;
        throw new Error(
          "\u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u044B \u0432 " + next + ", \u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0443 \u0438 \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043F\u043A\u0443 \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0443\u0442\u044C \u043F\u0435\u0440\u0435\u0434 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C."
        );
      }
      throw error;
    }
    this.dataFolder = next;
    new import_obsidian2.Notice("\u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u044B \u0432 " + next);
  }
  async folder(path) {
    let current = "";
    for (const part of (0, import_obsidian2.normalizePath)(path).split("/")) {
      current = current ? current + "/" + part : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing && !(existing instanceof import_obsidian2.TFolder))
        throw new Error("\u041F\u0443\u0442\u044C \u0437\u0430\u043D\u044F\u0442 \u0444\u0430\u0439\u043B\u043E\u043C: " + current);
      if (!existing) await this.app.vault.createFolder(current);
    }
  }
  async open() {
    const existing = this.app.workspace.getLeavesOfType(VIEW)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: VIEW, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  refresh() {
    this.app.workspace.getLeavesOfType(VIEW).forEach((leaf) => {
      if (leaf.view instanceof TrainerView) leaf.view.render();
    });
  }
  async change(action) {
    await this.ready;
    await this.store.change(action);
    this.refresh();
  }
  async reloadDatabase() {
    await this.ready;
    await this.store.reload();
    this.refresh();
    new import_obsidian2.Notice("\u0411\u0430\u0437\u0430 \u043F\u0435\u0440\u0435\u0447\u0438\u0442\u0430\u043D\u0430 \u0441 \u0434\u0438\u0441\u043A\u0430.");
  }
  async backup() {
    await this.ready;
    return this.store.exclusive(async () => {
      await this.folder(this.dataFolder + "/Backups");
      const path = this.dataFolder + "/Backups/tracker-" + (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-") + "-" + uid().slice(0, 6) + ".json";
      await this.app.vault.create(path, JSON.stringify(this.db, null, 2));
      new import_obsidian2.Notice("\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F: " + path);
      return path;
    });
  }
  async start(item, manual = false) {
    await this.change((db) => {
      if (db.active)
        throw new Error("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u043F\u043E\u043F\u044B\u0442\u043A\u0443.");
      db.active = {
        id: uid(),
        problemId: item.problemId,
        patternId: item.patternId,
        mode: item.mode,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        runningSince: manual ? null : Date.now(),
        elapsedMs: 0,
        hinted: false,
        reason: item.reason
      };
    });
    if (manual) new FinishModal(this, true).open();
  }
  async note(problemId) {
    await this.ready;
    return this.store.exclusive(async () => {
      const p = this.db.problems.find((p2) => p2.id === problemId);
      await this.folder(this.dataFolder + "/Tasks");
      const safe = p.id.replace(/[^\p{L}\p{N}_-]/gu, "_");
      const path = this.dataFolder + "/Tasks/" + safe + ".md";
      let file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian2.TFile)) {
        const patterns = p.patternIds.map(
          (id) => this.db.patterns.find((t) => t.id === id)?.name ?? id
        );
        file = await this.app.vault.create(
          path,
          `---
algo_id: ${JSON.stringify(p.id)}
difficulty: ${JSON.stringify(p.difficulty)}
patterns: ${JSON.stringify(patterns)}
---

# ${p.title.replace(/[\r\n]/g, " ")}

${p.url}

## \u0418\u0434\u0435\u044F \u0438 \u0438\u043D\u0432\u0430\u0440\u0438\u0430\u043D\u0442

## \u0420\u0435\u0448\u0435\u043D\u0438\u0435

## \u041E\u0448\u0438\u0431\u043A\u0438 \u0438 \u043A\u0440\u0430\u0439\u043D\u0438\u0435 \u0441\u043B\u0443\u0447\u0430\u0438
`
        );
      }
      if (file instanceof import_obsidian2.TFile)
        await this.app.workspace.getLeaf("tab").openFile(file);
    });
  }
};
var AlgoPatternsSettings = class extends import_obsidian2.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.replaceChildren();
    void this.plugin.ready.then(() => this.render()).catch((error) => {
      el(this.containerEl, "p", String(error), "ap-error");
    });
  }
  render() {
    this.containerEl.replaceChildren();
    let value = this.plugin.dataFolder;
    new import_obsidian2.Setting(this.containerEl).setName("\u041F\u0430\u043F\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445").setDesc(
      "\u041A\u0430\u0442\u0430\u043B\u043E\u0433, \u0438\u0441\u0442\u043E\u0440\u0438\u044F, \u0442\u0430\u0439\u043C\u0435\u0440, \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438 \u0438 \u0437\u0430\u043C\u0435\u0442\u043A\u0438. \u041F\u0440\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u0430\u043F\u043A\u0430 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u0446\u0435\u043B\u0438\u043A\u043E\u043C. \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E: _algo_patterns."
    ).addText(
      (text) => text.setPlaceholder(DEFAULT_DATA_FOLDER).setValue(value).onChange((next) => {
        value = next;
      })
    ).addButton(
      (save) => save.setButtonText("\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438").onClick(async () => {
        save.setDisabled(true);
        try {
          await this.plugin.changeDataFolder(value);
          this.display();
        } catch (error) {
          new import_obsidian2.Notice(String(error), 8e3);
        } finally {
          save.setDisabled(false);
        }
      })
    );
    el(this.containerEl, "p", "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: " + this.plugin.dataPath);
    el(
      this.containerEl,
      "p",
      "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F."
    );
    new import_obsidian2.Setting(this.containerEl).setName("\u0412\u0440\u0435\u043C\u044F \u043D\u0430 \u043F\u043B\u0430\u043D, \u043C\u0438\u043D").addText(
      (text) => text.setValue(String(this.plugin.db.settings.budget)).onChange(async (value2) => {
        const budget = Number(value2);
        if (!Number.isFinite(budget) || budget < 5 || budget > 480) return;
        try {
          await this.plugin.change((db) => {
            db.settings.budget = budget;
          });
        } catch (error) {
          new import_obsidian2.Notice(String(error));
        }
      })
    );
    new import_obsidian2.Setting(this.containerEl).setName("\u0414\u043E\u043B\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043D\u0430 \u043D\u043E\u0432\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438").addDropdown(
      (select2) => select2.addOptions({ "40": "40%", "60": "60%", "80": "80%" }).setValue(String(this.plugin.db.settings.newPercent)).onChange(async (value2) => {
        try {
          await this.plugin.change((db) => {
            db.settings.newPercent = Number(value2);
          });
        } catch (error) {
          new import_obsidian2.Notice(String(error));
        }
      })
    );
    new import_obsidian2.Setting(this.containerEl).setName("\u0421\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043F\u0430\u0442\u0442\u0435\u0440\u043D \u043F\u0440\u0438 \u0441\u043C\u0435\u0448\u0430\u043D\u043D\u043E\u0439 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0435").addToggle(
      (toggle) => toggle.setValue(this.plugin.db.settings.hidePattern).onChange(async (value2) => {
        try {
          await this.plugin.change((db) => {
            db.settings.hidePattern = value2;
          });
        } catch (error) {
          new import_obsidian2.Notice(String(error));
        }
      })
    );
    new import_obsidian2.Setting(this.containerEl).setName("\u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043F\u043E\u0434\u0445\u043E\u0434\u0430").addToggle(
      (toggle) => toggle.setValue(this.plugin.db.settings.includeRecall).onChange(async (value2) => {
        try {
          await this.plugin.change((db) => {
            db.settings.includeRecall = value2;
          });
        } catch (error) {
          new import_obsidian2.Notice(String(error));
        }
      })
    );
  }
};
var TrainerView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  tab = "today";
  search = "";
  filterTopic = "";
  page = 0;
  skipped = /* @__PURE__ */ new Set();
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return "Algo Patterns";
  }
  getIcon() {
    return "brain-circuit";
  }
  async onOpen() {
    this.contentEl.classList.add("ap-root");
    this.contentEl.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430\u2026";
    this.registerInterval(window.setInterval(() => this.tick(), 1e3));
    void this.plugin.ready.then(() => this.render()).catch(() => this.render());
  }
  async onClose() {
    this.contentEl.replaceChildren();
  }
  tick() {
    const active = this.plugin.db.active;
    const target = this.contentEl.querySelector("[data-timer]");
    if (active && target) {
      const seconds = Math.floor(elapsed(active) / 1e3);
      target.textContent = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    }
  }
  render() {
    const root = this.contentEl;
    root.replaceChildren();
    if (this.plugin.startupError) {
      empty(
        root,
        "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0431\u0430\u0437\u0443",
        this.plugin.startupError + " \u0424\u0430\u0439\u043B \u043D\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0430\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 " + this.plugin.dataPath + " \u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438."
      );
      return;
    }
    const header = el(root, "header", "", "ap-header");
    const title = el(header, "div");
    el(title, "h2", "Algo Patterns");
    button(header, "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0431\u0430\u0437\u0443 \u0434\u0430\u043D\u043D\u044B\u0445", () => this.plugin.reloadDatabase());
    const nav = el(root, "nav", "", "ap-nav");
    nav.setAttribute("aria-label", "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u0442\u0440\u0435\u043D\u0430\u0436\u0451\u0440\u0430");
    for (const [id, name] of [
      ["today", "\u0421\u0435\u0433\u043E\u0434\u043D\u044F"],
      ["catalog", "\u041A\u0430\u0442\u0430\u043B\u043E\u0433"],
      ["progress", "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441"],
      ["history", "\u0418\u0441\u0442\u043E\u0440\u0438\u044F"],
      ["data", "\u0414\u0430\u043D\u043D\u044B\u0435"]
    ]) {
      const b = button(nav, name, () => {
        this.tab = id;
        this.render();
      });
      b.classList.toggle("is-active", this.tab === id);
      b.setAttribute("aria-pressed", String(this.tab === id));
    }
    if (this.plugin.db.active) this.active(root);
    const body = el(root, "main");
    if (this.tab === "today") this.today(body);
    if (this.tab === "catalog") this.catalog(body);
    if (this.tab === "progress") this.progress(body);
    if (this.tab === "history") this.history(body);
    if (this.tab === "data") this.data(body);
    if (this.tab !== "data")
      el(
        root,
        "p",
        "\u0410\u0432\u0442\u043E\u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435: " + this.plugin.dataPath,
        "ap-muted ap-storage"
      );
    this.tick();
  }
  active(root) {
    const a = this.plugin.db.active;
    const p = this.plugin.db.problems.find((p2) => p2.id === a.problemId);
    const box = el(root, "section", "", "ap-active");
    const top = el(box, "div", "", "ap-between");
    el(
      top,
      "span",
      a.runningSince === null ? "\u041F\u041E\u041F\u042B\u0422\u041A\u0410 \u041D\u0410 \u041F\u0410\u0423\u0417\u0415" : "\u0422\u0415\u041A\u0423\u0429\u0410\u042F \u041F\u041E\u041F\u042B\u0422\u041A\u0410",
      "ap-eyebrow"
    );
    const timer = el(top, "span", "", "ap-timer");
    timer.dataset.timer = "";
    timer.setAttribute("aria-label", "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F");
    el(box, "h3", p.title);
    el(box, "p", modeLabels[a.mode] + " \xB7 " + p.difficulty, "ap-muted");
    if (!this.plugin.db.settings.hidePattern || a.reason === "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430")
      el(
        box,
        "p",
        this.plugin.db.patterns.find((p2) => p2.id === a.patternId)?.name ?? ""
      );
    if (a.mode === "recall")
      el(
        box,
        "p",
        "\u0414\u043E \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0437\u0430\u043C\u0435\u0442\u043E\u043A \u043D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u043F\u043E\u0434\u0445\u043E\u0434, \u0438\u043D\u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0438 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C. \u042D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043A\u0430\u043A \u043F\u043E\u043B\u043D\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435."
      );
    const controls = el(box, "div", "", "ap-actions");
    if (p.url) link(controls, "\u041E\u0442\u043A\u0440\u044B\u0442\u044C LeetCode / \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u2197", p.url);
    button(
      controls,
      a.runningSince === null ? "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C" : "\u041F\u0430\u0443\u0437\u0430",
      () => this.plugin.change((db) => {
        if (!db.active) return;
        const current = db.active;
        current.elapsedMs = elapsed(current);
        current.runningSince = current.runningSince === null ? Date.now() : null;
      })
    );
    const hint = button(
      controls,
      a.hinted ? "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0443\u0447\u0442\u0435\u043D\u0430" : "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043B \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0443",
      () => this.plugin.change((db) => {
        if (db.active) db.active.hinted = true;
      })
    );
    hint.disabled = a.hinted;
    button(
      controls,
      "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C",
      async () => {
        await this.plugin.change((db) => {
          if (db.active) {
            db.active.elapsedMs = elapsed(db.active);
            db.active.runningSince = null;
          }
        });
        new FinishModal(this.plugin).open();
      },
      true
    );
    button(
      controls,
      "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u043E\u043F\u044B\u0442\u043A\u0443",
      () => new ConfirmModal(
        this.plugin,
        "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u043F\u043E\u043F\u044B\u0442\u043A\u0443?",
        "\u0422\u0430\u0439\u043C\u0435\u0440 \u0431\u0443\u0434\u0435\u0442 \u0441\u0431\u0440\u043E\u0448\u0435\u043D. \u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0438 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u043F\u0440\u0435\u0436\u043D\u0438\u043C\u0438.",
        () => this.plugin.change((db) => {
          db.active = null;
        })
      ).open()
    );
  }
  today(root) {
    const db = this.plugin.db;
    if (!db.problems.length) {
      const box = empty(
        root,
        "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u043F\u0443\u0441\u0442",
        "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 CSV/JSON \u0438\u043B\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433."
      );
      button(
        box,
        "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433",
        () => new ImportModal(this.plugin, JSON.stringify(starter_catalog_default)).open(),
        true
      );
      return;
    }
    const settings = el(root, "div", "", "ap-settings");
    select(
      settings,
      "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0442\u0435\u043C\u0430",
      [
        ["", "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u043C\u0443"],
        ...db.topics.map((t) => [t.id, t.name])
      ],
      db.settings.topicId,
      (id) => this.plugin.change((d) => {
        d.settings.topicId = id;
        d.settings.patternId = "";
        this.skipped.clear();
      })
    );
    select(
      settings,
      "\u041F\u0430\u0442\u0442\u0435\u0440\u043D",
      [
        ["", "\u0412\u0441\u0435 \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u044B \u0442\u0435\u043C\u044B"],
        ...db.patterns.filter((p) => p.topicId === db.settings.topicId).map((p) => [p.id, p.name])
      ],
      db.settings.patternId,
      (id) => this.plugin.change((d) => {
        d.settings.patternId = id;
        this.skipped.clear();
      })
    );
    const budget = input(
      settings,
      "\u0412\u0440\u0435\u043C\u044F \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043F\u043B\u0430\u043D, \u043C\u0438\u043D",
      String(db.settings.budget),
      "number"
    );
    budget.min = "5";
    budget.max = "480";
    budget.step = "5";
    budget.addEventListener("change", () => {
      const v = Number(budget.value);
      if (!Number.isFinite(v) || v < 5 || v > 480) {
        new import_obsidian2.Notice("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043E\u0442 5 \u0434\u043E 480 \u043C\u0438\u043D\u0443\u0442.");
        budget.value = String(db.settings.budget);
        return;
      }
      void this.plugin.change((d) => {
        d.settings.budget = v;
      }).catch((e) => new import_obsidian2.Notice(String(e)));
    });
    select(
      settings,
      "\u0414\u043E\u043B\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043D\u0430 \u043D\u043E\u0432\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438",
      [
        ["40", "40%"],
        ["60", "60%"],
        ["80", "80%"]
      ],
      String(db.settings.newPercent),
      (value) => this.plugin.change((d) => {
        d.settings.newPercent = Number(value);
      })
    );
    const due = db.cards.filter(
      (c) => c.mode === "solve" && Date.parse(c.due) <= Date.now() && !db.problems.find((p) => p.id === c.problemId)?.suspended
    ).length;
    const queue = buildQueue(db).filter(
      (item) => !this.skipped.has(item.problemId)
    );
    const headline = el(root, "div", "", "ap-between");
    el(headline, "h3", "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438");
    el(
      headline,
      "span",
      `${queue.length} \u0437\u0430\u0434\u0430\u0447 \xB7 \u2248 ${queue.reduce((sum, i) => sum + i.minutes, 0)} \u043C\u0438\u043D \xB7 ${due} \u043F\u043E\u043B\u043D\u044B\u0445 \u043F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u0439 \u043A \u0441\u0440\u043E\u043A\u0443`,
      "ap-muted"
    );
    if (!queue.length)
      empty(
        root,
        "\u041D\u0435\u0442 \u0437\u0430\u0434\u0430\u0447 \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438",
        "\u041D\u0435\u0442 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u0437\u0430\u0434\u0430\u0447 \u0432 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u0431\u044E\u0434\u0436\u0435\u0442\u0435. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044E \u0442\u0435\u043C\u0443, \u0443\u0432\u0435\u043B\u0438\u0447\u044C\u0442\u0435 \u0432\u0440\u0435\u043C\u044F \u0438\u043B\u0438 \u043D\u0430\u0447\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0438\u0437 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430."
      );
    queue.forEach((item) => this.queueRow(root, item));
    if (this.skipped.size)
      button(root, "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043D\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432 \u043F\u043B\u0430\u043D", () => {
        this.skipped.clear();
        this.render();
      });
  }
  queueRow(root, item) {
    const db = this.plugin.db, p = db.problems.find((p2) => p2.id === item.problemId);
    const row = el(root, "article", "", "ap-task-row");
    const info = el(row, "div");
    const chips = el(info, "div", "", "ap-meta");
    el(
      chips,
      "span",
      item.kind === "new" ? "\u041D\u041E\u0412\u0410\u042F" : item.kind === "transfer" ? "\u041F\u0415\u0420\u0415\u041D\u041E\u0421 \u041D\u0410\u0412\u042B\u041A\u0410" : "\u041F\u041E\u0412\u0422\u041E\u0420\u0415\u041D\u0418\u0415",
      "ap-tag"
    );
    el(
      chips,
      "span",
      `${p.difficulty} \xB7 \u2248 ${item.minutes} \u043C\u0438\u043D \xB7 ${modeLabels[item.mode]}`,
      "ap-muted"
    );
    el(info, "h4", p.title);
    el(info, "p", item.reason, "ap-muted");
    if (!db.settings.hidePattern || item.kind === "new")
      el(
        info,
        "p",
        db.patterns.find((p2) => p2.id === item.patternId)?.name ?? "",
        "ap-muted"
      );
    const actions = el(row, "div", "", "ap-actions");
    const start = button(
      actions,
      "\u041D\u0430\u0447\u0430\u0442\u044C",
      () => this.plugin.start(item),
      true
    );
    start.disabled = !!db.active;
    button(actions, "\u041F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C", () => {
      this.skipped.add(item.problemId);
      this.render();
    });
  }
  catalog(root) {
    const db = this.plugin.db;
    const toolbar = el(root, "div", "", "ap-settings");
    const search = input(toolbar, "\u041F\u043E\u0438\u0441\u043A \u0437\u0430\u0434\u0430\u0447\u0438 / ID", this.search);
    select(
      toolbar,
      "\u0422\u0435\u043C\u0430",
      [
        ["", "\u0412\u0441\u0435 \u0442\u0435\u043C\u044B"],
        ...db.topics.map((t) => [t.id, t.name])
      ],
      this.filterTopic,
      (value) => {
        this.filterTopic = value;
        this.page = 0;
        draw();
      }
    );
    button(
      toolbar,
      "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443",
      () => new ProblemModal(this.plugin).open()
    );
    const target = el(root, "div");
    const draw = () => {
      target.replaceChildren();
      const filtered = db.problems.filter(
        (p) => (p.title + " " + p.id).toLowerCase().includes(this.search.toLowerCase()) && (!this.filterTopic || p.patternIds.some(
          (id) => db.patterns.find((t) => t.id === id)?.topicId === this.filterTopic
        ))
      );
      el(
        target,
        "p",
        `${db.topics.length} \u0442\u0435\u043C \xB7 ${db.patterns.length} \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u043E\u0432 \xB7 ${db.problems.length} \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0437\u0430\u0434\u0430\u0447. \u041D\u0430\u0439\u0434\u0435\u043D\u043E: ${filtered.length}.`,
        "ap-muted"
      );
      for (const p of filtered.slice(this.page * 30, this.page * 30 + 30)) {
        const row = el(target, "article", "", "ap-task-row");
        const info = el(row, "div");
        el(info, "h4", p.title);
        el(
          info,
          "p",
          `${p.id} \xB7 ${p.difficulty}${p.suspended ? " \xB7 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0438\u0437 \u043E\u0447\u0435\u0440\u0435\u0434\u0438" : ""}`,
          "ap-muted"
        );
        const successes = db.attempts.filter(
          (a) => a.problemId === p.id && a.mode === "solve" && a.outcome === "independent"
        );
        const attempts = db.attempts.filter(
          (a) => a.problemId === p.id && a.mode === "solve"
        );
        el(
          info,
          "p",
          attempts.length ? `\u041F\u043E\u043B\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A: ${attempts.length} \xB7 \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E: ${successes.length}` : "\u0415\u0449\u0451 \u043D\u0435 \u0440\u0435\u0448\u0430\u043B\u0430\u0441\u044C",
          "ap-muted"
        );
        const patternId = p.patternIds.find(
          (id) => db.patterns.find((t) => t.id === id)?.topicId === (this.filterTopic || db.settings.topicId)
        ) ?? p.patternIds[0];
        el(
          info,
          "p",
          p.patternIds.map((id) => db.patterns.find((t) => t.id === id)?.name ?? id).join(" \xB7 "),
          "ap-patterns"
        );
        const actions = el(row, "div", "", "ap-actions");
        const item = {
          problemId: p.id,
          patternId,
          mode: "solve",
          kind: "new",
          minutes: 30,
          reason: "\u0412\u044B\u0431\u0440\u0430\u043D\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0438\u0437 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430"
        };
        const start = button(actions, "\u0420\u0435\u0448\u0430\u0442\u044C", () => this.plugin.start(item));
        start.disabled = !!db.active;
        const manual = button(
          actions,
          "\u0412\u043D\u0435\u0441\u0442\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442",
          () => this.plugin.start(item, true)
        );
        manual.disabled = !!db.active;
        button(actions, "\u0417\u0430\u043C\u0435\u0442\u043A\u0430", () => this.plugin.note(p.id));
        button(
          actions,
          "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C",
          () => new ProblemModal(this.plugin, p.id).open()
        );
      }
      if (!filtered.length)
        empty(
          target,
          "\u0417\u0430\u0434\u0430\u0447\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B",
          "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u043F\u043E\u0438\u0441\u043A \u0438\u043B\u0438 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443."
        );
      const pages = el(target, "div", "", "ap-actions");
      if (this.page > 0)
        button(pages, "\u2190 \u041D\u0430\u0437\u0430\u0434", () => {
          this.page--;
          draw();
        });
      if ((this.page + 1) * 30 < filtered.length)
        button(pages, "\u0414\u0430\u043B\u0435\u0435 \u2192", () => {
          this.page++;
          draw();
        });
    };
    search.addEventListener("input", () => {
      this.search = search.value;
      this.page = 0;
      draw();
    });
    draw();
  }
  progress(root) {
    const db = this.plugin.db;
    const full = db.attempts.filter((a) => a.mode === "solve");
    const first = full.filter((a) => a.first);
    const repeats = full.filter((a) => !a.first);
    const independent = full.filter((a) => a.outcome === "independent");
    const metrics = el(root, "div", "", "ap-metrics");
    for (const [label, value, detail] of [
      [
        "\u0423\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0431\u0435\u0437 \u043F\u043E\u043C\u043E\u0449\u0438",
        String(new Set(independent.map((a) => a.problemId)).size),
        "\u0421\u0440\u0435\u0434\u0438 \u0432\u0441\u0435\u0445 \u043F\u043E\u043B\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A"
      ],
      [
        "\u041F\u0435\u0440\u0432\u044B\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0438 \u0431\u0435\u0437 \u043F\u043E\u043C\u043E\u0449\u0438",
        percent(
          first.filter((a) => a.outcome === "independent").length,
          first.length
        ),
        `${first.length} \u043F\u0435\u0440\u0432\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A`
      ],
      [
        "\u041F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u044F \u0431\u0435\u0437 \u043F\u043E\u043C\u043E\u0449\u0438",
        percent(
          repeats.filter((a) => a.outcome === "independent").length,
          repeats.length
        ),
        `${repeats.length} \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A`
      ]
    ]) {
      const card = el(metrics, "div", "", "ap-stat");
      el(card, "p", label);
      el(card, "strong", value);
      el(card, "small", detail);
    }
    el(root, "h3", "\u041D\u0430\u0432\u044B\u043A\u0438 \u043F\u043E \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u0430\u043C");
    const body = table(root, [
      "\u041F\u0430\u0442\u0442\u0435\u0440\u043D",
      "\u0421\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E / \u0437\u0430\u0434\u0430\u0447",
      "\u041E\u0442\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438",
      "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0430"
    ]);
    for (const pattern of db.patterns) {
      const attempts = full.filter((a) => a.patternId === pattern.id);
      if (!attempts.length) continue;
      const total = db.problems.filter(
        (p) => p.patternIds.includes(pattern.id)
      ).length;
      const successful = new Set(
        attempts.filter((a) => a.outcome === "independent").map((a) => a.problemId)
      ).size;
      const delayed = attempts.filter((a) => {
        const prior = attempts.filter((b) => b.problemId === a.problemId && b.at < a.at).at(-1);
        return prior && Date.parse(a.at) - Date.parse(prior.at) >= 864e5;
      }).slice(-10);
      const tr = el(body, "tr");
      [
        pattern.name,
        `${successful} / ${total}`,
        `${percent(delayed.filter((a) => a.outcome === "independent").length, delayed.length)} \xB7 n=${delayed.length}`,
        date(attempts.at(-1).at)
      ].forEach((x) => el(tr, "td", x));
    }
    el(root, "h3", "\u0412\u0440\u0435\u043C\u044F \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0440\u0435\u0448\u0435\u043D\u0438\u0439");
    el(
      root,
      "p",
      "\u041C\u0435\u0434\u0438\u0430\u043D\u044B \u043F\u043E \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u0443, \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0438 \u0442\u0438\u043F\u0443 \u043F\u043E\u043F\u044B\u0442\u043A\u0438. \u041F\u0435\u0440\u0432\u043E\u0435 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043C\u0435\u0448\u0438\u0432\u0430\u044E\u0442\u0441\u044F; \u0431\u044B\u0441\u0442\u0440\u044B\u0435 \u043E\u0442\u043A\u0430\u0437\u044B \u0438 \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u044B.",
      "ap-muted"
    );
    const groups = /* @__PURE__ */ new Map();
    independent.forEach((a) => {
      const p = db.problems.find((p2) => p2.id === a.problemId);
      const key2 = a.patternId + "|" + p.difficulty + "|" + a.first;
      const group = groups.get(key2) ?? {
        pattern: db.patterns.find((p2) => p2.id === a.patternId)?.name ?? "",
        difficulty: p.difficulty,
        kind: a.first ? "\u041F\u0435\u0440\u0432\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435" : "\u041F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u0435",
        minutes: []
      };
      group.minutes.push(a.minutes);
      groups.set(key2, group);
    });
    const times = table(root, [
      "\u041F\u0430\u0442\u0442\u0435\u0440\u043D / \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C",
      "\u041F\u043E\u043F\u044B\u0442\u043A\u0430",
      "\u041C\u0435\u0434\u0438\u0430\u043D\u0430, \u043C\u0438\u043D",
      "n"
    ]);
    for (const group of groups.values()) {
      const tr = el(times, "tr");
      [
        group.pattern + " \xB7 " + group.difficulty,
        group.kind,
        n(median(group.minutes)),
        String(group.minutes.length)
      ].forEach((x) => el(tr, "td", x));
    }
    el(root, "h3", "\u0414\u0438\u043D\u0430\u043C\u0438\u043A\u0430 \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u0437\u0430\u0434\u0430\u0447\u0435");
    const practiced = db.problems.filter(
      (p) => full.some((a) => a.problemId === p.id)
    );
    if (!practiced.length) {
      empty(root, "\u041D\u0435\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432", "\u041D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A.");
      return;
    }
    const chart = el(root, "div");
    const chooser = select(
      root,
      "\u0417\u0430\u0434\u0430\u0447\u0430",
      practiced.map((p) => [p.id, p.title]),
      practiced[0].id,
      (id) => draw(id)
    );
    root.insertBefore(chooser.parentElement, chart);
    const draw = (id) => {
      chart.replaceChildren();
      const attempts = full.filter((a) => a.problemId === id).slice(-12);
      const max = Math.max(...attempts.map((a) => a.minutes), 1);
      for (const a of attempts) {
        const row = el(chart, "div", "", "ap-bar-row");
        el(
          row,
          "span",
          `${new Date(a.at).toLocaleDateString("ru-RU")} \xB7 ${outcomeLabels[a.outcome]}`
        );
        const track = el(row, "div", "", "ap-bar-track");
        const bar = el(track, "div", "", "ap-bar");
        bar.style.width = a.minutes / max * 100 + "%";
        bar.classList.toggle("is-assisted", a.outcome !== "independent");
        el(row, "span", n(a.minutes) + " \u043C\u0438\u043D");
      }
    };
    draw(practiced[0].id);
  }
  history(root) {
    const db = this.plugin.db;
    el(root, "h3", "\u0416\u0443\u0440\u043D\u0430\u043B \u043F\u043E\u043F\u044B\u0442\u043E\u043A");
    if (!db.attempts.length) {
      empty(root, "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0443\u0441\u0442\u0430", "\u041D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A.");
      return;
    }
    for (const a of [...db.attempts].reverse().slice(0, 100)) {
      const row = el(root, "article", "", "ap-history");
      el(
        row,
        "h4",
        db.problems.find((p) => p.id === a.problemId)?.title ?? a.problemId
      );
      el(
        row,
        "p",
        `${date(a.at)} \xB7 ${n(a.minutes)} \u043C\u0438\u043D \xB7 ${modeLabels[a.mode]} \xB7 ${outcomeLabels[a.outcome]}`
      );
      el(
        row,
        "p",
        (db.patterns.find((p) => p.id === a.patternId)?.name ?? "") + (a.first ? " \xB7 \u043F\u0435\u0440\u0432\u0430\u044F \u043F\u043E\u043B\u043D\u0430\u044F \u043F\u043E\u043F\u044B\u0442\u043A\u0430" : ""),
        "ap-muted"
      );
      if (a.note) el(row, "p", a.note);
    }
    if (db.attempts.length > 100)
      el(
        root,
        "p",
        "\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 100 \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u043B\u043D\u0430\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0432 tracker.json.",
        "ap-muted"
      );
  }
  data(root) {
    el(root, "h3", "\u041F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u044F \u0438 \u0434\u0430\u043D\u043D\u044B\u0435");
    const folder = input(root, "\u041F\u0430\u043F\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445", this.plugin.dataFolder);
    button(
      root,
      "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443 \u0438 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0434\u0430\u043D\u043D\u044B\u0435",
      () => this.plugin.changeDataFolder(folder.value)
    );
    el(
      root,
      "p",
      "\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E: _algo_patterns. \u041F\u0440\u0438 \u0441\u043C\u0435\u043D\u0435 \u043F\u0443\u0442\u0438 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u0430\u043F\u043A\u0430 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u0446\u0435\u043B\u0438\u043A\u043E\u043C; \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439 \u043F\u0443\u0442\u044C \u0432\u043D\u0443\u0442\u0440\u0438 vault.",
      "ap-muted"
    );
    const settings = el(root, "div", "", "ap-stack");
    const hide = checkbox(
      settings,
      "\u0421\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043F\u0430\u0442\u0442\u0435\u0440\u043D \u043F\u0440\u0438 \u0441\u043C\u0435\u0448\u0430\u043D\u043D\u043E\u0439 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0435",
      this.plugin.db.settings.hidePattern
    );
    hide.addEventListener("change", () => {
      void this.plugin.change((d) => {
        d.settings.hidePattern = hide.checked;
      }).catch((e) => new import_obsidian2.Notice(String(e)));
    });
    const recall = checkbox(
      settings,
      "\u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043F\u043E\u0434\u0445\u043E\u0434\u0430 (\u2248 5 \u043C\u0438\u043D\u0443\u0442)",
      this.plugin.db.settings.includeRecall
    );
    recall.addEventListener("change", () => {
      void this.plugin.change((d) => {
        d.settings.includeRecall = recall.checked;
      }).catch((e) => new import_obsidian2.Notice(String(e)));
    });
    el(
      root,
      "p",
      "\u0418\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u0439: 1 \u2192 3 \u2192 7 \u2192 14 \u2192 30 \u2192 60 \u2192 90 \u0434\u043D\u0435\u0439. \u041F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438, \u0440\u0430\u0437\u0431\u043E\u0440\u0430 \u0438\u043B\u0438 \u043D\u0435\u0443\u0434\u0430\u0447\u0438 \u2014 1 \u0434\u0435\u043D\u044C."
    );
    el(root, "p", "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: " + this.plugin.dataPath, "ap-muted");
    el(
      root,
      "p",
      "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F.",
      "ap-muted"
    );
    el(
      root,
      "p",
      "\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0435 \u043A\u043E\u043F\u0438\u0438: " + this.plugin.dataFolder + "/Backups/",
      "ap-muted"
    );
    el(root, "p", "\u0417\u0430\u043C\u0435\u0442\u043A\u0438: " + this.plugin.dataFolder + "/Tasks/", "ap-muted");
    const actions = el(root, "div", "", "ap-actions");
    button(actions, "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E", () => this.plugin.backup());
    button(
      actions,
      "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E",
      () => new RestoreModal(this.plugin).open()
    );
    button(actions, "\u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0431\u0430\u0437\u0443", () => this.plugin.reloadDatabase());
    button(
      actions,
      "\u0418\u043C\u043F\u043E\u0440\u0442 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430",
      () => new ImportModal(this.plugin).open()
    );
    button(
      actions,
      "\u0418\u043C\u043F\u043E\u0440\u0442 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430",
      () => new ImportModal(this.plugin, JSON.stringify(starter_catalog_default)).open()
    );
  }
};
var ConfirmModal = class extends import_obsidian2.Modal {
  constructor(plugin, title, description, action) {
    super(plugin.app);
    this.plugin = plugin;
    this.title = title;
    this.description = description;
    this.action = action;
  }
  onOpen() {
    this.contentEl.classList.add("ap-modal");
    el(this.contentEl, "h2", this.title);
    el(this.contentEl, "p", this.description);
    const actions = el(this.contentEl, "div", "", "ap-actions");
    button(actions, "\u041E\u0442\u043C\u0435\u043D\u0430", () => this.close());
    button(
      actions,
      "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C",
      async () => {
        await this.action();
        this.close();
      },
      true
    );
  }
};
var FinishModal = class extends import_obsidian2.Modal {
  constructor(plugin, manual = false) {
    super(plugin.app);
    this.plugin = plugin;
    this.manual = manual;
    this.active = structuredClone(plugin.db.active);
  }
  active;
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    const problem = this.plugin.db.problems.find(
      (p) => p.id === this.active.problemId
    );
    el(root, "h2", "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u043F\u044B\u0442\u043A\u0438");
    el(root, "p", problem.title);
    const minutes = input(
      root,
      "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F, \u043C\u0438\u043D\u0443\u0442",
      String(
        this.manual ? 30 : Math.max(0.01, Math.round(elapsed(this.active) / 600) / 100)
      ),
      "number"
    );
    minutes.min = "0.01";
    minutes.max = "1440";
    minutes.step = "0.01";
    const pattern = select(
      root,
      "\u041A\u0430\u043A\u0438\u043C \u0441\u043F\u043E\u0441\u043E\u0431\u043E\u043C \u0440\u0435\u0448\u0430\u043B\u0438",
      problem.patternIds.map((id) => [
        id,
        this.plugin.db.patterns.find((p) => p.id === id)?.name ?? id
      ]),
      this.active.patternId
    );
    const result = select(
      root,
      "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442",
      Object.entries(outcomeLabels),
      this.active.hinted ? "hint" : "independent"
    );
    if (this.active.hinted) {
      const option = Array.from(result.options).find(
        (o) => o.value === "independent"
      );
      if (option) option.disabled = true;
      el(root, "p", "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 \u0443\u0436\u0435 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043E.", "ap-muted");
    }
    const noteLabel = el(root, "label", "", "ap-field");
    el(noteLabel, "span", "\u0413\u0434\u0435 \u0437\u0430\u0441\u0442\u0440\u044F\u043B\u0438 / \u0447\u0442\u043E \u0437\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u044C (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)");
    const note = el(noteLabel, "textarea");
    note.rows = 3;
    note.placeholder = "\u041D\u0435 \u0443\u0437\u043D\u0430\u043B \u043F\u0430\u0442\u0442\u0435\u0440\u043D, \u043E\u0448\u0438\u0431\u043A\u0430 \u0433\u0440\u0430\u043D\u0438\u0446, \u043A\u0440\u0430\u0439\u043D\u0438\u0439 \u0441\u043B\u0443\u0447\u0430\u0439\u2026";
    const feedback = el(root, "p", "", "ap-feedback");
    feedback.setAttribute("role", "alert");
    const actions = el(root, "div", "", "ap-actions");
    button(actions, "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F", () => this.close());
    button(
      actions,
      "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442",
      async () => {
        try {
          const value = Number(minutes.value);
          await this.plugin.change((db) => {
            if (db.active?.id !== this.active.id)
              throw new Error(
                "\u0410\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u043E\u043F\u044B\u0442\u043A\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0437\u0430\u043D\u043E\u0432\u043E."
              );
            if (db.active.hinted && result.value === "independent")
              throw new Error("\u0414\u043B\u044F \u044D\u0442\u043E\u0439 \u043F\u043E\u043F\u044B\u0442\u043A\u0438 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u0430 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430.");
            recordAttempt(db, {
              id: this.active.id,
              problemId: this.active.problemId,
              patternId: pattern.value,
              mode: this.active.mode,
              outcome: result.value,
              minutes: value,
              at: (/* @__PURE__ */ new Date()).toISOString(),
              note: note.value.trim()
            });
          });
          this.close();
          new import_obsidian2.Notice("\u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430. \u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E.");
        } catch (error) {
          feedback.textContent = error.message;
        }
      },
      true
    );
  }
};
var ImportModal = class extends import_obsidian2.Modal {
  constructor(plugin, initial = "") {
    super(plugin.app);
    this.plugin = plugin;
    this.initial = initial;
  }
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    el(root, "h2", "\u0418\u043C\u043F\u043E\u0440\u0442 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430");
    el(
      root,
      "p",
      "CSV: topic, pattern, title, id, url, difficulty. \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 Numbers: Pattern, Problems. JSON: topics, patterns, problems."
    );
    const file = input(root, "\u0412\u044B\u0431\u0440\u0430\u0442\u044C CSV \u0438\u043B\u0438 JSON", "", "file");
    file.accept = ".csv,.tsv,.json,text/csv,application/json";
    const source = el(root, "textarea");
    source.className = "ap-import-text";
    source.setAttribute("aria-label", "\u0414\u0430\u043D\u043D\u044B\u0435 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430");
    source.rows = 7;
    source.placeholder = "\u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 CSV \u0438\u043B\u0438 JSON";
    source.value = this.initial;
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (selected)
        void selected.text().then((text) => {
          source.value = text;
          preview.replaceChildren();
        }).catch((e) => new import_obsidian2.Notice(String(e)));
    });
    const preview = el(root, "div");
    const parse = () => {
      preview.replaceChildren();
      try {
        const result = parseImport(source.value);
        const c = result.catalog;
        el(
          preview,
          "p",
          `${c.topics.length} \u0442\u0435\u043C \xB7 ${c.patterns.length} \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u043E\u0432 \xB7 ${c.problems.length} \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0437\u0430\u0434\u0430\u0447`,
          "ap-preview-count"
        );
        const existing = c.problems.filter(
          (p) => this.plugin.db.problems.some((old) => old.id === p.id)
        ).length;
        el(
          preview,
          "p",
          `${c.problems.length - existing} \u043D\u043E\u0432\u044B\u0445 \xB7 ${existing} \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0445. \u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0438 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F.`
        );
        if (result.warnings.length) {
          const details = el(preview, "details");
          el(details, "summary", `\u0417\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u044F: ${result.warnings.length}`);
          result.warnings.forEach((w) => el(details, "p", w));
        }
        const sample = el(preview, "ul");
        c.problems.slice(0, 5).forEach((p) => el(sample, "li", p.title + " \xB7 " + p.difficulty));
        button(
          preview,
          "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
          async () => {
            if (this.plugin.db.problems.length || this.plugin.db.attempts.length)
              await this.plugin.backup();
            let summary = { added: 0, updated: 0 };
            await this.plugin.change((db) => {
              summary = mergeCatalog(db, result.catalog);
            });
            this.close();
            new import_obsidian2.Notice(
              `\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E: ${summary.added}. \u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E: ${summary.updated}.`
            );
          },
          true
        );
      } catch (e) {
        el(preview, "p", e.message, "ap-error");
      }
    };
    source.addEventListener("input", () => preview.replaceChildren());
    button(root, "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438\u043C\u043F\u043E\u0440\u0442", parse);
    if (this.initial) parse();
  }
};
var RestoreModal = class extends import_obsidian2.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    el(root, "h2", "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0431\u0430\u0437\u0443");
    el(
      root,
      "p",
      "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u043B\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E tracker.json. \u041F\u0435\u0440\u0435\u0434 \u0437\u0430\u043C\u0435\u043D\u043E\u0439 \u0431\u0443\u0434\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u0431\u0430\u0437\u0430. \u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u0442\u0430\u0439\u043C\u0435\u0440 \u0438\u0437 \u043A\u043E\u043F\u0438\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u043D\u0430 \u043F\u0430\u0443\u0437\u0435."
    );
    const file = input(root, "\u0424\u0430\u0439\u043B \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438", "", "file");
    file.accept = ".json";
    const preview = el(root, "div");
    file.addEventListener("change", () => {
      preview.replaceChildren();
      const selected = file.files?.[0];
      if (selected)
        void selected.text().then((text) => {
          const backup = validateDatabase(JSON.parse(text));
          el(
            preview,
            "p",
            `${backup.problems.length} \u0437\u0430\u0434\u0430\u0447 \xB7 ${backup.attempts.length} \u043F\u043E\u043F\u044B\u0442\u043E\u043A`
          );
          button(
            preview,
            "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043F\u0438\u044E \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0431\u0430\u0437\u044B \u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C",
            async () => {
              await this.plugin.backup();
              await this.plugin.change((db) => {
                const restored = structuredClone(backup);
                if (restored.active) restored.active.runningSince = null;
                Object.assign(db, restored);
              });
              this.close();
              new import_obsidian2.Notice("\u0411\u0430\u0437\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.");
            },
            true
          );
        }).catch((e) => el(preview, "p", e.message, "ap-error"));
    });
  }
};
var ProblemModal = class extends import_obsidian2.Modal {
  constructor(plugin, problemId) {
    super(plugin.app);
    this.plugin = plugin;
    this.problemId = problemId;
  }
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    const db = this.plugin.db;
    const existing = db.problems.find((p) => p.id === this.problemId);
    const primary = existing ? db.patterns.find((p) => p.id === existing.patternIds[0]) : void 0;
    el(root, "h2", existing ? "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443" : "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443");
    const title = input(root, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", existing?.title ?? "");
    const id = input(root, "ID LeetCode (\u0438\u043B\u0438 \u0441\u0432\u043E\u0439 ID)", existing?.id ?? "");
    id.disabled = !!existing;
    const topic = input(
      root,
      "\u0422\u0435\u043C\u0430",
      db.topics.find((t) => t.id === primary?.topicId)?.name ?? db.topics.find((t) => t.id === db.settings.topicId)?.name ?? ""
    );
    const pattern = input(root, "\u041F\u0430\u0442\u0442\u0435\u0440\u043D", primary?.name ?? "");
    const url = input(root, "\u0421\u0441\u044B\u043B\u043A\u0430", existing?.url ?? "", "url");
    const difficulty2 = select(
      root,
      "\u0421\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C",
      ["Unknown", "Easy", "Medium", "Hard"].map((v) => [v, v]),
      existing?.difficulty ?? "Unknown"
    );
    const suspended = checkbox(
      root,
      "\u0418\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443 \u0438\u0437 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043E\u0447\u0435\u0440\u0435\u0434\u0438",
      existing?.suspended ?? false
    );
    const feedback = el(root, "p", "", "ap-feedback");
    feedback.setAttribute("role", "alert");
    el(
      root,
      "p",
      "\u041F\u0440\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0438 \u0442\u0435\u043C\u044B \u0438\u043B\u0438 \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043D\u043E\u0432\u0430\u044F \u0441\u0432\u044F\u0437\u044C; \u0441\u0442\u0430\u0440\u044B\u0435 \u0441\u0432\u044F\u0437\u0438 \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F.",
      "ap-muted"
    );
    button(
      root,
      "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
      async () => {
        try {
          if (!title.value.trim() || !topic.value.trim() || !pattern.value.trim())
            throw new Error("\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u0442\u0435\u043C\u0443 \u0438 \u043F\u0430\u0442\u0442\u0435\u0440\u043D.");
          if (url.value && !/^https?:\/\//i.test(url.value))
            throw new Error("\u0421\u0441\u044B\u043B\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0447\u0438\u043D\u0430\u0442\u044C\u0441\u044F \u0441 https:// \u0438\u043B\u0438 http://.");
          const escaped = (v) => '"' + v.replace(/"/g, '""') + '"';
          const csv = "topic,pattern,title,id,url,difficulty\n" + [
            topic.value.trim(),
            pattern.value.trim(),
            title.value.trim(),
            id.value.trim() || uid(),
            url.value.trim(),
            difficulty2.value
          ].map(escaped).join(",");
          const incoming = parseImport(csv);
          if (incoming.warnings.length)
            throw new Error(incoming.warnings.join("\n"));
          await this.plugin.change((d) => {
            mergeCatalog(d, incoming.catalog);
            const p = d.problems.find(
              (p2) => p2.id === incoming.catalog.problems[0].id
            );
            p.suspended = suspended.checked;
          });
          this.close();
        } catch (e) {
          feedback.textContent = e.message;
        }
      },
      true
    );
  }
};
