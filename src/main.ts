import {
  ItemView,
  Modal,
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf,
  normalizePath,
} from "obsidian";
import {
  Active,
  Attempt,
  Database,
  Difficulty,
  Mode,
  Outcome,
  QueueItem,
  buildQueue,
  elapsed,
  median,
  mergeCatalog,
  modeLabels,
  outcomeLabels,
  recordAttempt,
  uid,
  validateDatabase,
} from "./core";
import { ImportResult, parseImport } from "./importer";
import { Store } from "./store";
import starterCatalog from "../data/starter-catalog.json";

const VIEW = "algo-patterns-trainer";
const ROOT = "Algo Patterns";
const DATA = ROOT + "/tracker.json";
const date = (at: string) =>
  new Date(at).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
const n = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) + "%" : "—";
function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  text = "",
  cls = "",
): HTMLElementTagNameMap[K] {
  const item = parent.ownerDocument.createElement(tag);
  if (text) item.textContent = text;
  if (cls) item.className = cls;
  parent.append(item);
  return item;
}
function button(
  parent: HTMLElement,
  text: string,
  action: () => void | Promise<unknown>,
  primary = false,
) {
  const b = el(parent, "button", text, primary ? "mod-cta" : "");
  b.type = "button";
  b.addEventListener("click", () => {
    b.disabled = true;
    Promise.resolve()
      .then(action)
      .catch((error) => new Notice((error as Error).message, 8000))
      .finally(() => {
        b.disabled = false;
      });
  });
  return b;
}
function select(
  parent: HTMLElement,
  label: string,
  options: [string, string][],
  value: string,
  onChange?: (value: string) => void | Promise<unknown>,
) {
  const wrap = el(parent, "label", "", "ap-field");
  el(wrap, "span", label);
  const field = el(wrap, "select");
  for (const [key, title] of options) {
    const option = el(field, "option", title);
    option.value = key;
  }
  field.value = value;
  if (onChange)
    field.addEventListener("change", () => {
      Promise.resolve(onChange(field.value)).catch(
        (e) => new Notice(String(e)),
      );
    });
  return field;
}
function input(
  parent: HTMLElement,
  label: string,
  value: string,
  type = "text",
) {
  const wrap = el(parent, "label", "", "ap-field");
  el(wrap, "span", label);
  const field = el(wrap, "input");
  field.type = type;
  field.value = value;
  return field;
}
function checkbox(parent: HTMLElement, label: string, checked: boolean) {
  const wrap = el(parent, "label", "", "ap-check");
  const field = el(wrap, "input");
  field.type = "checkbox";
  field.checked = checked;
  el(wrap, "span", label);
  return field;
}
function empty(parent: HTMLElement, title: string, body: string) {
  const box = el(parent, "div", "", "ap-empty");
  el(box, "h3", title);
  el(box, "p", body);
  return box;
}
function table(parent: HTMLElement, headers: string[]) {
  const wrap = el(parent, "div", "", "ap-table-wrap");
  const t = el(wrap, "table");
  const tr = el(el(t, "thead"), "tr");
  headers.forEach((h) => el(tr, "th", h));
  return el(t, "tbody");
}
function link(parent: HTMLElement, title: string, url: string) {
  try {
    if (!["https:", "http:"].includes(new URL(url).protocol)) return;
    const a = el(parent, "a", title);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } catch {
    /* invalid links stay inert */
  }
}

