# ADR-0005: Backend framework default

Status: Proposed

## Options

1. TypeScript + NestJS: shares types and the licensing/entitlement packages with
   clients, large ecosystem, decorators require a build step (not erasable syntax).
2. Rust + Axum: shares the document engines natively, strong isolation for
   conversion workers, requires the Rust toolchain (ADR-0003).
3. TypeScript + Fastify: lighter than NestJS, erasable TypeScript, schema-first
   validation with the existing JSON Schemas.

## Current leaning

Fastify (TypeScript) for the licensing and control-plane services; Rust/Axum
for conversion and rendering workers. To be decided before Phase L2's HTTP adapter.
