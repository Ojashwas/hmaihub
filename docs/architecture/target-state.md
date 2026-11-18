# Target state

```mermaid
flowchart LR
  subgraph Clients
    Web[apps/web React+Vite]
    Desk[apps/desktop Tauri 2]
    Shell[HyperWorkspace shell]
  end
  subgraph Engines[crates/* Rust + WASM]
    Pkg[office-package] --> Xml[office-xml] --> Model[office-model]
    Model --> Word[word-engine] & Sheet[spreadsheet-engine + formula-engine] & Deck[presentation-engine] & Plan[project-engine + scheduling-engine]
    Model --> Render[office-renderer]
    Model --> Conv[office-conversion graph]
  end
  subgraph Services
    GW[api-gateway] --> Files & ConvSvc[conversion workers sandboxed] & Collab[collaboration] & AI[ai-orchestrator]
    Lic[licensing - separate deployment]
  end
  Web & Desk --> Shell --> Engines
  Shell --> GW
  Shell -. one-time activation/renewal .-> Lic
  Shell --> Ent[entitlement-sdk] --> LC[licensing-client]
```

## Layering of every document format

1. **Package layer**: ZIP/OLE, content types, relationships, unknown-part preservation, signatures, encryption envelope.
2. **Semantic model**: stable IDs, validation, change tracking.
3. **View/edit model**: selections, commands, undo/redo, layout cache, virtualisation, collaboration ops, accessibility tree.

## Cross-cutting

- Capability manifests are the only source of support claims (L0–L6).
- Every compatibility claim above L4 requires an REA investigation and reviewed report.
- Entitlements are enforced in UI, application services, server APIs, workers, and the extension host.
- Hostile-input limits are centrally configured ([file-processing.md](../security/file-processing.md)).
- Telemetry excludes document content by default.

The full target directory layout is the one in the master engineering brief;
modules are created only when they have a manifest, README, public API, tests,
owner, and status.
