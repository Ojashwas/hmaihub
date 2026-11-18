import { createHash } from "node:crypto";

/**
 * Allowlisted stable signals. MAC addresses, document paths, network scans,
 * location, contacts, and browsing data are deliberately not supported.
 */
export const DEVICE_SIGNAL_WEIGHTS = {
  machine_id: 4,
  os_install_id: 3,
  system_volume_id: 2,
  board_serial: 2,
  cpu_model: 1,
  os_family: 1
} as const;
export type DeviceSignalName = keyof typeof DEVICE_SIGNAL_WEIGHTS;
export type DeviceSignals = Partial<Record<DeviceSignalName, string>>;
export type SignalHashes = Partial<Record<DeviceSignalName, string>>;

export const DEFAULT_MATCH_THRESHOLD = 0.6;

const normalize = (value: string) => value.trim().toLowerCase();

function lengthPrefixed(parts: string[]): Buffer {
  return Buffer.concat(
    parts.flatMap((p) => {
      const bytes = Buffer.from(p, "utf8");
      const len = Buffer.alloc(4);
      len.writeUInt32BE(bytes.length);
      return [len, bytes];
    })
  );
}

function validated(signals: DeviceSignals): [DeviceSignalName, string][] {
  const entries = Object.entries(signals) as [string, string | undefined][];
  const out: [DeviceSignalName, string][] = [];
  for (const [name, value] of entries) {
    if (!(name in DEVICE_SIGNAL_WEIGHTS)) throw new Error(`Device signal "${name}" is not on the allowlist`);
    if (typeof value === "string" && normalize(value).length > 0)
      out.push([name as DeviceSignalName, normalize(value)]);
  }
  if (out.length < 2) throw new Error("At least two stable device signals are required");
  return out.sort(([a], [b]) => a.localeCompare(b));
}

/** device_fingerprint = SHA-256(product_salt || normalized stable signals), length-prefixed. */
export function computeDeviceFingerprint(productSalt: string, signals: DeviceSignals): string {
  const parts = [productSalt, ...validated(signals).flatMap(([n, v]) => [n, v])];
  return `sha256:${createHash("sha256").update(lengthPrefixed(parts)).digest("base64url")}`;
}

/** Per-signal hashes kept in local secure storage so later launches can tolerate hardware changes. */
export function computeSignalHashes(productSalt: string, signals: DeviceSignals): SignalHashes {
  const out: SignalHashes = {};
  for (const [name, value] of validated(signals)) {
    out[name] = createHash("sha256")
      .update(lengthPrefixed([productSalt, name, value]))
      .digest("base64url");
  }
  return out;
}

export interface DeviceMatch {
  score: number;
  matched: boolean;
}

/** Weighted match: replacing a disk or network adapter still passes; a different machine does not. */
export function matchDevice(
  recorded: SignalHashes,
  current: SignalHashes,
  threshold = DEFAULT_MATCH_THRESHOLD
): DeviceMatch {
  let total = 0;
  let matched = 0;
  for (const name of Object.keys(recorded) as DeviceSignalName[]) {
    const weight = DEVICE_SIGNAL_WEIGHTS[name];
    total += weight;
    if (current[name] !== undefined && current[name] === recorded[name]) matched += weight;
  }
  const score = total === 0 ? 0 : matched / total;
  return { score, matched: score >= threshold };
}
