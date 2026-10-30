import { Catalog, Difficulty } from "./core";
export interface ImportResult {
  catalog: Catalog;
  warnings: string[];
}
const key = (text: string) => {
  let h = 2166136261;
  for (const c of text.normalize("NFKC").trim().toLowerCase())
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
export function csvRows(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const separator = first.includes("\t")
    ? "\t"
    : first.split(";").length > first.split(",").length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
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
  if (quoted) throw new Error("Незакрытая кавычка в CSV. Проверьте экспорт.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function difficulty(text: string): Difficulty {
  const value = text.trim().toLowerCase();
  return (
    (
      {
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
        unknown: "Unknown",
        лёгкая: "Easy",
        легкая: "Easy",
        средняя: "Medium",
        сложная: "Hard",
      } as Record<string, Difficulty>
    )[value] ?? "Unknown"
  );
}
export function parseImport(text: string): ImportResult {
  const catalog: Catalog = { topics: [], patterns: [], problems: [] };
  const warnings: string[] = [];
  const add = (
    topicName: string,
    patternName: string,
    title: string,
    id: string,
    url = "",
    level = "",
  ) => {
    if (!topicName || !patternName || !title)
      throw new Error("Для каждой задачи нужны тема, паттерн и название.");
    const topicId = "topic-" + key(topicName);
    const patternId = "pattern-" + key(topicName + "|" + patternName);
    if (!catalog.topics.some((t) => t.id === topicId))
      catalog.topics.push({ id: topicId, name: topicName });
    if (!catalog.patterns.some((p) => p.id === patternId))
      catalog.patterns.push({ id: patternId, name: patternName, topicId });
    const problemId = /^\d+$/.test(id)
      ? "lc-" + id
      : id || "custom-" + key(title);
    let safeUrl = "";
    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        safeUrl = parsed.href;
      } catch {
        warnings.push(`Недопустимая ссылка у «${title}» пропущена.`);
      }
    }
    // A search link is honest when the source has no canonical LeetCode slug.
    if (!safeUrl && problemId.startsWith("lc-"))
      safeUrl =
        "https://leetcode.com/problemset/?search=" +
        encodeURIComponent(problemId.slice(3));
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
        patternIds: [patternId],
      });
    if (
      level &&
      difficulty(level) === "Unknown" &&
      level.toLowerCase() !== "unknown"
    )
      warnings.push(`Неизвестная сложность «${level}»: ${title}.`);
  };
  if (text.trimStart().startsWith("{")) {
    const data = JSON.parse(text);
    if (
      !Array.isArray(data.topics) ||
      !Array.isArray(data.patterns) ||
      !Array.isArray(data.problems)
    )
      throw new Error("JSON должен содержать topics, patterns и problems.");
    for (const problem of data.problems) {
      if (
        !Array.isArray(problem.patternIds) ||
        !problem.patternIds.length ||
        typeof problem.title !== "string" ||
        typeof problem.id !== "string"
      )
        throw new Error("Задача JSON не содержит title, id или patternIds.");
      for (const id of problem.patternIds) {
        const pattern = data.patterns.find((p: { id: string }) => p.id === id);
        const topic = data.topics.find(
          (t: { id: string }) => t.id === pattern?.topicId,
        );
        if (
          !pattern ||
          !topic ||
          typeof pattern.name !== "string" ||
          typeof topic.name !== "string"
        )
          throw new Error("У задачи отсутствует тема или паттерн.");
        add(
          topic.name,
          pattern.name,
          problem.title,
          problem.id,
          problem.url ?? "",
          problem.difficulty ?? "",
        );
      }
    }
    if (data.attempts?.length)
      warnings.push(
        "Этот импорт добавляет только каталог. Для восстановления истории используйте «Восстановить резервную копию».",
      );
  } else {
    const rows = csvRows(text);
    if (!rows.length) throw new Error("Файл пуст.");
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (...names: string[]) =>
      headers.findIndex((h) => names.includes(h));
    const ti = idx("topic", "тема"),
      pi = idx("pattern", "паттерн"),
      ni = idx("title", "problem", "задача", "название"),
      ids = idx("id", "номер"),
      ui = idx("url", "ссылка"),
      di = idx("difficulty", "сложность");
    if (ti >= 0 && pi >= 0 && ni >= 0) {
      rows.slice(1).forEach((row, i) => {
        try {
          add(
            row[ti] ?? "",
            row[pi] ?? "",
            row[ni] ?? "",
            row[ids] ?? "",
            row[ui] ?? "",
            row[di] ?? "",
          );
        } catch (e) {
          warnings.push(`Строка ${i + 2}: ${(e as Error).message}`);
        }
      });
    } else if (pi >= 0 && idx("problems") >= 0) {
      const problemsIndex = idx("problems");
      let topic = "";
      for (const [index, row] of rows.slice(1).entries()) {
        const pattern = row[pi] ?? "",
          problems = row[problemsIndex] ?? "";
        if (!pattern && !problems) continue;
        if (pattern && !problems && !/^Pattern\s+\d/i.test(pattern)) {
          topic = pattern;
          continue;
        }
        if (!topic || !pattern) {
          warnings.push(`Строка ${index + 2}: не найдена тема или паттерн.`);
          continue;
        }
        const matches = [
          ...problems.matchAll(/(?:^|,)\s*(?:\d+\s+)?(\d+)\s*\.\s*([^,]+)/g),
        ];
        if (!matches.length) {
          warnings.push(`Строка ${index + 2}: список задач не распознан.`);
          continue;
        }
        for (const match of matches)
          add(topic, pattern, match[2].trim(), match[1]);
        if (/\d+\s+\d+\s*\./.test(problems))
          warnings.push(
            `Строка ${index + 2}: убраны лишние числа перед ID; проверьте исходный список.`,
          );
      }
      warnings.push(
        "Сложность отсутствует в исходных двух колонках: импортирована как «Unknown». Связи с паттернами сохранены из источника и не проверены на корректность.",
      );
    } else
      throw new Error(
        "Нужны колонки topic, pattern, title (опционально id, url, difficulty) либо Pattern, Problems из Numbers.",
      );
  }
  if (!catalog.problems.length)
    throw new Error("Не удалось найти ни одной задачи.");
  return { catalog, warnings };
}
