import { readFileSync, writeFileSync } from "node:fs";
import { parseImport } from "../src/importer";
const source = readFileSync("data/algo-patterns-source.csv", "utf8");
const result = parseImport(source);
writeFileSync(
  "data/starter-catalog.json",
  JSON.stringify(result.catalog, null, 2) + "\n",
);
writeFileSync(
  "data/import-report.txt",
  `Источник: algo_patterns.numbers, лист Swatis Leetcode Pattern Sheet.\nТем: ${result.catalog.topics.length}\nПаттернов: ${result.catalog.patterns.length}\nУникальных задач: ${result.catalog.problems.length}\nСвязей задача—паттерн: ${result.catalog.problems.reduce((sum, p) => sum + p.patternIds.length, 0)}\n\n${result.warnings.join("\n")}\n\nСсылки ведут на поиск LeetCode по ID, поскольку в исходнике нет URL.\nНазвания и классификация сохранены из источника; это не проверенный учебный курс.\n`,
);
console.log({
  topics: result.catalog.topics.length,
  patterns: result.catalog.patterns.length,
  problems: result.catalog.problems.length,
  warnings: result.warnings,
});
