# End-User Guide

> **Release status:** HyperOffice has not been released. No application can be
> downloaded or installed yet. This guide describes how licensing will behave
> for customers. That behaviour is implemented and tested in the licensing
> libraries; the screens that present it are **Planned** and wording may change.

## 1. What you buy

HyperOffice is sold as the full suite or as individual products — HyperDoc
(documents), HyperSheet (spreadsheets), HyperDeck (presentations), HyperPlan
(projects), HyperAI — plus optional feature packs.

A standard purchase gives you **six calendar months** of use from the moment you
activate (unless your contract states a different start date).

## 2. Your activation code

You receive a code like:

```
HO1-7K4M-9NQ2-XDRC-P6VT-3JWA-BCDE-FGH2
```

- Letters and digits that look alike (O/0, I/1/L, U) are never used.
- Upper or lower case and spaces are accepted.
- The last character is a check character: most typing mistakes are caught
  immediately on your device, before anything is sent.
- Keep the code private. HyperOffice cannot show it to you again.

## 3. Activating (one time, online)

1. Connect to the internet.
2. Open HyperOffice and choose **Activate** (Planned screen).
3. Enter the code.
4. HyperOffice sends the code, a random installation identifier, and a privacy-
   preserving device fingerprint (see §8). It receives a digitally signed licence.

After activation **you can work offline**. HyperOffice checks the licence on
your device; it does not contact the server when you use features.

If activation fails, you see a general message and a support reference
(`HSR-…`). For security reasons the message does not say whether the code is
unknown, already used, or expired — give the support reference to support.
Too many attempts temporarily pause activation; wait and try again.

## 4. Installations

Your licence allows a fixed number of installations (shown in your order).
Re-installing on the same computer reuses its slot. Ordinary hardware changes
(new disk, network card, memory, operating-system update) should not require
re-activation. Moving to a different computer requires deactivation of the old
one (Planned self-service) or help from support.

## 5. When your licence expires

| Period | Edit and premium features | Open, read, copy, export your files |
| --- | --- | --- |
| Licence active | Available | Available |
| 14-day grace period after expiry | Available, with a reminder | Available |
| After grace period | Paused | **Always available** |

HyperOffice **never** deletes, encrypts, corrupts, watermarks, or withholds
your files because a licence expired. You can always open your documents and
export them to an open format.

Expiry is calculated in calendar months in UTC. If you activate on the 31st,
the licence ends on the last day of the sixth month (for example 31 August →
28 or 29 February).

## 6. Renewing

1. Buy a **Renewal Code**.
2. Choose **Renew** (Planned screen), enter the code; a one-time connection is needed.
3. Renewing early does **not** lose remaining time: the new period starts when
   the current one ends. Renewing after expiry starts the new period on the day you renew.

**Feature Codes** add a feature pack, seats, or installations without changing
your expiry date (unless the pack says otherwise).

An **Extension Package** is different: it installs add-on software and is not a
licence code.

HyperOffice never renews automatically or charges you without explicit consent.

## 7. Messages you may see

| Licence status | What it means | What to do |
| --- | --- | --- |
| Active | Everything you bought is available | — |
| Grace period | Licence ended; temporary access continues | Renew |
| Expired | Editing paused; your files remain available | Renew |
| Not yet valid | Your contract start date is in the future | Wait, or contact your administrator |
| Not included in your licence | Feature/product not purchased | Buy a Feature Code or upgrade |
| Licence belongs to a different installation | Licence copied from another device, or device changed significantly | Re-activate or contact support |
| Clock problem detected | Your computer's date is earlier than a previously verified time | Correct the date; choose **Verify time online** |
| Licence cannot be verified | Licence file damaged or not issued by HyperOffice | Re-activate or contact support |
| Licence format not supported | Licence newer than this app version | Update HyperOffice |
| Licensing unavailable | The licence store could not be read | Restart; contact support if it persists |

In every case above you can still open and export your files.

## 8. Privacy

Collected for licensing: the activation code (stored only as a one-way hash),
a random installation ID, a salted one-way fingerprint derived from a few stable
system identifiers, app version, and platform.

Never collected for licensing: your documents or their names, file paths,
browsing history, contacts, Wi-Fi networks, location, or network (MAC) addresses.

Full data map: [licensing/privacy.md](licensing/privacy.md). An Arabic version of
customer-facing licensing information will be provided for the UAE before sale.

## 9. Getting help

Have ready: your support reference (`HSR-…`) if shown, your order number, and
the licence diagnostics export (Planned menu item). The diagnostics contain your
licence status, licence ID, expiry, and products — not your documents, device
fingerprint, or activation code.
