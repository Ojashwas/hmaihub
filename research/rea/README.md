# REA investigations

Every Office compatibility feature needs an investigation record here before
its manifest may move above L4. No investigations exist yet: they require an
authorised reference environment (licensed Microsoft Office) and a named
human approver, neither of which is available in this iteration.

## Workflow

1. Define a narrow behavioural question.
2. Create a minimal baseline file.
3. Make exactly one controlled change in the reference application.
4. Capture observable behaviour.
5. Compare parts, XML, relationships, metadata, and rendered output.
6. Separate observations from assumptions.
7. Reference public standards ([docs/standards](../../docs/standards/README.md)).
8. Write the evidence report.
9. Implement from evidence + public specification (clean-room: researchers and implementers are separate).
10. Run round-trip and interoperability tests.
11. Obtain human approval before changing the compatibility claim.

## Layout

```
research/rea/investigations/<product>/<feature-id>/
├── hypothesis.md               question and expected outcome
├── authorization.md            who authorised it, scope, licences of software used
├── environment.json            OS, Office build, REA version, tools
├── steps.md                    exact reproducible steps
├── baseline/  modified/        the two files (sanitised)
├── captures/  normalized/  diffs/  evidence/
├── observations.md             facts only
├── specification-references.md
├── implementation-notes.md
├── limitations.md
├── test-plan.md                links to the automated tests
└── expected-behavior.json      machine-readable expectations consumed by tests
```

Feature IDs: `HDOC-TABLE-001`, `HSHEET-FORMULA-001`, `HDECK-MASTER-001`, `HPLAN-DEPENDENCY-001`.

## Prohibited

Bypassing licensing or activation, circumventing access controls, extracting
credentials/keys/protected data, defeating DRM or encryption, copying
proprietary code, publishing confidential binary details, using leaked
documentation, or presenting observed behaviour as an official specification.
Stop and document any activity that is legally or ethically questionable.
