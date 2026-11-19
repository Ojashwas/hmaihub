import { api } from "./api.ts";
import { mountDeck } from "./deck.ts";
import { mountDoc } from "./doc.ts";
import { mountLauncher } from "./launcher.ts";
import { mountPlan } from "./plan.ts";
import { mountSheet } from "./sheet.ts";
import { enableTestHooks, mountShell } from "./shell.ts";

async function start() {
  const info = await api().info();
  if (info.smoke) enableTestHooks();
  const shell = mountShell(info.product);
  switch (info.product) {
    case "suite":
      mountLauncher(shell, info);
      break;
    case "hyperdoc":
      mountDoc(shell);
      break;
    case "hypersheet":
      mountSheet(shell);
      break;
    case "hyperdeck":
      mountDeck(shell);
      break;
    case "hyperplan":
      mountPlan(shell);
      break;
  }
  api().ready();
}

start().catch((err: unknown) => {
  console.error(err);
  document.body.textContent = `HyperOffice failed to start: ${String(err)}`;
});
