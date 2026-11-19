import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hyperoffice", {
  info: () => ipcRenderer.invoke("ho:info"),
  open: () => ipcRenderer.invoke("ho:open"),
  save: (model: unknown, saveAs: boolean) => ipcRenderer.invoke("ho:save", model, saveAs),
  openProduct: (product: string) => ipcRenderer.invoke("ho:new-window", product),
  setDirty: (dirty: boolean) => ipcRenderer.send("ho:dirty", dirty),
  ready: () => ipcRenderer.send("ho:ready"),
  onMenu: (callback: (command: string) => void) => {
    ipcRenderer.on("ho:menu", (_event, command: string) => callback(command));
  },
  onOpened: (callback: (result: unknown) => void) => {
    ipcRenderer.on("ho:opened", (_event, result: unknown) => callback(result));
  }
});
