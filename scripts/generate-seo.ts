/**
 * Generate crawlable SEO pages, robots.txt, and sitemap.xml into public/.
 * Run via: pnpm seo:generate (also hooked from build / predev).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEO_FORMATS,
  SEO_GUIDES,
  SEO_SITE,
  capabilityVerb,
  type SeoFormat,
  type SeoGuide,
} from "../src/seo-formats.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(options: {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: Record<string, unknown> | Array<Record<string, unknown>>;
  body: string;
}) {
  const canonical = `${SEO_SITE.origin}${options.canonicalPath}`;
  const jsonLd = Array.isArray(options.jsonLd)
    ? options.jsonLd
    : [options.jsonLd];
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(options.title)}</title>
    <meta name="description" content="${esc(options.description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(SEO_SITE.name)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:title" content="${esc(options.title)}" />
    <meta property="og:description" content="${esc(options.description)}" />
    <meta property="og:image" content="${SEO_SITE.origin}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(options.title)}" />
    <meta name="twitter:description" content="${esc(options.description)}" />
    <meta name="twitter:image" content="${SEO_SITE.origin}/og.png" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/seo.css" />
    ${jsonLd
      .map(
        (block) =>
          `<script type="application/ld+json">${JSON.stringify(block)}</script>`,
      )
      .join("\n    ")}
  </head>
  <body>
    <div class="wrap">
      <header class="top">
        <a class="brand" href="/">
          <img src="/filelathe-logo.svg" width="36" height="36" alt="" />
          <span>Filelathe</span>
        </a>
        <nav>
          <a href="/formats/">Formats</a>
          <a href="/guides/">Guides</a>
          <a class="cta-link" href="/">Open app</a>
        </nav>
      </header>
      ${options.body}
      <footer class="foot">
        <p><a href="/">${esc(SEO_SITE.name)}</a> — ${esc(SEO_SITE.tagline)}. Files open in your browser tab.</p>
        <p><a href="/formats/">All formats</a> · <a href="/guides/">Guides</a> · <a href="/sitemap.xml">Sitemap</a></p>
      </footer>
    </div>
    <script
      defer
      src="https://analytics.filelathe.com/script.js"
      data-website-id="d541d56b-db29-4768-90a9-7e5f80731512"
      data-performance="true"
    ></script>
  </body>
</html>
`;
}

function relatedLinks(slugs: string[]) {
  const items = slugs
    .map((slug) => SEO_FORMATS.find((f) => f.slug === slug))
    .filter((f): f is SeoFormat => Boolean(f));
  if (!items.length) return "";
  return `<ul class="chips">${items
    .map(
      (f) =>
        `<li><a href="/open/${esc(f.slug)}/">.${esc(f.ext)}</a></li>`,
    )
    .join("")}</ul>`;
}

function formatPage(format: SeoFormat) {
  const verb = capabilityVerb(format.capability);
  const h1 = `${verb} .${format.ext.toUpperCase()} files in your browser`;
  const title = `${verb} .${format.ext} online — ${format.name} · Filelathe`;
  const also = (format.also ?? []).filter((x) => x !== format.ext);
  const related = relatedLinks(also);

  const howSteps =
    format.capability === "invent"
      ? [
          "Drop your file (or paste a URL) on the Filelathe homepage.",
          "Filelathe detects the extension and invents a small mini-app for that format.",
          "Inspect the result in a floating window — reuse saved mini-apps next time.",
        ]
      : [
          "Open Filelathe and drop your file (avoid macOS Finder Recents — use the real folder).",
          "A dedicated tool window opens for this format.",
          format.capability === "play"
            ? "Press Play when the player is ready."
            : "Use the on-page controls to view or edit.",
        ];

  const body = `
    <main>
      <p class="eyebrow">.${esc(format.ext)} · ${esc(format.name)}</p>
      <h1>${esc(h1)}</h1>
      <p class="lede">${esc(format.description)}</p>
      <p><a class="btn" href="/">Open in Filelathe</a></p>

      <section>
        <h2>How it works</h2>
        <ol>${howSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        <p>${esc(format.blurb)}</p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>File bytes are read in your browser for viewing and playback. Unlike upload-to-convert sites, Filelathe is built around in-tab tools. API calls may use filename, type, and small samples to choose or invent a UI.</p>
      </section>

      ${
        related
          ? `<section><h2>Related formats</h2>${related}</section>`
          : ""
      }

      <section>
        <h2>More</h2>
        <ul class="list">
          <li><a href="/formats/">Browse all supported formats</a></li>
          <li><a href="/guides/private-in-browser-file-viewer/">What stays local in your browser</a></li>
          ${
            format.group === "tracker"
              ? `<li><a href="/guides/open-tracker-modules-online/">Tracker modules guide</a></li>`
              : ""
          }
          ${
            format.capability === "invent"
              ? `<li><a href="/guides/view-unknown-file-formats/">Unknown formats guide</a></li>`
              : ""
          }
        </ul>
      </section>
    </main>
  `;

  return layout({
    title,
    description: format.description,
    canonicalPath: `/open/${format.slug}/`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: `Filelathe — ${format.name}`,
        url: `${SEO_SITE.origin}/open/${format.slug}/`,
        applicationCategory: "UtilityApplication",
        operatingSystem: "Web browser",
        description: format.description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Filelathe",
            item: `${SEO_SITE.origin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Formats",
            item: `${SEO_SITE.origin}/formats/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `.${format.ext}`,
            item: `${SEO_SITE.origin}/open/${format.slug}/`,
          },
        ],
      },
    ],
    body,
  });
}

function guidePage(guide: SeoGuide) {
  const body = `
    <main>
      <p class="eyebrow">Guide</p>
      <h1>${esc(guide.title)}</h1>
      <p class="lede">${esc(guide.description)}</p>
      <p><a class="btn" href="/">Try Filelathe</a></p>
      ${guide.sections
        .map(
          (section) => `
      <section>
        <h2>${esc(section.heading)}</h2>
        ${section.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
      </section>`,
        )
        .join("")}
      <section>
        <h2>Related formats</h2>
        ${relatedLinks(guide.relatedSlugs)}
      </section>
    </main>
  `;

  return layout({
    title: `${guide.title} · Filelathe`,
    description: guide.description,
    canonicalPath: `/guides/${guide.slug}/`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      author: { "@type": "Organization", name: SEO_SITE.name },
      mainEntityOfPage: `${SEO_SITE.origin}/guides/${guide.slug}/`,
    },
    body,
  });
}

function formatsHub() {
  const groups: Record<string, SeoFormat[]> = {};
  for (const format of SEO_FORMATS) {
    (groups[format.group] ??= []).push(format);
  }
  const labels: Record<string, string> = {
    tracker: "Tracker modules",
    media: "Audio, video & images",
    documents: "Documents & text",
    data: "Data",
    web: "Web",
    config: "Config & inventable formats",
  };

  const sections = Object.entries(labels)
    .filter(([key]) => groups[key]?.length)
    .map(([key, label]) => {
      const items = groups[key]!;
      return `
      <section>
        <h2>${esc(label)}</h2>
        <ul class="format-grid">
          ${items
            .map(
              (f) =>
                `<li><a href="/open/${esc(f.slug)}/"><strong>.${esc(f.ext)}</strong> <span>${esc(f.name)}</span></a></li>`,
            )
            .join("")}
        </ul>
      </section>`;
    })
    .join("");

  const body = `
    <main>
      <h1>Formats you can open in Filelathe</h1>
      <p class="lede">Dedicated players and viewers for common types — plus invented mini-apps for formats most converters ignore. Pick an extension or <a href="/">drop a file</a>.</p>
      ${sections}
      <section>
        <h2>Guides</h2>
        <ul class="list">
          ${SEO_GUIDES.map(
            (g) =>
              `<li><a href="/guides/${esc(g.slug)}/">${esc(g.title)}</a></li>`,
          ).join("")}
        </ul>
      </section>
    </main>
  `;

  return layout({
    title: "All formats — open files in your browser · Filelathe",
    description:
      "Browse file formats Filelathe can open in your browser: XM/MOD trackers, PDF, CSV, images, Markdown, YAML, EDN, and more.",
    canonicalPath: "/formats/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Filelathe formats",
      url: `${SEO_SITE.origin}/formats/`,
      hasPart: SEO_FORMATS.map((f) => ({
        "@type": "WebPage",
        name: `.${f.ext}`,
        url: `${SEO_SITE.origin}/open/${f.slug}/`,
      })),
    },
    body,
  });
}

function guidesHub() {
  const body = `
    <main>
      <h1>Guides</h1>
      <p class="lede">Short notes on opening niche formats and keeping previews in your browser.</p>
      <ul class="list">
        ${SEO_GUIDES.map(
          (g) =>
            `<li><a href="/guides/${esc(g.slug)}/"><strong>${esc(g.title)}</strong></a><br /><span class="muted">${esc(g.description)}</span></li>`,
        ).join("")}
      </ul>
    </main>
  `;

  return layout({
    title: "Guides · Filelathe",
    description:
      "Guides for playing tracker modules, viewing unknown formats, and private in-browser file viewing with Filelathe.",
    canonicalPath: "/guides/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Filelathe guides",
      url: `${SEO_SITE.origin}/guides/`,
    },
    body,
  });
}

function sitemapXml(today: string) {
  const urls = [
    { loc: `${SEO_SITE.origin}/`, priority: "1.0" },
    { loc: `${SEO_SITE.origin}/formats/`, priority: "0.9" },
    { loc: `${SEO_SITE.origin}/guides/`, priority: "0.8" },
    ...SEO_GUIDES.map((g) => ({
      loc: `${SEO_SITE.origin}/guides/${g.slug}/`,
      priority: "0.7",
    })),
    ...SEO_FORMATS.map((f) => ({
      loc: `${SEO_SITE.origin}/open/${f.slug}/`,
      priority: "0.8",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

function robotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${SEO_SITE.origin}/sitemap.xml
`;
}

const seoCss = `/* Shared styles for crawlable SEO pages */
:root {
  color-scheme: light;
  --bg: oklch(0.985 0.008 95);
  --fg: oklch(0.28 0.02 60);
  --muted: oklch(0.45 0.02 60);
  --card: oklch(0.99 0.005 95);
  --line: oklch(0.88 0.02 85);
  --accent: oklch(0.42 0.08 55);
  --accent-fg: oklch(0.99 0.01 95);
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background:
    radial-gradient(circle at top left, oklch(0.96 0.02 95), transparent 45%),
    linear-gradient(180deg, oklch(0.99 0.005 95), oklch(0.95 0.01 95));
  color: var(--fg);
  line-height: 1.55;
  min-height: 100vh;
}
.wrap { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
.top {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;
}
.brand {
  display: inline-flex; align-items: center; gap: 0.6rem;
  text-decoration: none; color: inherit; font-weight: 650; font-size: 1.1rem;
}
nav { display: flex; gap: 0.9rem; align-items: center; font-size: 0.95rem; }
nav a { color: var(--muted); text-decoration: none; }
nav a:hover { color: var(--fg); }
.cta-link {
  color: var(--accent-fg) !important; background: var(--accent);
  padding: 0.35rem 0.8rem; border-radius: 999px; font-size: 0.85rem;
}
h1 { font-size: clamp(1.75rem, 4vw, 2.25rem); line-height: 1.15; margin: 0.25rem 0 0.75rem; letter-spacing: -0.02em; }
h2 { font-size: 1.15rem; margin: 1.75rem 0 0.6rem; }
.eyebrow {
  text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72rem;
  color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; margin: 0;
}
.lede { font-size: 1.08rem; color: var(--muted); margin: 0 0 1.25rem; }
.btn {
  display: inline-block; background: var(--accent); color: var(--accent-fg);
  text-decoration: none; padding: 0.65rem 1.15rem; border-radius: 999px;
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.9rem; font-weight: 600;
}
.btn:hover { filter: brightness(1.05); }
ol, .list { padding-left: 1.2rem; }
.list { list-style: disc; }
.chips { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
.chips a {
  display: inline-block; border: 1px solid var(--line); background: var(--card);
  padding: 0.3rem 0.7rem; border-radius: 999px; text-decoration: none; color: inherit;
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.85rem;
}
.format-grid {
  list-style: none; padding: 0; display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.5rem;
}
.format-grid a {
  display: block; border: 1px solid var(--line); background: var(--card);
  padding: 0.7rem 0.8rem; border-radius: 0.75rem; text-decoration: none; color: inherit;
}
.format-grid a:hover { border-color: var(--accent); }
.format-grid strong {
  display: block; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.95rem;
}
.format-grid span { color: var(--muted); font-size: 0.82rem; }
.muted { color: var(--muted); font-size: 0.92rem; }
.foot {
  margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid var(--line);
  color: var(--muted); font-size: 0.88rem;
}
.foot a { color: inherit; }
`;

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // Clean generated trees so removed slugs disappear.
  await rm(path.join(publicDir, "open"), { recursive: true, force: true });
  await rm(path.join(publicDir, "formats"), { recursive: true, force: true });
  await rm(path.join(publicDir, "guides"), { recursive: true, force: true });

  await writeFile(path.join(publicDir, "seo.css"), seoCss);
  await writeFile(path.join(publicDir, "robots.txt"), robotsTxt());
  await writeFile(path.join(publicDir, "sitemap.xml"), sitemapXml(today));

  await mkdir(path.join(publicDir, "formats"), { recursive: true });
  await writeFile(
    path.join(publicDir, "formats/index.html"),
    formatsHub(),
  );

  await mkdir(path.join(publicDir, "guides"), { recursive: true });
  await writeFile(path.join(publicDir, "guides/index.html"), guidesHub());

  for (const guide of SEO_GUIDES) {
    const dir = path.join(publicDir, "guides", guide.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), guidePage(guide));
  }

  for (const format of SEO_FORMATS) {
    const dir = path.join(publicDir, "open", format.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), formatPage(format));
  }

  console.log(
    `SEO: ${SEO_FORMATS.length} format pages, ${SEO_GUIDES.length} guides, sitemap, robots → public/`,
  );
}

await main();
