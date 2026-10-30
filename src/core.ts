export type Difficulty = "Easy" | "Medium" | "Hard" | "Unknown";
export type Outcome = "independent" | "hint" | "solution" | "failed";
export type Mode = "solve" | "recall";
export interface Topic {
  id: string;
  name: string;
}
export interface Pattern {
  id: string;
  name: string;
  topicId: string;
}
export interface Problem {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  patternIds: string[];
  suspended?: boolean;
}
export interface Catalog {
  topics: Topic[];
  patterns: Pattern[];
  problems: Problem[];
}
export interface Attempt {
  id: string;
  problemId: string;
  patternId: string;
  mode: Mode;
  outcome: Outcome;
  minutes: number;
  at: string;
  note: string;
  first: boolean;
}
export interface Card {
  problemId: string;
  patternId: string;
  mode: Mode;
  step: number;
  due: string;
  lastAt: string;
}
export interface Active {
  id: string;
  problemId: string;
  patternId: string;
  mode: Mode;
  startedAt: string;
  runningSince: number | null;
  elapsedMs: number;
  hinted: boolean;
  reason: string;
}
export interface Settings {
  topicId: string;
  patternId: string;
  budget: number;
  newPercent: number;
  hidePattern: boolean;
  includeRecall: boolean;
}
export interface Database extends Catalog {
  version: 1;
  revision: number;
  attempts: Attempt[];
  cards: Card[];
  active: Active | null;
  settings: Settings;
}
export interface QueueItem {
  problemId: string;
  patternId: string;
  mode: Mode;
  kind: "new" | "review" | "transfer";
  minutes: number;
  reason: string;
}
export const outcomeLabels: Record<Outcome, string> = {
  independent: "Самостоятельно",
  hint: "С подсказкой",
  solution: "Разобрал решение",
  failed: "Не решил",
};
export const modeLabels: Record<Mode, string> = {
  solve: "Полное решение",
  recall: "Вспомнить подход",
};
export const intervals = [1, 3, 7, 14, 30, 60, 90];
export const uid = () => crypto.randomUUID();
export const emptyDatabase = (): Database => ({
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
    includeRecall: false,
  },
});
export function elapsed(active: Active, now = Date.now()): number {
  return Math.max(
    0,
    active.elapsedMs +
      (active.runningSince === null ? 0 : now - active.runningSince),
  );
}
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
export function nextCard(previous: Card | undefined, attempt: Attempt): Card {
  const step =
    attempt.outcome === "independent"
      ? Math.min((previous?.step ?? -1) + 1, intervals.length - 1)
      : 0;
  return {
    problemId: attempt.problemId,
    patternId: attempt.patternId,
    mode: attempt.mode,
    step,
    lastAt: attempt.at,
    due: new Date(
      Date.parse(attempt.at) + intervals[step] * 86400000,
    ).toISOString(),
  };
}
export function recordAttempt(
  db: Database,
  input: Omit<Attempt, "first">,
): void {
  if (
    !db.problems.some(
      (p) => p.id === input.problemId && p.patternIds.includes(input.patternId),
    )
  )
    throw new Error("Задача или паттерн не найдены.");
  if (
    !Number.isFinite(input.minutes) ||
    input.minutes <= 0 ||
    input.minutes > 1440
  )
    throw new Error("Укажите время от 0,01 до 1440 минут.");
  if (db.attempts.some((a) => a.id === input.id))
    throw new Error("Эта попытка уже сохранена.");
  const first = !db.attempts.some(
    (a) => a.problemId === input.problemId && a.mode === "solve",
  );
  const attempt = { ...input, first: input.mode === "solve" && first };
  db.attempts.push(attempt);
  const index = db.cards.findIndex(
    (c) =>
      c.problemId === input.problemId &&
      c.patternId === input.patternId &&
      c.mode === input.mode,
  );
  const card = nextCard(db.cards[index], attempt);
  if (index < 0) db.cards.push(card);
  else db.cards[index] = card;
  // Recall has a separate schedule. It never advances the full-solution card.
  if (
    input.mode === "solve" &&
    !db.cards.some(
      (c) =>
        c.problemId === input.problemId &&
        c.patternId === input.patternId &&
        c.mode === "recall",
    )
  ) {
    db.cards.push({
      ...card,
      mode: "recall",
      step: 0,
      due: new Date(Date.parse(input.at) + 86400000).toISOString(),
    });
  }
  db.active = null;
}
function estimate(db: Database, problem: Problem, mode: Mode): number {
  if (mode === "recall") return 5;
  const same = db.attempts
    .filter(
      (a) =>
        a.mode === "solve" &&
        a.outcome === "independent" &&
        a.problemId === problem.id,
    )
    .slice(-5)
    .map((a) => a.minutes);
  return Math.max(
    5,
    Math.round(
      median(same) ||
        { Easy: 15, Medium: 30, Hard: 45, Unknown: 30 }[problem.difficulty],
    ),
  );
}
export function buildQueue(db: Database, now = Date.now()): QueueItem[] {
  const tried = new Set(
    db.attempts.filter((a) => a.mode === "solve").map((a) => a.problemId),
  );
  const learned = new Set(
    db.attempts.filter((a) => a.mode === "solve").map((a) => a.patternId),
  );
  const seen = new Set<string>();
  const reviews: QueueItem[] = [];
  for (const card of [...db.cards].sort(
    (a, b) => a.due.localeCompare(b.due) || (a.mode === "solve" ? -1 : 1),
  )) {
    const problem = db.problems.find((p) => p.id === card.problemId);
    if (
      !problem ||
      problem.suspended ||
      Date.parse(card.due) > now ||
      (card.mode === "recall" && !db.settings.includeRecall)
    )
      continue;
    // Never ask the same problem twice in one plan; full solution wins if both are due.
    if (
      card.mode === "recall" &&
      db.cards.some(
        (c) =>
          c.problemId === card.problemId &&
          c.mode === "solve" &&
          Date.parse(c.due) <= now,
      )
    )
      continue;
    if (seen.has(problem.id)) continue;
    seen.add(problem.id);
    reviews.push({
      problemId: problem.id,
      patternId: card.patternId,
      mode: card.mode,
      kind: "review",
      minutes: estimate(db, problem, card.mode),
      reason: `Повторение · срок ${new Date(card.due).toLocaleDateString("ru-RU")}`,
    });
  }
  const fresh: QueueItem[] = [];
  for (const problem of db.problems) {
    if (problem.suspended || tried.has(problem.id)) continue;
    const current = problem.patternIds.find((id) =>
      db.patterns.some(
        (p) =>
          p.id === id &&
          p.topicId === db.settings.topicId &&
          (!db.settings.patternId || p.id === db.settings.patternId),
      ),
    );
    const transfer = problem.patternIds.find((id) => learned.has(id));
    const patternId = current || transfer;
    if (!patternId) continue;
    const item: QueueItem = {
      problemId: problem.id,
      patternId,
      mode: "solve",
      kind: current ? "new" : "transfer",
      minutes: estimate(db, problem, "solve"),
      reason: current
        ? "Новая задача текущего раздела"
        : "Новая задача на знакомый паттерн",
    };
    if (current) fresh.push(item);
    else reviews.push(item);
  }
  fresh.sort((a, b) => a.minutes - b.minutes);
  const result: QueueItem[] = [];
  const selected = new Set<string>();
  let remaining = db.settings.budget;
  const take = (items: QueueItem[], cap: number) => {
    let used = 0;
    for (const item of items)
      if (
        !selected.has(item.problemId) &&
        item.minutes <= remaining &&
        used + item.minutes <= cap
      ) {
        result.push(item);
        selected.add(item.problemId);
        remaining -= item.minutes;
        used += item.minutes;
      }
  };
  const newCap = (db.settings.budget * db.settings.newPercent) / 100;
  take(reviews, db.settings.budget - newCap);
  take(fresh, newCap);
  // Spare time can be used by either lane; an oversized task is never forced into the plan.
  take(reviews, remaining);
  take(fresh, remaining);
  return result;
}
export function mergeCatalog(
  db: Database,
  incoming: Catalog,
): { added: number; updated: number } {
  for (const topic of incoming.topics)
    if (!db.topics.some((t) => t.id === topic.id)) db.topics.push(topic);
  for (const pattern of incoming.patterns)
    if (!db.patterns.some((p) => p.id === pattern.id))
      db.patterns.push(pattern);
  let added = 0,
    updated = 0;
  for (const item of incoming.problems) {
    const existing = db.problems.find((p) => p.id === item.id);
    if (existing) {
      existing.patternIds = [
        ...new Set([...existing.patternIds, ...item.patternIds]),
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
export function validateDatabase(value: unknown): Database {
  const d = value as Database;
  if (
    !d ||
    d.version !== 1 ||
    !Number.isInteger(d.revision) ||
    !Array.isArray(d.topics) ||
    !Array.isArray(d.patterns) ||
    !Array.isArray(d.problems) ||
    !Array.isArray(d.attempts) ||
    !Array.isArray(d.cards) ||
    !d.settings
  )
    throw new Error(
      "Неподдерживаемый или повреждённый формат базы. Исходный файл не изменён.",
    );
  const unique = (items: { id: string }[]) =>
    items.every((i) => i && typeof i.id === "string" && i.id.length > 0) &&
    new Set(items.map((i) => i.id)).size === items.length;
  if (
    !unique(d.topics) ||
    !unique(d.patterns) ||
    !unique(d.problems) ||
    !unique(d.attempts)
  )
    throw new Error("Повреждены идентификаторы базы.");
  if (
    d.topics.some((t) => typeof t.name !== "string") ||
    d.patterns.some(
      (p) =>
        typeof p.name !== "string" || !d.topics.some((t) => t.id === p.topicId),
    ) ||
    d.problems.some(
      (p) =>
        typeof p.title !== "string" ||
        typeof p.url !== "string" ||
        !["Easy", "Medium", "Hard", "Unknown"].includes(p.difficulty) ||
        !Array.isArray(p.patternIds) ||
        !p.patternIds.length ||
        p.patternIds.some((id) => !d.patterns.some((t) => t.id === id)),
    )
  )
    throw new Error("Повреждены связи каталога.");
  const validRef = (a: { problemId: string; patternId: string; mode: Mode }) =>
    d.problems.some(
      (p) => p.id === a.problemId && p.patternIds.includes(a.patternId),
    ) && ["solve", "recall"].includes(a.mode);
  if (
    d.attempts.some(
      (a) =>
        !validRef(a) ||
        !Object.keys(outcomeLabels).includes(a.outcome) ||
        !Number.isFinite(a.minutes) ||
        a.minutes <= 0 ||
        !Number.isFinite(Date.parse(a.at)) ||
        typeof a.note !== "string" ||
        typeof a.first !== "boolean",
    ) ||
    d.cards.some(
      (c) =>
        !validRef(c) ||
        !Number.isInteger(c.step) ||
        c.step < 0 ||
        c.step >= intervals.length ||
        !Number.isFinite(Date.parse(c.due)) ||
        !Number.isFinite(Date.parse(c.lastAt)),
    )
  )
    throw new Error("Повреждены попытки или расписание.");
  if (
    !Number.isFinite(d.settings.budget) ||
    d.settings.budget < 5 ||
    d.settings.budget > 480 ||
    !Number.isFinite(d.settings.newPercent) ||
    d.settings.newPercent < 0 ||
    d.settings.newPercent > 100 ||
    typeof d.settings.hidePattern !== "boolean" ||
    typeof d.settings.includeRecall !== "boolean" ||
    typeof d.settings.topicId !== "string" ||
    typeof d.settings.patternId !== "string"
  )
    throw new Error("Повреждены настройки.");
  if (
    d.active &&
    (!validRef(d.active) ||
      typeof d.active.id !== "string" ||
      !Number.isFinite(d.active.elapsedMs) ||
      d.active.elapsedMs < 0 ||
      (d.active.runningSince !== null &&
        !Number.isFinite(d.active.runningSince)))
  )
    throw new Error("Повреждён активный таймер.");
  return d;
}