export default class AlgoPatternsPlugin extends Plugin {
  store!: Store;
  ready!: Promise<void>;
  startupError = "";
  get db() {
    return this.store.db;
  }
  async onload() {
    this.store = new Store({
      read: async () => {
        const f = this.app.vault.getAbstractFileByPath(DATA);
        return f instanceof TFile ? this.app.vault.read(f) : null;
      },
      create: async (text) => {
        await this.folder(ROOT);
        await this.app.vault.create(DATA, text);
      },
      replace: async (expected, next) => {
        const file = this.app.vault.getAbstractFileByPath(DATA);
        if (!(file instanceof TFile))
          throw new Error(
            "Файл базы не найден. Перезагрузите базу через экран «Данные».",
          );
        await this.app.vault.process(file, (current) => {
          if (current !== expected)
            throw new Error(
              "База изменена извне. Ваши изменения не записаны. Нажмите «Перезагрузить базу» на экране «Данные».",
            );
          return next;
        });
      },
    });
    this.ready = new Promise<void>((resolve, reject) =>
      this.app.workspace.onLayoutReady(() => {
        this.store
          .load()
          .then(resolve)
          .catch((error) => {
            this.startupError = String(error);
            new Notice("Algo Patterns: " + this.startupError, 12000);
            reject(error);
          });
      }),
    );
    void this.ready.catch(() => {});
    this.registerView(VIEW, (leaf) => new TrainerView(leaf, this));
    this.addRibbonIcon("brain-circuit", "Algo Patterns", () => {
      void this.open();
    });
    this.addCommand({
      id: "open",
      name: "Открыть тренажёр",
      callback: () => {
        void this.open();
      },
    });
    this.addCommand({
      id: "import",
      name: "Импортировать каталог",
      callback: () => {
        void this.ready
          .then(() => new ImportModal(this).open())
          .catch(() => {});
      },
    });
    this.addCommand({
      id: "backup",
      name: "Создать резервную копию",
      callback: () => {
        void this.ready
          .then(() => this.backup())
          .catch((error) => new Notice(String(error)));
      },
    });
  }
  async folder(path: string) {
    let current = "";
    for (const part of normalizePath(path).split("/")) {
      current = current ? current + "/" + part : part;
      if (!this.app.vault.getAbstractFileByPath(current))
        await this.app.vault.createFolder(current);
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
  async change(action: (db: Database) => void) {
    await this.ready;
    await this.store.change(action);
    this.refresh();
  }
  async backup() {
    await this.ready;
    await this.folder(ROOT + "/Backups");
    const path =
      ROOT +
      "/Backups/tracker-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      uid().slice(0, 6) +
      ".json";
    await this.app.vault.create(path, JSON.stringify(this.db, null, 2));
    new Notice("Резервная копия: " + path);
    return path;
  }
  async start(item: QueueItem, manual = false) {
    await this.change((db) => {
      if (db.active)
        throw new Error("Сначала завершите или отмените текущую попытку.");
      db.active = {
        id: uid(),
        problemId: item.problemId,
        patternId: item.patternId,
        mode: item.mode,
        startedAt: new Date().toISOString(),
        runningSince: manual ? null : Date.now(),
        elapsedMs: 0,
        hinted: false,
        reason: item.reason,
      };
    });
    if (manual) new FinishModal(this, true).open();
  }
  async note(problemId: string) {
    const p = this.db.problems.find((p) => p.id === problemId)!;
    await this.folder(ROOT + "/Tasks");
    const safe = p.id.replace(/[^\p{L}\p{N}_-]/gu, "_");
    const path = ROOT + "/Tasks/" + safe + ".md";
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      const patterns = p.patternIds.map(
        (id) => this.db.patterns.find((t) => t.id === id)?.name ?? id,
      );
      file = await this.app.vault.create(
        path,
        `---\nalgo_id: ${JSON.stringify(p.id)}\ndifficulty: ${JSON.stringify(p.difficulty)}\npatterns: ${JSON.stringify(patterns)}\n---\n\n# ${p.title.replace(/[\r\n]/g, " ")}\n\n${p.url}\n\n## Идея и инвариант\n\n## Решение\n\n## Ошибки и крайние случаи\n`,
      );
    }
    if (file instanceof TFile)
      await this.app.workspace.getLeaf("tab").openFile(file);
  }
}

export class TrainerView extends ItemView {
  tab = "today";
  search = "";
  filterTopic = "";
  page = 0;
  skipped = new Set<string>();
  constructor(
    leaf: WorkspaceLeaf,
    public plugin: AlgoPatternsPlugin,
  ) {
    super(leaf);
  }
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
    this.contentEl.textContent = "Загрузка каталога…";
    this.registerInterval(window.setInterval(() => this.tick(), 1000));
    void this.plugin.ready.then(() => this.render()).catch(() => this.render());
  }
  async onClose() {
    this.contentEl.replaceChildren();
  }
  tick() {
    const active = this.plugin.db.active;
    const target = this.contentEl.querySelector("[data-timer]");
    if (active && target) {
      const seconds = Math.floor(elapsed(active) / 1000);
      target.textContent =
        String(Math.floor(seconds / 60)).padStart(2, "0") +
        ":" +
        String(seconds % 60).padStart(2, "0");
    }
  }
  render() {
    const root = this.contentEl;
    root.replaceChildren();
    if (this.plugin.startupError) {
      empty(
        root,
        "Не удалось открыть базу",
        this.plugin.startupError +
          " Файл не перезаписан. Проверьте Algo Patterns/tracker.json и резервные копии.",
      );
      return;
    }
    const header = el(root, "header", "", "ap-header");
    const title = el(header, "div");
    el(title, "div", "ALGO PATTERNS", "ap-eyebrow");
    el(title, "h2", "Практика, которая остаётся");
    el(
      title,
      "p",
      "Новые задачи · отложенные повторения · самостоятельные решения",
      "ap-muted",
    );
    button(header, "Импорт каталога", () =>
      new ImportModal(this.plugin).open(),
    );
    const nav = el(root, "nav", "", "ap-nav");
    nav.setAttribute("aria-label", "Разделы тренажёра");
    for (const [id, name] of [
      ["today", "Сегодня"],
      ["catalog", "Каталог"],
      ["progress", "Прогресс"],
      ["history", "История"],
      ["data", "Данные"],
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
    this.tick();
  }
  active(root: HTMLElement) {
    const a = this.plugin.db.active!;
    const p = this.plugin.db.problems.find((p) => p.id === a.problemId)!;
    const box = el(root, "section", "", "ap-active");
    const top = el(box, "div", "", "ap-between");
    el(
      top,
      "span",
      a.runningSince === null ? "ПОПЫТКА НА ПАУЗЕ" : "ТЕКУЩАЯ ПОПЫТКА",
      "ap-eyebrow",
    );
    const timer = el(top, "span", "", "ap-timer");
    timer.dataset.timer = "";
    timer.setAttribute("aria-label", "Активное время");
    el(box, "h3", p.title);
    el(box, "p", modeLabels[a.mode] + " · " + p.difficulty, "ap-muted");
    if (
      !this.plugin.db.settings.hidePattern ||
      a.reason === "Новая задача текущего раздела"
    )
      el(
        box,
        "p",
        this.plugin.db.patterns.find((p) => p.id === a.patternId)?.name ?? "",
      );
    if (a.mode === "recall")
      el(
        box,
        "p",
        "До просмотра заметок назовите подход, инвариант и сложность. Эта проверка не засчитывается как полное решение.",
      );
    const controls = el(box, "div", "", "ap-actions");
    if (p.url) link(controls, "Открыть LeetCode / условие ↗", p.url);
    button(controls, a.runningSince === null ? "Продолжить" : "Пауза", () =>
      this.plugin.change((db) => {
        if (!db.active) return;
        const current = db.active;
        current.elapsedMs = elapsed(current);
        current.runningSince =
          current.runningSince === null ? Date.now() : null;
      }),
    );
    const hint = button(
      controls,
      a.hinted ? "Подсказка учтена" : "Использовал подсказку",
      () =>
        this.plugin.change((db) => {
          if (db.active) db.active.hinted = true;
        }),
    );
    hint.disabled = a.hinted;
    button(
      controls,
      "Завершить",
      async () => {
        await this.plugin.change((db) => {
          if (db.active) {
            db.active.elapsedMs = elapsed(db.active);
            db.active.runningSince = null;
          }
        });
        new FinishModal(this.plugin).open();
      },
      true,
    );
    button(controls, "Отменить попытку", () =>
      new ConfirmModal(
        this.plugin,
        "Отменить текущую попытку?",
        "Таймер будет сброшен. История и расписание останутся прежними.",
        () =>
          this.plugin.change((db) => {
            db.active = null;
          }),
      ).open(),
    );
  }
  today(root: HTMLElement) {
    const db = this.plugin.db;
    if (!db.problems.length) {
      const box = empty(
        root,
        "Начните со своего каталога",
        "Загрузите CSV из Numbers или готовый каталог. Существующая история при повторном импорте сохраняется.",
      );
      button(
        box,
        "Загрузить каталог из вашего Numbers",
        () =>
          new ImportModal(this.plugin, JSON.stringify(starterCatalog)).open(),
        true,
      );
      return;
    }
    const settings = el(root, "div", "", "ap-settings");
    select(
      settings,
      "Текущая тема",
      [
        ["", "Выберите тему"],
        ...db.topics.map((t) => [t.id, t.name] as [string, string]),
      ],
      db.settings.topicId,
      (id) =>
        this.plugin.change((d) => {
          d.settings.topicId = id;
          d.settings.patternId = "";
          this.skipped.clear();
        }),
    );
    select(
      settings,
      "Паттерн",
      [
        ["", "Все паттерны темы"],
        ...db.patterns
          .filter((p) => p.topicId === db.settings.topicId)
          .map((p) => [p.id, p.name] as [string, string]),
      ],
      db.settings.patternId,
      (id) =>
        this.plugin.change((d) => {
          d.settings.patternId = id;
          this.skipped.clear();
        }),
    );
    const budget = input(
      settings,
      "Время на следующий план, мин",
      String(db.settings.budget),
      "number",
    );
    budget.min = "5";
    budget.max = "480";
    budget.step = "5";
    budget.addEventListener("change", () => {
      const v = Number(budget.value);
      if (!Number.isFinite(v) || v < 5 || v > 480) {
        new Notice("Укажите от 5 до 480 минут.");
        budget.value = String(db.settings.budget);
        return;
      }
      void this.plugin
        .change((d) => {
          d.settings.budget = v;
        })
        .catch((e) => new Notice(String(e)));
    });
    select(
      settings,
      "Доля времени на новые задачи",
      [
        ["40", "40%"],
        ["60", "60%"],
        ["80", "80%"],
      ],
      String(db.settings.newPercent),
      (value) =>
        this.plugin.change((d) => {
          d.settings.newPercent = Number(value);
        }),
    );
    const due = db.cards.filter(
      (c) =>
        c.mode === "solve" &&
        Date.parse(c.due) <= Date.now() &&
        !db.problems.find((p) => p.id === c.problemId)?.suspended,
    ).length;
    const queue = buildQueue(db).filter(
      (item) => !this.skipped.has(item.problemId),
    );
    const headline = el(root, "div", "", "ap-between");
    el(headline, "h3", "Следующие задачи");
    el(
      headline,
      "span",
      `${queue.length} задач · ≈ ${queue.reduce((sum, i) => sum + i.minutes, 0)} мин · ${due} полных повторений к сроку`,
      "ap-muted",
    );
    if (!queue.length)
      empty(
        root,
        "План свободен",
        "Нет подходящих задач в выбранном бюджете. Выберите другую тему, увеличьте время или начните задачу вручную из каталога.",
      );
    queue.forEach((item) => this.queueRow(root, item));
    if (this.skipped.size)
      button(root, "Вернуть пропущенные задачи в план", () => {
        this.skipped.clear();
        this.render();
      });
    el(
      root,
      "p",
      "После каждой попытки план пересчитывается для указанного бюджета. Он не является лимитом всей сессии. Пропуск не ухудшает результат; невыполненные повторения сохраняют срок.",
      "ap-footnote",
    );
  }
  queueRow(root: HTMLElement, item: QueueItem) {
    const db = this.plugin.db,
      p = db.problems.find((p) => p.id === item.problemId)!;
    const row = el(root, "article", "", "ap-task-row");
    const info = el(row, "div");
    const chips = el(info, "div", "", "ap-meta");
    el(
      chips,
      "span",
      item.kind === "new"
        ? "НОВАЯ"
        : item.kind === "transfer"
          ? "ПЕРЕНОС НАВЫКА"
          : "ПОВТОРЕНИЕ",
      "ap-tag",
    );
    el(
      chips,
      "span",
      `${p.difficulty} · ≈ ${item.minutes} мин · ${modeLabels[item.mode]}`,
      "ap-muted",
    );
    el(info, "h4", p.title);
    el(info, "p", item.reason, "ap-muted");
    if (!db.settings.hidePattern || item.kind === "new")
      el(
        info,
        "p",
        db.patterns.find((p) => p.id === item.patternId)?.name ?? "",
        "ap-muted",
      );
    const actions = el(row, "div", "", "ap-actions");
    const start = button(
      actions,
      "Начать",
      () => this.plugin.start(item),
      true,
    );
    start.disabled = !!db.active;
    button(actions, "Пропустить", () => {
      this.skipped.add(item.problemId);
      this.render();
    });
  }
  catalog(root: HTMLElement) {
    const db = this.plugin.db;
    const toolbar = el(root, "div", "", "ap-settings");
    const search = input(toolbar, "Поиск задачи / ID", this.search);
    select(
      toolbar,
      "Тема",
      [
        ["", "Все темы"],
        ...db.topics.map((t) => [t.id, t.name] as [string, string]),
      ],
      this.filterTopic,
      (value) => {
        this.filterTopic = value;
        this.page = 0;
        draw();
      },
    );
    button(toolbar, "Добавить задачу", () =>
      new ProblemModal(this.plugin).open(),
    );
    const target = el(root, "div");
    const draw = () => {
      target.replaceChildren();
      const filtered = db.problems.filter(
        (p) =>
          (p.title + " " + p.id)
            .toLowerCase()
            .includes(this.search.toLowerCase()) &&
          (!this.filterTopic ||
            p.patternIds.some(
              (id) =>
                db.patterns.find((t) => t.id === id)?.topicId ===
                this.filterTopic,
            )),
      );
      el(
        target,
        "p",
        `${db.topics.length} тем · ${db.patterns.length} паттернов · ${db.problems.length} уникальных задач. Найдено: ${filtered.length}.`,
        "ap-muted",
      );
      for (const p of filtered.slice(this.page * 30, this.page * 30 + 30)) {
        const row = el(target, "article", "", "ap-task-row");
        const info = el(row, "div");
        el(info, "h4", p.title);
        el(
          info,
          "p",
          `${p.id} · ${p.difficulty}${p.suspended ? " · исключена из очереди" : ""}`,
          "ap-muted",
        );
        const successes = db.attempts.filter(
          (a) =>
            a.problemId === p.id &&
            a.mode === "solve" &&
            a.outcome === "independent",
        );
        const attempts = db.attempts.filter(
          (a) => a.problemId === p.id && a.mode === "solve",
        );
        el(
          info,
          "p",
          attempts.length
            ? `Полных попыток: ${attempts.length} · самостоятельно: ${successes.length}`
            : "Ещё не решалась",
          "ap-muted",
        );
        const patternId =
          p.patternIds.find(
            (id) =>
              db.patterns.find((t) => t.id === id)?.topicId ===
              (this.filterTopic || db.settings.topicId),
          ) ?? p.patternIds[0];
        el(
          info,
          "p",
          p.patternIds
            .map((id) => db.patterns.find((t) => t.id === id)?.name ?? id)
            .join(" · "),
          "ap-patterns",
        );
        const actions = el(row, "div", "", "ap-actions");
        const item: QueueItem = {
          problemId: p.id,
          patternId,
          mode: "solve",
          kind: "new",
          minutes: 30,
          reason: "Выбрано вручную из каталога",
        };
        const start = button(actions, "Решать", () => this.plugin.start(item));
        start.disabled = !!db.active;
        const manual = button(actions, "Внести результат", () =>
          this.plugin.start(item, true),
        );
        manual.disabled = !!db.active;
        button(actions, "Заметка", () => this.plugin.note(p.id));
        button(actions, "Изменить", () =>
          new ProblemModal(this.plugin, p.id).open(),
        );
      }
      if (!filtered.length)
        empty(
          target,
          "Задачи не найдены",
          "Измените поиск или добавьте задачу.",
        );
      const pages = el(target, "div", "", "ap-actions");
      if (this.page > 0)
        button(pages, "← Назад", () => {
          this.page--;
          draw();
        });
      if ((this.page + 1) * 30 < filtered.length)
        button(pages, "Далее →", () => {
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
  progress(root: HTMLElement) {
    const db = this.plugin.db;
    const full = db.attempts.filter((a) => a.mode === "solve");
    const first = full.filter((a) => a.first);
    const repeats = full.filter((a) => !a.first);
    const independent = full.filter((a) => a.outcome === "independent");
    const metrics = el(root, "div", "", "ap-metrics");
    for (const [label, value, detail] of [
      [
        "Уникальных без помощи",
        String(new Set(independent.map((a) => a.problemId)).size),
        "Среди всех полных попыток",
      ],
      [
        "Первые попытки без помощи",
        percent(
          first.filter((a) => a.outcome === "independent").length,
          first.length,
        ),
        `${first.length} первых попыток`,
      ],
      [
        "Повторения без помощи",
        percent(
          repeats.filter((a) => a.outcome === "independent").length,
          repeats.length,
        ),
        `${repeats.length} повторных попыток`,
      ],
    ]) {
      const card = el(metrics, "div", "", "ap-stat");
      el(card, "p", label);
      el(card, "strong", value);
      el(card, "small", detail);
    }
    el(root, "h3", "Навыки по паттернам");
    const body = table(root, [
      "Паттерн",
      "Самостоятельно / задач",
      "Отложенные проверки",
      "Последняя практика",
    ]);
    for (const pattern of db.patterns) {
      const attempts = full.filter((a) => a.patternId === pattern.id);
      if (!attempts.length) continue;
      const total = db.problems.filter((p) =>
        p.patternIds.includes(pattern.id),
      ).length;
      const successful = new Set(
        attempts
          .filter((a) => a.outcome === "independent")
          .map((a) => a.problemId),
      ).size;
      const delayed = attempts
        .filter((a) => {
          const prior = attempts
            .filter((b) => b.problemId === a.problemId && b.at < a.at)
            .at(-1);
          return prior && Date.parse(a.at) - Date.parse(prior.at) >= 86400000;
        })
        .slice(-10);
      const tr = el(body, "tr");
      [
        pattern.name,
        `${successful} / ${total}`,
        `${percent(delayed.filter((a) => a.outcome === "independent").length, delayed.length)} · n=${delayed.length}`,
        date(attempts.at(-1)!.at),
      ].forEach((x) => el(tr, "td", x));
    }
    el(root, "h3", "Время самостоятельных решений");
    el(
      root,
      "p",
      "Медианы по паттерну, сложности и типу попытки. Первое и повторное решение не смешиваются; быстрые отказы и решения с помощью исключены.",
      "ap-muted",
    );
    const groups = new Map<
      string,
      { pattern: string; difficulty: string; kind: string; minutes: number[] }
    >();
    independent.forEach((a) => {
      const p = db.problems.find((p) => p.id === a.problemId)!;
      const key = a.patternId + "|" + p.difficulty + "|" + a.first;
      const group = groups.get(key) ?? {
        pattern: db.patterns.find((p) => p.id === a.patternId)?.name ?? "",
        difficulty: p.difficulty,
        kind: a.first ? "Первое решение" : "Повторение",
        minutes: [],
      };
      group.minutes.push(a.minutes);
      groups.set(key, group);
    });
    const times = table(root, [
      "Паттерн / сложность",
      "Попытка",
      "Медиана, мин",
      "n",
    ]);
    for (const group of groups.values()) {
      const tr = el(times, "tr");
      [
        group.pattern + " · " + group.difficulty,
        group.kind,
        n(median(group.minutes)),
        String(group.minutes.length),
      ].forEach((x) => el(tr, "td", x));
    }
    el(root, "h3", "Динамика по одной задаче");
    const practiced = db.problems.filter((p) =>
      full.some((a) => a.problemId === p.id),
    );
    if (!practiced.length) {
      empty(
        root,
        "Пока нет результатов",
        "Завершите первую попытку — здесь появятся показатели.",
      );
      return;
    }
    const chart = el(root, "div");
    const chooser = select(
      root,
      "Задача",
      practiced.map((p) => [p.id, p.title]),
      practiced[0].id,
      (id) => draw(id),
    );
    root.insertBefore(chooser.parentElement!, chart);
    const draw = (id: string) => {
      chart.replaceChildren();
      const attempts = full.filter((a) => a.problemId === id).slice(-12);
      const max = Math.max(...attempts.map((a) => a.minutes), 1);
      for (const a of attempts) {
        const row = el(chart, "div", "", "ap-bar-row");
        el(
          row,
          "span",
          `${new Date(a.at).toLocaleDateString("ru-RU")} · ${outcomeLabels[a.outcome]}`,
        );
        const track = el(row, "div", "", "ap-bar-track");
        const bar = el(track, "div", "", "ap-bar");
        bar.style.width = (a.minutes / max) * 100 + "%";
        bar.classList.toggle("is-assisted", a.outcome !== "independent");
        el(row, "span", n(a.minutes) + " мин");
      }
    };
    draw(practiced[0].id);
  }
  history(root: HTMLElement) {
    const db = this.plugin.db;
    el(root, "h3", "Журнал попыток");
    if (!db.attempts.length) {
      empty(
        root,
        "История пока пуста",
        "Здесь сохраняются все результаты, в том числе неудачные попытки.",
      );
      return;
    }
    for (const a of [...db.attempts].reverse().slice(0, 100)) {
      const row = el(root, "article", "", "ap-history");
      el(
        row,
        "h4",
        db.problems.find((p) => p.id === a.problemId)?.title ?? a.problemId,
      );
      el(
        row,
        "p",
        `${date(a.at)} · ${n(a.minutes)} мин · ${modeLabels[a.mode]} · ${outcomeLabels[a.outcome]}`,
      );
      el(
        row,
        "p",
        (db.patterns.find((p) => p.id === a.patternId)?.name ?? "") +
          (a.first ? " · первая полная попытка" : ""),
        "ap-muted",
      );
      if (a.note) el(row, "p", a.note);
    }
    if (db.attempts.length > 100)
      el(
        root,
        "p",
        "Показаны последние 100 попыток. Полная история сохранена в tracker.json.",
        "ap-muted",
      );
  }
  data(root: HTMLElement) {
    el(root, "h3", "Повторения и данные");
    const settings = el(root, "div", "", "ap-stack");
    const hide = checkbox(
      settings,
      "Скрывать паттерн при смешанной практике",
      this.plugin.db.settings.hidePattern,
    );
    hide.addEventListener("change", () => {
      void this.plugin
        .change((d) => {
          d.settings.hidePattern = hide.checked;
        })
        .catch((e) => new Notice(String(e)));
    });
    const recall = checkbox(
      settings,
      "Добавлять короткие проверки подхода (≈ 5 минут)",
      this.plugin.db.settings.includeRecall,
    );
    recall.addEventListener("change", () => {
      void this.plugin
        .change((d) => {
          d.settings.includeRecall = recall.checked;
        })
        .catch((e) => new Notice(String(e)));
    });
    el(
      root,
      "p",
      "Интервалы после самостоятельных решений: 1 → 3 → 7 → 14 → 30 → 60 → 90 дней. После подсказки, разбора или неудачи — 1 день. Расписания полных решений и коротких проверок независимы. Это простой алгоритм интервалов, не FSRS.",
    );
    el(
      root,
      "p",
      "Каталог, попытки и активный таймер: " +
        DATA +
        ". Заметки: " +
        ROOT +
        "/Tasks/. Файл базы хранится в vault и может синхронизироваться вместе с ним.",
      "ap-muted",
    );
    const actions = el(root, "div", "", "ap-actions");
    button(actions, "Создать резервную копию", () => this.plugin.backup());
    button(actions, "Восстановить резервную копию", () =>
      new RestoreModal(this.plugin).open(),
    );
    button(actions, "Перезагрузить базу", async () => {
      await this.plugin.store.reload();
      this.plugin.refresh();
      new Notice("База перечитана с диска.");
    });
    button(actions, "Импорт исходного каталога", () =>
      new ImportModal(this.plugin, JSON.stringify(starterCatalog)).open(),
    );
    el(
      root,
      "p",
      "LeetCode не синхронизируется автоматически. Записывайте результат всей попытки; использование помощи отмечается вручную. После закрытия Obsidian запущенный таймер продолжает учитывать время — при завершении его можно исправить.",
      "ap-footnote",
    );
  }
}

class ConfirmModal extends Modal {
  constructor(
    private plugin: AlgoPatternsPlugin,
    private title: string,
    private description: string,
    private action: () => Promise<unknown>,
  ) {
    super(plugin.app);
  }
  onOpen() {
    this.contentEl.classList.add("ap-modal");
    el(this.contentEl, "h2", this.title);
    el(this.contentEl, "p", this.description);
    const actions = el(this.contentEl, "div", "", "ap-actions");
    button(actions, "Отмена", () => this.close());
    button(
      actions,
      "Подтвердить",
      async () => {
        await this.action();
        this.close();
      },
      true,
    );
  }
}
export class FinishModal extends Modal {
  active: Active;
  constructor(
    private plugin: AlgoPatternsPlugin,
    private manual = false,
  ) {
    super(plugin.app);
    this.active = structuredClone(plugin.db.active!);
  }
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    const problem = this.plugin.db.problems.find(
      (p) => p.id === this.active.problemId,
    )!;
    el(root, "h2", "Результат попытки");
    el(root, "p", problem.title);
    const minutes = input(
      root,
      "Активное время, минут",
      String(
        this.manual
          ? 30
          : Math.max(0.01, Math.round(elapsed(this.active) / 600) / 100),
      ),
      "number",
    );
    minutes.min = "0.01";
    minutes.max = "1440";
    minutes.step = "0.01";
    const pattern = select(
      root,
      "Каким способом решали",
      problem.patternIds.map((id) => [
        id,
        this.plugin.db.patterns.find((p) => p.id === id)?.name ?? id,
      ]),
      this.active.patternId,
    );
    const result = select(
      root,
      "Результат",
      Object.entries(outcomeLabels) as [string, string][],
      this.active.hinted ? "hint" : "independent",
    );
    if (this.active.hinted) {
      const option = Array.from(result.options).find(
        (o) => o.value === "independent",
      );
      if (option) option.disabled = true;
      el(root, "p", "Использование подсказки уже отмечено.", "ap-muted");
    }
    const noteLabel = el(root, "label", "", "ap-field");
    el(noteLabel, "span", "Где застряли / что запомнить (необязательно)");
    const note = el(noteLabel, "textarea");
    note.rows = 3;
    note.placeholder = "Не узнал паттерн, ошибка границ, крайний случай…";
    const feedback = el(root, "p", "", "ap-feedback");
    feedback.setAttribute("role", "alert");
    const actions = el(root, "div", "", "ap-actions");
    button(actions, "Вернуться", () => this.close());
    button(
      actions,
      "Сохранить результат",
      async () => {
        try {
          const value = Number(minutes.value);
          await this.plugin.change((db) => {
            if (db.active?.id !== this.active.id)
              throw new Error(
                "Активная попытка изменилась. Откройте результат заново.",
              );
            if (db.active.hinted && result.value === "independent")
              throw new Error("Для этой попытки отмечена подсказка.");
            recordAttempt(db, {
              id: this.active.id,
              problemId: this.active.problemId,
              patternId: pattern.value,
              mode: this.active.mode,
              outcome: result.value as Outcome,
              minutes: value,
              at: new Date().toISOString(),
              note: note.value.trim(),
            });
          });
          this.close();
          new Notice("Попытка сохранена. Расписание обновлено.");
        } catch (error) {
          feedback.textContent = (error as Error).message;
        }
      },
      true,
    );
  }
}

export class ImportModal extends Modal {
  constructor(
    private plugin: AlgoPatternsPlugin,
    private initial = "",
  ) {
    super(plugin.app);
  }
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    el(root, "h2", "Импорт каталога");
    el(
      root,
      "p",
      "CSV: topic, pattern, title, id, url, difficulty. Поддерживается исходный формат Numbers: Pattern, Problems. JSON: topics, patterns, problems.",
    );
    const file = input(root, "Выбрать CSV или JSON", "", "file");
    file.accept = ".csv,.tsv,.json,text/csv,application/json";
    const source = el(root, "textarea");
    source.className = "ap-import-text";
    source.setAttribute("aria-label", "Данные каталога");
    source.rows = 7;
    source.placeholder = "Вставьте CSV или JSON";
    source.value = this.initial;
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (selected)
        void selected
          .text()
          .then((text) => {
            source.value = text;
            preview.replaceChildren();
          })
          .catch((e) => new Notice(String(e)));
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
          `${c.topics.length} тем · ${c.patterns.length} паттернов · ${c.problems.length} уникальных задач`,
          "ap-preview-count",
        );
        const existing = c.problems.filter((p) =>
          this.plugin.db.problems.some((old) => old.id === p.id),
        ).length;
        el(
          preview,
          "p",
          `${c.problems.length - existing} новых · ${existing} существующих. История и расписание сохранятся.`,
        );
        if (result.warnings.length) {
          const details = el(preview, "details");
          el(details, "summary", `Замечания: ${result.warnings.length}`);
          result.warnings.forEach((w) => el(details, "p", w));
        }
        const sample = el(preview, "ul");
        c.problems
          .slice(0, 5)
          .forEach((p) => el(sample, "li", p.title + " · " + p.difficulty));
        button(
          preview,
          "Импортировать",
          async () => {
            if (
              this.plugin.db.problems.length ||
              this.plugin.db.attempts.length
            )
              await this.plugin.backup();
            let summary = { added: 0, updated: 0 };
            await this.plugin.change((db) => {
              summary = mergeCatalog(db, result.catalog);
            });
            this.close();
            new Notice(
              `Добавлено: ${summary.added}. Обновлено: ${summary.updated}.`,
            );
          },
          true,
        );
      } catch (e) {
        el(preview, "p", (e as Error).message, "ap-error");
      }
    };
    source.addEventListener("input", () => preview.replaceChildren());
    button(root, "Проверить импорт", parse);
    if (this.initial) parse();
  }
}

class RestoreModal extends Modal {
  constructor(private plugin: AlgoPatternsPlugin) {
    super(plugin.app);
  }
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    el(root, "h2", "Восстановить базу");
    el(
      root,
      "p",
      "Выберите полную копию tracker.json. Перед заменой будет сохранена текущая база. Активный таймер из копии восстановится на паузе.",
    );
    const file = input(root, "Файл резервной копии", "", "file");
    file.accept = ".json";
    const preview = el(root, "div");
    file.addEventListener("change", () => {
      preview.replaceChildren();
      const selected = file.files?.[0];
      if (selected)
        void selected
          .text()
          .then((text) => {
            const backup = validateDatabase(JSON.parse(text));
            el(
              preview,
              "p",
              `${backup.problems.length} задач · ${backup.attempts.length} попыток`,
            );
            button(
              preview,
              "Создать копию текущей базы и восстановить",
              async () => {
                await this.plugin.backup();
                await this.plugin.change((db) => {
                  const restored = structuredClone(backup);
                  if (restored.active) restored.active.runningSince = null;
                  Object.assign(db, restored);
                });
                this.close();
                new Notice("База восстановлена.");
              },
              true,
            );
          })
          .catch((e) => el(preview, "p", (e as Error).message, "ap-error"));
    });
  }
}

