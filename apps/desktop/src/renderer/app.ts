import { api, enableTestHooks, mountShell } from "@hyperoffice/app-shell";
import { mountDeck } from "@hyperoffice/hyperdeck";
import { mountDoc } from "@hyperoffice/hyperdoc";
import { mountLauncher } from "@hyperoffice/hyperoffice";
import { mountPlan } from "@hyperoffice/hyperplan";
import { mountSheet } from "@hyperoffice/hypersheet";

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
