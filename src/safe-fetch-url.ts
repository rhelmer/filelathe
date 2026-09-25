/**
 * SSRF guards for server-side URL fetches: public hosts only, no credentials,
 * DNS-resolved addresses checked before connect / each redirect hop.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
]);

/** Hostnames that resolve to cloud metadata / link-local tooling. */
const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal"];

export class FetchResourceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "FetchResourceError";
    this.status = status;
  }
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

function ipv4ToInt(address: string): number {
  const parts = address.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new FetchResourceError("Invalid remote URL.");
  }
  return (
    ((parts[0]! << 24) >>> 0) +
    ((parts[1]! << 16) >>> 0) +
    ((parts[2]! << 8) >>> 0) +
    (parts[3]! >>> 0)
  ) >>> 0;
}

function inCidr(ip: number, base: string, prefix: number): boolean {
  const baseInt = ipv4ToInt(base);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ip & mask) === (baseInt & mask);
}

function isPublicIpv4(address: string): boolean {
  let ip: number;
  try {
    ip = ipv4ToInt(address);
  } catch {
    return false;
  }

  // This / reserved / private / link-local / CGNAT / documentation / multicast
  const blocked: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  for (const [base, prefix] of blocked) {
    if (inCidr(ip, base, prefix)) return false;
  }
  // Broadcast
  if (ip === 0xffffffff) return false;
  return true;
}

function expandIpv6(address: string): string {
  // Normalize IPv4-mapped and compressed forms via URL / whatwg — use net.isIP path.
  // Manual expand for hextet checks.
  let addr = address.toLowerCase();
  if (addr.startsWith("::ffff:")) {
    const mapped = addr.slice(7);
    if (isIP(mapped) === 4) {
      const parts = mapped.split(".").map(Number);
      const hi = ((parts[0]! << 8) | parts[1]!).toString(16);
      const lo = ((parts[2]! << 8) | parts[3]!).toString(16);
      addr = `0:0:0:0:0:ffff:${hi}:${lo}`;
    }
  }

  const [left, right = ""] = addr.split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const missing = 8 - leftParts.length - rightParts.length;
  const filled = [
    ...leftParts,
    ...Array.from({ length: Math.max(0, missing) }, () => "0"),
    ...rightParts,
  ];
  while (filled.length < 8) filled.push("0");
  return filled
    .slice(0, 8)
    .map((h) => h.padStart(4, "0"))
    .join(":");
}

function isPublicIpv6(address: string): boolean {
  // Dotted IPv4-mapped form: ::ffff:127.0.0.1
  if (address.toLowerCase().includes(".")) {
    const m = /:ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (m) return isPublicIpv4(m[1]!);
  }

  let expanded: string;
  try {
    expanded = expandIpv6(address);
  } catch {
    return false;
  }
  const hextets = expanded.split(":").map((h) => parseInt(h, 16));
  if (hextets.length !== 8 || hextets.some((n) => Number.isNaN(n))) return false;

  // :: / unspecified
  if (hextets.every((h) => h === 0)) return false;
  // ::1 loopback
  if (
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0 &&
    hextets[6] === 0 &&
    hextets[7] === 1
  ) {
    return false;
  }
  // IPv4-mapped ::ffff:0:0/96
  if (
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0xffff
  ) {
    const a = (hextets[6]! >> 8) & 0xff;
    const b = hextets[6]! & 0xff;
    const c = (hextets[7]! >> 8) & 0xff;
    const d = hextets[7]! & 0xff;
    return isPublicIpv4(`${a}.${b}.${c}.${d}`);
  }
  // Unique local fc00::/7
  if ((hextets[0]! & 0xfe00) === 0xfc00) return false;
  // Link-local fe80::/10
  if ((hextets[0]! & 0xffc0) === 0xfe80) return false;
  // Multicast ff00::/8
  if ((hextets[0]! & 0xff00) === 0xff00) return false;

  return true;
}

function hostnameFromUrl(url: URL): string {
  // Strip brackets from IPv6 literals.
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname) return true;
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * Parse + validate that a URL is http(s), credential-free, and resolves only
 * to public addresses. Returns the normalized URL.
 */
export async function assertSafeFetchUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (cause) {
    throw new FetchResourceError("Invalid remote URL.", 400, { cause });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchResourceError("Only http(s) URLs are supported.");
  }
  if (url.username || url.password) {
    throw new FetchResourceError("URLs with credentials are not allowed.");
  }
  // Block weird ports commonly used for internal services? Allow standard +
  // common public ports; still OK to hit 8080 on a public host. Port alone
  // is not an SSRF signal once the IP is public.

  const hostname = hostnameFromUrl(url);
  if (isBlockedHostname(hostname)) {
    throw new FetchResourceError("That host is not allowed.");
  }

  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (!isPublicIp(hostname)) {
      throw new FetchResourceError("That address is not allowed.");
    }
    return url;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch (cause) {
    throw new FetchResourceError("Could not resolve host.", 400, { cause });
  }
  if (!records.length) {
    throw new FetchResourceError("Could not resolve host.");
  }
  for (const record of records) {
    if (!isPublicIp(record.address)) {
      throw new FetchResourceError("That host is not allowed.");
    }
  }
  return url;
}
