import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";

type Address = { address: string; family: 4 | 6 };
export type SafeEndpoint = { url: URL; address: Address };
type Resolver = (hostname: string) => Promise<Address[]>;

const isPublicIPv4 = (address: string) => {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  // IANA special-purpose, private, loopback, link-local, documentation,
  // benchmarking, multicast, and reserved ranges.
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
    (a === 203 && b === 0 && c === 113)
  );
};

function ipv6ToBigInt(address: string): bigint {
  let input = address.toLowerCase();
  // Convert an IPv4-embedded tail into the equivalent two hextets.
  const embedded = input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const octets = embedded[1].split(".").map(Number);
    if (octets.some((part) => part > 255)) return BigInt(-1);
    const tail = `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
    input = input.slice(0, input.length - embedded[1].length) + tail;
  }

  const halves = input.split("::");
  if (halves.length > 2) return BigInt(-1);
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (zeros < 0 || halves.length === 1 && left.length !== 8) return BigInt(-1);
  const words = [...left, ...Array(zeros).fill("0"), ...right];
  if (words.length !== 8 || words.some((word) => !/^[\da-f]{1,4}$/.test(word))) return BigInt(-1);
  return words.reduce((value, word) => (value << BigInt(16)) | BigInt(`0x${word}`), BigInt(0));
}

function isPublicIPv6(address: string): boolean {
  const ip = ipv6ToBigInt(address);
  if (ip < BigInt(0)) return false;
  const prefix = (bits: bigint, length: number) => ip >> BigInt(128 - length) === bits;
  // Public unicast global space is currently 2000::/3. Exclude special-use,
  // documentation, transition and discard ranges within it.
  if (!prefix(BigInt(1), 3)) return false;
  return !(
    prefix(BigInt("0x400200"), 23) || // IETF protocol assignments, including Teredo
    prefix(BigInt("0x20010db8"), 32) || // documentation
    prefix(BigInt("0x2002"), 16) || // 6to4 embeds IPv4 routing
    prefix(BigInt("0x3fff0"), 20) // documentation
  );
}

function isPublicAddress({ address, family }: Address): boolean {
  return family === 4 ? isPublicIPv4(address) : isPublicIPv6(address);
}

async function systemResolver(hostname: string): Promise<Address[]> {
  return (await dnsLookup(hostname, { all: true, verbatim: true })) as Address[];
}

/** Validate and resolve once; the returned address is pinned by the transport. */
export async function assertSafeHttpUrl(
  value: string,
  resolver: Resolver = systemResolver
): Promise<SafeEndpoint> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Endpoint must be a valid absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Endpoint must use HTTP or HTTPS without embedded credentials");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Endpoint host is not publicly routable");
  }

  const family = isIP(hostname);
  if (family) {
    const address = { address: hostname, family: family as 4 | 6 };
    if (!isPublicAddress(address)) throw new Error("Endpoint host is not publicly routable");
    return { url, address };
  }

  const addresses = await resolver(hostname);
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error("Endpoint host resolves to a non-public address");
  }
  // The exact vetted answer is returned to the request transport. A subsequent
  // DNS lookup is never performed for this request.
  return { url, address: addresses[0] };
}

/** Node's HTTP(S) client uses this callback for socket resolution. The URL host
 * remains intact for Host and TLS SNI while the socket connects to the vetted IP.
 */
export function createPinnedLookup(address: Address): LookupFunction {
  return ((_hostname: string, options: { all?: boolean }, callback: (...args: any[]) => void) => {
    if (options?.all) callback(null, [{ address: address.address, family: address.family }]);
    else callback(null, address.address, address.family);
  }) as LookupFunction;
}

export type HttpResponse = { status: number; statusText: string; contentType: string | undefined; body: string };
export type HttpSend = (endpoint: SafeEndpoint, method: string, body?: string) => Promise<HttpResponse>;
export const HTTP_REQUEST_TIMEOUT_MS = 10_000;
export const HTTP_RESPONSE_BODY_LIMIT_BYTES = 1_048_576;

type SendLimits = { timeoutMs?: number; maxResponseBytes?: number };

/** Execute only after validation; send is injectable so validation can be tested
 * without permitting a network request. */
export async function requestSafeHttp(
  value: string,
  method: string,
  body?: string,
  resolver: Resolver = systemResolver,
  send: HttpSend = sendPinnedRequest
): Promise<HttpResponse> {
  const endpoint = await assertSafeHttpUrl(value, resolver);
  return send(endpoint, method, body);
}

export function sendPinnedRequest(
  endpoint: SafeEndpoint,
  method: string,
  body?: string,
  limits: SendLimits = {}
): Promise<HttpResponse> {
  const timeoutMs = limits.timeoutMs ?? HTTP_REQUEST_TIMEOUT_MS;
  const maxResponseBytes = limits.maxResponseBytes ?? HTTP_RESPONSE_BODY_LIMIT_BYTES;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const transport = endpoint.url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = transport(endpoint.url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      lookup: createPinnedLookup(endpoint.address),
    } as Parameters<typeof httpRequest>[1], (response) => {
      const chunks: Buffer[] = [];
      let responseBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.from(chunk);
        responseBytes += buffer.length;
        if (responseBytes > maxResponseBytes) {
          fail(new Error("HTTP response body exceeds the configured size limit"));
          request.destroy();
          return;
        }
        chunks.push(buffer);
      });
      response.on("error", fail);
      response.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({
          status: response.statusCode ?? 0,
          statusText: response.statusMessage ?? "",
          contentType: response.headers["content-type"],
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    timeout = setTimeout(() => {
      fail(new Error(`HTTP request timed out after ${timeoutMs} ms`));
      request.destroy();
    }, timeoutMs);
    request.on("close", () => clearTimeout(timeout));
    request.on("error", fail);
    if (body !== undefined) request.write(body);
    request.end();
  });
}
