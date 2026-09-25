/**
 * Offline SSRF / safe-fetch guards (no outbound public network required).
 *
 *   pnpm fetch-resource-smoke
 */
import { fetchRemoteResource, FetchResourceError, readBodyCapped } from "./fetch-resource";
import { assertSafeFetchUrl, isPublicIp } from "./safe-fetch-url";
import { clientKeyFromHeaders } from "./server/rate-limit";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function expectBlocked(name: string, url: string) {
  try {
    await assertSafeFetchUrl(url);
    check(name, false, "expected block");
  } catch (error) {
    check(
      name,
      error instanceof FetchResourceError,
      error instanceof Error ? error.message : String(error),
    );
  }
}

console.log("isPublicIp");
check("rejects 127.0.0.1", !isPublicIp("127.0.0.1"));
check("rejects 10.0.0.1", !isPublicIp("10.0.0.1"));
check("rejects 192.168.1.1", !isPublicIp("192.168.1.1"));
check("rejects 169.254.169.254", !isPublicIp("169.254.169.254"));
check("rejects 172.16.5.1", !isPublicIp("172.16.5.1"));
check("rejects 0.0.0.0", !isPublicIp("0.0.0.0"));
check("rejects ::1", !isPublicIp("::1"));
check("rejects fc00::1", !isPublicIp("fc00::1"));
check("rejects fe80::1", !isPublicIp("fe80::1"));
check("rejects ::ffff:127.0.0.1", !isPublicIp("::ffff:127.0.0.1"));
check("allows 1.1.1.1", isPublicIp("1.1.1.1"));
check("allows 8.8.8.8", isPublicIp("8.8.8.8"));

console.log("assertSafeFetchUrl (blocked)");
await expectBlocked("localhost", "http://localhost/secret");
await expectBlocked("127.0.0.1", "http://127.0.0.1:8080/");
await expectBlocked("metadata IP", "http://169.254.169.254/latest/meta-data/");
await expectBlocked("private RFC1918", "http://10.1.2.3/admin");
await expectBlocked("credentials", "https://user:pass@example.com/x");
await expectBlocked("file scheme", "file:///etc/passwd");
await expectBlocked("ftp scheme", "ftp://example.com/a");

console.log("clientKeyFromHeaders");
{
  const headers = new Headers({
    "x-forwarded-for": "1.2.3.4",
    "x-vercel-forwarded-for": "9.9.9.9",
  });
  check(
    "prefers x-vercel-forwarded-for",
    clientKeyFromHeaders(headers) === "9.9.9.9",
  );
}

console.log("fetchRemoteResource blocks loopback before connect");
try {
  await fetchRemoteResource("http://127.0.0.1:9/secret");
  check("direct loopback fetch blocked", false);
} catch (error) {
  check(
    "direct loopback fetch blocked",
    error instanceof FetchResourceError &&
      !/Fetch failed \(\d+\)/.test(error.message),
    error instanceof Error ? error.message : String(error),
  );
}

console.log("redirect Location to private is rejected by assertSafeFetchUrl");
await expectBlocked(
  "revalidate private after redirect",
  "http://127.0.0.1/from-redirect",
);

console.log("readBodyCapped");
{
  // content-length pre-check
  try {
    await readBodyCapped(
      new Response(null, {
        status: 200,
        headers: { "content-length": String(20 * 1024 * 1024) },
      }),
      15 * 1024 * 1024,
    );
    check("content-length over max", false);
  } catch (error) {
    check(
      "content-length over max",
      error instanceof FetchResourceError && /too large/.test(error.message),
    );
  }

  // mid-stream abort
  const max = 64 * 1024;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const chunk = new Uint8Array(16 * 1024).fill(0x61);
      for (let i = 0; i < 8; i++) controller.enqueue(chunk);
      controller.close();
    },
  });
  try {
    await readBodyCapped(new Response(stream), max);
    check("stream over max aborts", false);
  } catch (error) {
    check(
      "stream over max aborts",
      error instanceof FetchResourceError && /too large/.test(error.message),
    );
  }

  const ok = await readBodyCapped(
    new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: { "content-type": "application/octet-stream" },
    }),
    1024,
  );
  check("stream under max", ok.equals(Buffer.from([1, 2, 3, 4])));
}

console.log("error messages stay generic (no status oracle)");
try {
  await fetchRemoteResource("http://169.254.169.254/");
  check("metadata error generic", false);
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  check(
    "metadata error generic",
    error instanceof FetchResourceError &&
      !msg.includes("169.254") &&
      !/\(\d{3}\)/.test(msg),
    msg,
  );
}

console.log("manual redirect hop re-validates Location");
{
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls++;
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (href.includes("example.com/start")) {
      return new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/secret" },
      });
    }
    return new Response("should-not-fetch-private", { status: 200 });
  }) as typeof fetch;

  try {
    // example.com is public; first hop allowed, Location must be rejected.
    await fetchRemoteResource("https://example.com/start");
    check("redirect to loopback blocked", false);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    check(
      "redirect to loopback blocked",
      error instanceof FetchResourceError &&
        calls === 1 &&
        /not allowed|Could not/i.test(msg),
      `calls=${calls} msg=${msg}`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall fetch-resource smoke checks passed");