export class ProblemModal extends Modal {
  constructor(
    private plugin: AlgoPatternsPlugin,
    private problemId?: string,
  ) {
    super(plugin.app);
  }
  onOpen() {
    const root = this.contentEl;
    root.classList.add("ap-modal");
    const db = this.plugin.db;
    const existing = db.problems.find((p) => p.id === this.problemId);
    const primary = existing
      ? db.patterns.find((p) => p.id === existing.patternIds[0])
      : undefined;
    el(root, "h2", existing ? "Изменить задачу" : "Добавить задачу");
    const title = input(root, "Название", existing?.title ?? "");
    const id = input(root, "ID LeetCode (или свой ID)", existing?.id ?? "");
    id.disabled = !!existing;
    const topic = input(
      root,
      "Тема",
      db.topics.find((t) => t.id === primary?.topicId)?.name ??
        db.topics.find((t) => t.id === db.settings.topicId)?.name ??
        "",
    );
    const pattern = input(root, "Паттерн", primary?.name ?? "");
    const url = input(root, "Ссылка", existing?.url ?? "", "url");
    const difficulty = select(
      root,
      "Сложность",
      ["Unknown", "Easy", "Medium", "Hard"].map((v) => [v, v]),
      existing?.difficulty ?? "Unknown",
    );
    const suspended = checkbox(
      root,
      "Исключить задачу из автоматической очереди",
      existing?.suspended ?? false,
    );
    const feedback = el(root, "p", "", "ap-feedback");
    feedback.setAttribute("role", "alert");
    el(
      root,
      "p",
      "При изменении темы или паттерна добавляется новая связь; старые связи и история сохраняются.",
      "ap-muted",
    );
    button(
      root,
      "Сохранить",
      async () => {
        try {
          if (
            !title.value.trim() ||
            !topic.value.trim() ||
            !pattern.value.trim()
          )
            throw new Error("Заполните название, тему и паттерн.");
          if (url.value && !/^https?:\/\//i.test(url.value))
            throw new Error("Ссылка должна начинаться с https:// или http://.");
          const escaped = (v: string) => '"' + v.replace(/"/g, '""') + '"';
          const csv =
            "topic,pattern,title,id,url,difficulty\n" +
            [
              topic.value.trim(),
              pattern.value.trim(),
              title.value.trim(),
              id.value.trim() || uid(),
              url.value.trim(),
              difficulty.value,
            ]
              .map(escaped)
              .join(",");
          const incoming = parseImport(csv);
          if (incoming.warnings.length)
            throw new Error(incoming.warnings.join("\n"));
          await this.plugin.change((d) => {
            mergeCatalog(d, incoming.catalog);
            const p = d.problems.find(
              (p) => p.id === incoming.catalog.problems[0].id,
            )!;
            p.suspended = suspended.checked;
          });
          this.close();
        } catch (e) {
          feedback.textContent = (e as Error).message;
        }
      },
      true,
    );
  }
}
