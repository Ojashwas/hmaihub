# ADR-0003: Rust core engines deferred until the toolchain is provisioned

Status: Accepted

## Context

The target architecture places package, XML, and document engines in Rust crates
(`crates/*`) with WebAssembly bindings. At the start of Phase 0 the development
machine had no `cargo` or `rustc`, so Rust code could not be compiled or tested.

## Decision

- No Rust crates are committed until they can be built and tested. Uncompiled
  code would be an unverified claim.
- Phase 0 format detection is implemented in TypeScript
  (`tools/format-detector`) with the parser limits the Rust `office-package`
  crate must later honour. Its test suite becomes the behavioural specification
  for the Rust port.
- Provisioning Rust stable (rustup) plus `cargo-nextest`, `cargo-deny`, and
  `cargo-audit` is the first backlog item of Phase 1.

## Consequences

- Acceptance items `cargo build --workspace` and `cargo test --workspace` are
  **not met**.
- The TypeScript detector may be retired or kept as a CLI once the WASM build exists.
