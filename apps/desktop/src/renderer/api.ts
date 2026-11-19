import type { AnyModel } from "@hyperoffice/office-formats/models";
import type { EditorId, ProductId } from "../shared/products.ts";

export interface OpenResult {
  name: string;
  model: AnyModel;
  warnings: string[];
}

export interface AppInfo {
  product: ProductId;
  appProduct: ProductId;
  version: string;
  editors: EditorId[];
  smoke: boolean;
}

export interface HyperOfficeApi {
  info(): Promise<AppInfo>;
  open(): Promise<OpenResult | null>;
  save(model: AnyModel, saveAs: boolean): Promise<{ name: string } | null>;
  openProduct(product: EditorId): Promise<void>;
  setDirty(dirty: boolean): void;
  ready(): void;
  onMenu(callback: (command: string) => void): void;
  onOpened(callback: (result: OpenResult) => void): void;
}

declare global {
  interface Window {
    hyperoffice: HyperOfficeApi;
  }
}

export const api = (): HyperOfficeApi => window.hyperoffice;
