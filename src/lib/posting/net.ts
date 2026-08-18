/**
 * The address ranges a fetch chosen by a stranger must never reach.
 *
 * This is the load-bearing security control of the whole feature. A signed-in
 * user hands us a URL and we make our own server request to it: without this
 * check, `http://169.254.169.254/latest/meta-data/` turns Docket into a proxy
 * into the platform's own network, and `http://127.0.0.1:5432` into a port
 * scanner. The list below is deliberately wider than "the RFC 1918 blocks" —
 * link-local, CGNAT, benchmarking and reserved space are all unreachable by any
 * legitimate job advert.
 *
 * Pure string in, boolean out, so the rule is testable without a socket.
 */

/** [first address, prefix length] over the 32-bit space. */
const V4_BLOCKED: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local — cloud metadata lives here
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, includes 255.255.255.255
];

function toV4Int(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function isBlockedV4(ip: string): boolean {
  const value = toV4Int(ip);
  if (value === null) return true; // unparseable is not a licence to connect
  return V4_BLOCKED.some(([base, bits]) => {
    const start = toV4Int(base);
    if (start === null) return false;
    const size = 2 ** (32 - bits);
    return value >= start && value < start + size;
  });
}

/** Expands "::1" and "fe80::a" into eight 16-bit groups. */
function expandV6(ip: string): number[] | null {
  const bare = ip.replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (!bare) return null;

  // An IPv4 tail ("::ffff:127.0.0.1") becomes two 16-bit groups.
  let head = bare;
  const tail = bare.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (tail?.[1]) {
    const v4 = toV4Int(tail[1]);
    if (v4 === null) return null;
    head = `${bare.slice(0, bare.length - tail[1].length)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = head.split("::");
  if (halves.length > 2) return null;
  const left = (halves[0] ?? "").split(":").filter(Boolean);
  const right = halves.length === 2 ? (halves[1] ?? "").split(":").filter(Boolean) : [];

  const groups =
    halves.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left;
  if (groups.length !== 8) return null;

  const out: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    out.push(parseInt(group, 16));
  }
  return out;
}

function isBlockedV6(ip: string): boolean {
  const groups = expandV6(ip);
  if (!groups) return true;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;

  // Unspecified (::) and loopback (::1).
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0) {
    return g7 === 0 || g7 === 1;
  }
  // IPv4-mapped (::ffff:0:0/96) and NAT64 (64:ff9b::/96): judge the v4 inside.
  const mapped = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff;
  const nat64 = g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0;
  if (mapped || nat64) {
    const v4 = [(g6 >> 8) & 0xff, g6 & 0xff, (g7 >> 8) & 0xff, g7 & 0xff].join(".");
    return isBlockedV4(v4);
  }
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7  unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8  multicast
  if (g0 === 0x2002) return true; // 6to4 — a tunnel into anywhere
  return false;
}

/** True when the address is one no public job advert could legitimately live at. */
export function isBlockedAddress(ip: string): boolean {
  const value = ip.trim();
  if (!value) return true;
  return value.includes(":") ? isBlockedV6(value) : isBlockedV4(value);
}
