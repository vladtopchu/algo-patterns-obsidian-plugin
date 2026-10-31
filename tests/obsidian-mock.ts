export const notices: string[] = [];
export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}
export class Modal {
  contentEl = document.createElement("div");
  constructor(public app: unknown) {}
  open() {
    document.body.append(this.contentEl);
    (this as any).onOpen?.();
  }
  close() {
    this.contentEl.remove();
  }
}
export class ItemView {
  contentEl = document.createElement("div");
  constructor(public leaf: unknown) {}
  registerInterval() {}
}
export class Plugin {
  savedData: any = null;
  settingTabs: any[] = [];
  constructor(public app: any) {}
  async loadData() {
    return this.savedData;
  }
  async saveData(data: any) {
    this.savedData = structuredClone(data);
  }
  addSettingTab(tab: any) {
    this.settingTabs.push(tab);
  }
  registerView() {}
  addRibbonIcon() {}
  addCommand() {}
}
export class PluginSettingTab {
  containerEl = document.createElement("div");
  constructor(
    public app: any,
    public plugin: any,
  ) {}
}
export class Setting {
  row: HTMLElement;
  constructor(public containerEl: HTMLElement) {
    this.row = document.createElement("div");
    containerEl.append(this.row);
  }
  setName(name: string) {
    this.row.dataset.name = name;
    const label = document.createElement("span");
    label.textContent = name;
    this.row.append(label);
    return this;
  }
  setDesc(description: string) {
    const text = document.createElement("p");
    text.textContent = description;
    this.row.append(text);
    return this;
  }
  addText(configure: any) {
    const field = document.createElement("input");
    field.type = "text";
    this.row.append(field);
    const component = {
      setValue(value: string) {
        field.value = value;
        return component;
      },
      setPlaceholder(value: string) {
        field.placeholder = value;
        return component;
      },
      onChange(callback: any) {
        field.addEventListener("input", () => callback(field.value));
        return component;
      },
    };
    configure(component);
    return this;
  }
  addButton(configure: any) {
    const button = document.createElement("button");
    this.row.append(button);
    const component = {
      setButtonText(value: string) {
        button.textContent = value;
        return component;
      },
      setDisabled(value: boolean) {
        button.disabled = value;
        return component;
      },
      onClick(callback: any) {
        button.addEventListener("click", callback);
        return component;
      },
    };
    configure(component);
    return this;
  }
  addDropdown(configure: any) {
    const field = document.createElement("select");
    this.row.append(field);
    const component = {
      addOptions(options: Record<string, string>) {
        for (const [value, label] of Object.entries(options)) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          field.append(option);
        }
        return component;
      },
      setValue(value: string) {
        field.value = value;
        return component;
      },
      onChange(callback: any) {
        field.addEventListener("change", () => callback(field.value));
        return component;
      },
    };
    configure(component);
    return this;
  }
  addToggle(configure: any) {
    const field = document.createElement("input");
    field.type = "checkbox";
    this.row.append(field);
    const component = {
      setValue(value: boolean) {
        field.checked = value;
        return component;
      },
      onChange(callback: any) {
        field.addEventListener("change", () => callback(field.checked));
        return component;
      },
    };
    configure(component);
    return this;
  }
}
export class TFile {
  constructor(public path: string) {}
}
export class TFolder {
  constructor(public path: string) {}
}
export class WorkspaceLeaf {}
export const normalizePath = (path: string) => path;
