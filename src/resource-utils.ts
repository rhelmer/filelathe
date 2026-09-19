export function isProbablyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
    return parsed.hostname.replace(/^www\./, "") || "link";
  } catch {
    return "link";
  }
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
 * Make fetched HTML usable in a srcdoc iframe: resolve relative URLs against
 * the original page, open links in a new tab, and drop CSP metas that block
 * snapshot assets.
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

  if (sourceUrl) {
    let baseHref: string | null = null;
    try {
      baseHref = new URL(".", sourceUrl).href;
    } catch {
      baseHref = null;
    }
    if (baseHref) {
      const safe = baseHref.replace(/"/g, "&quot;");
      const baseTag = `<base href="${safe}" target="_blank">`;
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
