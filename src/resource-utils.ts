/** http(s) only. Drops javascript:, data:, and other schemes. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * URL safe to put in an <a href> or iframe src.
 * http(s) and same-document hashes only. javascript:, data:, and blob: are rejected
 * here — blob media uses its own check.
 */
export function safeNavigationHref(value: string | null | undefined): string {
  const http = safeHttpUrl(value);
  if (http) return http;
  const trimmed = value?.trim() ?? "";
  if (/^#[A-Za-z0-9_\-.:]*$/.test(trimmed)) return trimmed;
  if (
    /^mailto:[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+$/.test(trimmed)
  ) {
    return trimmed;
  }
  return "#";
}

export function toHexPreview(bytes: Uint8Array, max = 256): string {
  const slice = bytes.slice(0, max);
  const parts: string[] = [];
  for (let i = 0; i < slice.length; i += 16) {
    const row = slice.slice(i, i + 16);
    const hex = [...row].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = [...row]
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
      .join("");
    parts.push(
      `${i.toString(16).padStart(6, "0")}  ${hex.padEnd(47, " ")}  ${ascii}`,
    );
  }
  return parts.join("\n");
}

export function tryDecodeText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!text) return null;
    // Reject mostly-binary samples
    let weird = 0;
    const n = Math.min(text.length, 2000);
    for (let i = 0; i < n; i++) {
      const code = text.charCodeAt(i);
      if (code === 0) return null;
      if (code < 9 || (code > 13 && code < 32)) weird++;
    }
    if (weird / n > 0.05) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Make local HTML usable in a srcdoc iframe: resolve relative URLs when a
 * source URL is known, browse in-frame by default, and drop CSP metas that
 * block snapshot assets. Per-link `target="_blank"` still opens a new tab.
 */
export function rewriteHtmlForSnapshot(
  html: string,
  sourceUrl: string | null,
): string {
  let out = html;
  if (!out.trim()) return out;

  // Snapshot CSP often blocks images/scripts that would work with a real base.
  out = out.replace(
    /<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
    "",
  );

  const safeSource = safeHttpUrl(sourceUrl);
  if (safeSource) {
    let baseHref: string | null = null;
    try {
      baseHref = new URL(".", safeSource).href;
    } catch {
      baseHref = null;
    }
    if (baseHref) {
      const safe = baseHref.replace(/"/g, "&quot;");
      const baseTag = `<base href="${safe}" target="_self">`;
      if (/<base\b/i.test(out)) {
        out = out.replace(/<base\b[^>]*>/i, baseTag);
      } else if (/<head[^>]*>/i.test(out)) {
        out = out.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
      } else if (/<html[^>]*>/i.test(out)) {
        out = out.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
      } else {
        out = `<head>${baseTag}</head>${out}`;
      }
    }
  }

  return out;
}
