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
export class Plugin {}
export class TFile {
  constructor(public path: string) {}
}
export class WorkspaceLeaf {}
export const normalizePath = (path: string) => path;
