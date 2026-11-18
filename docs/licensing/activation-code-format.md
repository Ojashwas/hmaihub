# Activation code format (HO1)

```
HO1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
     └──────── 27 random symbols ───────┘└ check symbol (last character)
```

| Property | Value |
| --- | --- |
| Prefix | `HO1` (format version 1) |
| Alphabet | `23456789ABCDEFGHJKMNPQRSTVWXYZ` (30 symbols; excludes `0 1 I L O U`) |
| Random symbols | 27 → 27 × log2(30) ≈ **132.5 bits** of entropy |
| Check symbol | Luhn mod 30 over the 27 symbols; transcription detection only, not security |
| Grouping | 7 groups of 4 after the prefix |

The example in the brief (`HO1-7K4M9-NQ2XD-8RCP6-VT3JW`, 20 symbols ≈ 98 bits)
does not meet the 128-bit requirement, so the format uses 28 symbols.

## Generation (server only)

1. Read 32 bytes from the OS CSPRNG (`crypto.randomBytes`).
2. Accept a byte `b` only if `b < 240` (largest multiple of 30 ≤ 256); map `b mod 30`.
   Rejected bytes are discarded (no modulo bias). Repeat until 27 symbols.
3. Append the Luhn mod 30 check symbol, add `HO1`, group.
4. Store `code_hash = HMAC-SHA-256(pepper, normalized_code)` and metadata only.
5. Return the plaintext to the authorised caller once.

Codes are never derived from customer data, order IDs, timestamps, serials, MAC
addresses, or sequential IDs. Clients contain normalisation and check-symbol
validation only; they cannot generate commercial codes.

## Normalisation

Uppercase; remove spaces and hyphens; require `HO1` + 28 alphabet symbols;
verify the check symbol; re-group. Ambiguous characters (`O`, `0`, `I`, `1`, `L`,
`U`) are rejected, not guessed.

## Statuses

`GENERATED → ASSIGNED → REDEEMED`, plus `SUSPENDED`, `REVOKED`, `EXPIRED`, `REPLACED`.
Activation codes may serve up to `max_installations` installations; renewal
and feature codes are single-use.

## Implementation

- Format: [packages/licensing-core/src/activation-code.ts](../../packages/licensing-core/src/activation-code.ts)
- Generator: [services/licensing/src/domain/activation-code.ts](../../services/licensing/src/domain/activation-code.ts)
- Tests: single-substitution detection (property), transposition detection rate,
  rejection sampling, uniformity, uniqueness.
