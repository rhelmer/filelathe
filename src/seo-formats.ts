/**
 * SEO landing-page catalog. One URL per extension people search for
 * ("open xm online", "csv viewer browser", …). Keep copy query-shaped.
 */

export type SeoCapability =
  | "play"
  | "view"
  | "edit"
  | "inspect"
  | "invent";

export type SeoFormat = {
  /** URL slug under /open/{slug}/ — usually the extension */
  slug: string;
  /** Primary extension label without dot */
  ext: string;
  /** Related extensions shown on the page */
  also?: string[];
  name: string;
  capability: SeoCapability;
  /** ~155-char meta description */
  description: string;
  /** Extra body paragraphs (HTML-safe plain text) */
  blurb: string;
  /** Group for the /formats/ hub */
  group:
    | "tracker"
    | "media"
    | "documents"
    | "data"
    | "web"
    | "config"
    | "archive";
};

const trackerBlurb =
  "Playback uses libopenmpt in an AudioWorklet inside your tab. Bytes are not uploaded to convert or stream — useful for demoscene and chiptune modules when you do not want a desktop player.";

export const SEO_FORMATS: SeoFormat[] = [
  // Trackers
  {
    slug: "xm",
    ext: "xm",
    also: ["mod", "it", "s3m"],
    name: "FastTracker II XM",
    capability: "play",
    group: "tracker",
    description:
      "Open and play .XM tracker modules in your browser. Private in-tab libopenmpt playback — no install, no upload required to listen.",
    blurb: trackerBlurb,
  },
  {
    slug: "mod",
    ext: "mod",
    also: ["xm", "it", "s3m"],
    name: "Amiga / ProTracker MOD",
    capability: "play",
    group: "tracker",
    description:
      "Play .MOD files online in your browser with Filelathe. Local libopenmpt playback for classic Amiga and PC tracker modules.",
    blurb: trackerBlurb,
  },
  {
    slug: "it",
    ext: "it",
    also: ["xm", "mod", "s3m"],
    name: "Impulse Tracker IT",
    capability: "play",
    group: "tracker",
    description:
      "Open .IT (Impulse Tracker) modules in your browser. In-tab player — drop the file and hit Play.",
    blurb: trackerBlurb,
  },
  {
    slug: "s3m",
    ext: "s3m",
    also: ["xm", "mod", "it"],
    name: "Scream Tracker S3M",
    capability: "play",
    group: "tracker",
    description:
      "Play .S3M modules online. Browser-based libopenmpt player for Scream Tracker 3 files.",
    blurb: trackerBlurb,
  },
  {
    slug: "mtm",
    ext: "mtm",
    also: ["xm", "mod", "s3m"],
    name: "MultiTracker MTM",
    capability: "play",
    group: "tracker",
    description:
      "Open .MTM tracker modules in your browser with Filelathe’s built-in module player.",
    blurb: trackerBlurb,
  },
  {
    slug: "669",
    ext: "669",
    also: ["mod", "s3m", "xm"],
    name: "Composer 669",
    capability: "play",
    group: "tracker",
    description:
      "Play .669 modules online in your browser — no desktop tracker required.",
    blurb: trackerBlurb,
  },
  {
    slug: "okt",
    ext: "okt",
    also: ["mod", "xm"],
    name: "Oktalyzer OKT",
    capability: "play",
    group: "tracker",
    description:
      "Open Oktalyzer .OKT modules in your browser with private in-tab playback.",
    blurb: trackerBlurb,
  },
  {
    slug: "far",
    ext: "far",
    also: ["xm", "it", "mod"],
    name: "Farandole FAR",
    capability: "play",
    group: "tracker",
    description:
      "Play Farandole Composer .FAR modules online via Filelathe’s libopenmpt player.",
    blurb: trackerBlurb,
  },
  {
    slug: "ptm",
    ext: "ptm",
    also: ["s3m", "xm", "mod"],
    name: "PolyTracker PTM",
    capability: "play",
    group: "tracker",
    description:
      "Open .PTM tracker modules in your browser. Drop the file to play locally in the tab.",
    blurb: trackerBlurb,
  },
  {
    slug: "umx",
    ext: "umx",
    also: ["it", "xm", "mod"],
    name: "Unreal Music UMX",
    capability: "play",
    group: "tracker",
    description:
      "Play .UMX (Unreal Music) modules in your browser with Filelathe.",
    blurb: trackerBlurb,
  },

  // Audio / video / image
  {
    slug: "mp3",
    ext: "mp3",
    also: ["wav", "flac", "ogg", "m4a"],
    name: "MP3 audio",
    capability: "play",
    group: "media",
    description:
      "Open and play MP3 files in your browser. Drop an .mp3 into Filelathe for instant local playback.",
    blurb:
      "Uses the browser’s native audio element. The file stays in your session — handy for a quick listen without opening a heavy media app.",
  },
  {
    slug: "wav",
    ext: "wav",
    also: ["mp3", "flac", "ogg"],
    name: "WAV audio",
    capability: "play",
    group: "media",
    description:
      "Play WAV files online in your browser. Drop a .wav into Filelathe for local playback controls.",
    blurb:
      "Uncompressed WAV opens with native browser audio controls. No conversion step — open and play.",
  },
  {
    slug: "flac",
    ext: "flac",
    also: ["wav", "mp3", "ogg"],
    name: "FLAC audio",
    capability: "play",
    group: "media",
    description:
      "Open FLAC files in your browser when the browser supports it. Local playback via Filelathe.",
    blurb:
      "Playback depends on browser FLAC support. Filelathe mounts a dedicated audio player for the dropped file.",
  },
  {
    slug: "ogg",
    ext: "ogg",
    also: ["mp3", "wav", "opus"],
    name: "Ogg Vorbis / Opus",
    capability: "play",
    group: "media",
    description:
      "Play OGG audio in your browser. Drop .ogg or .oga files into Filelathe for local playback.",
    blurb:
      "Ogg containers open with native audio controls when the browser can decode the stream.",
  },
  {
    slug: "m4a",
    ext: "m4a",
    also: ["mp3", "aac", "wav"],
    name: "M4A / AAC audio",
    capability: "play",
    group: "media",
    description:
      "Open M4A audio files in your browser with Filelathe’s audio player.",
    blurb:
      "M4A/AAC playback uses the browser’s built-in decoder — drop the file to listen in-tab.",
  },
  {
    slug: "mp4",
    ext: "mp4",
    also: ["webm", "mov", "mkv"],
    name: "MP4 video",
    capability: "view",
    group: "media",
    description:
      "Open MP4 videos in your browser. Drop a .mp4 into Filelathe for an in-tab video player.",
    blurb:
      "Native HTML video controls for common MP4 files. Useful for a quick preview without downloading a desktop player.",
  },
  {
    slug: "webm",
    ext: "webm",
    also: ["mp4", "ogv"],
    name: "WebM video",
    capability: "view",
    group: "media",
    description:
      "Play WebM videos online in your browser via Filelathe’s video viewer.",
    blurb:
      "WebM opens with native browser video controls inside a Filelathe window.",
  },
  {
    slug: "mov",
    ext: "mov",
    also: ["mp4", "m4v"],
    name: "QuickTime MOV",
    capability: "view",
    group: "media",
    description:
      "Open MOV video files in your browser when the codec is supported. Preview with Filelathe.",
    blurb:
      "Playback depends on browser codec support for the MOV container. Drop the file to try an in-tab preview.",
  },
  {
    slug: "mkv",
    ext: "mkv",
    also: ["mp4", "webm"],
    name: "Matroska MKV",
    capability: "view",
    group: "media",
    description:
      "Preview MKV videos in the browser when codecs allow. Open .mkv files with Filelathe.",
    blurb:
      "MKV support varies by browser and codecs. Filelathe mounts a video player for a quick local preview.",
  },
  {
    slug: "png",
    ext: "png",
    also: ["jpg", "webp", "gif", "svg"],
    name: "PNG image",
    capability: "edit",
    group: "media",
    description:
      "Open PNG images in your browser and paint on them with Filelathe’s pixel editor. Export when you are done.",
    blurb:
      "Images open in a simple pixel editor — zoom, draw, and download a PNG. The original stays in your browser session.",
  },
  {
    slug: "jpg",
    ext: "jpg",
    also: ["png", "webp", "gif"],
    name: "JPEG image",
    capability: "edit",
    group: "media",
    description:
      "Open JPG/JPEG images online and edit pixels in your browser with Filelathe.",
    blurb:
      "Drop a JPEG to inspect and sketch on it locally, then export a PNG of your edits.",
  },
  {
    slug: "webp",
    ext: "webp",
    also: ["png", "jpg", "gif"],
    name: "WebP image",
    capability: "edit",
    group: "media",
    description:
      "Open WebP images in your browser. View and paint with Filelathe’s image tool.",
    blurb:
      "WebP opens in the pixel editor for quick markup and export — all in your tab.",
  },
  {
    slug: "gif",
    ext: "gif",
    also: ["png", "webp", "jpg"],
    name: "GIF image",
    capability: "edit",
    group: "media",
    description:
      "Open GIF images in your browser with Filelathe’s image viewer/editor.",
    blurb:
      "GIFs load into the image tool for viewing and simple pixel edits in-session.",
  },
  {
    slug: "svg",
    ext: "svg",
    also: ["png", "webp"],
    name: "SVG image",
    capability: "view",
    group: "media",
    description:
      "Open SVG files in your browser. Preview vector graphics with Filelathe.",
    blurb:
      "SVGs open as images in Filelathe so you can preview marks without hunting for a viewer.",
  },
  {
    slug: "avif",
    ext: "avif",
    also: ["webp", "png", "jpg"],
    name: "AVIF image",
    capability: "view",
    group: "media",
    description:
      "Open AVIF images in your browser when supported. Preview with Filelathe.",
    blurb:
      "AVIF preview depends on browser support. Drop the file to view it in-tab.",
  },

  // Documents
  {
    slug: "pdf",
    ext: "pdf",
    also: ["md", "html", "txt"],
    name: "PDF document",
    capability: "view",
    group: "documents",
    description:
      "Open PDF files in your browser. Drop a .pdf into Filelathe for an embedded local viewer.",
    blurb:
      "PDFs use the browser’s built-in viewer inside a Filelathe window — good for a fast read without another app.",
  },
  {
    slug: "md",
    ext: "md",
    also: ["markdown", "txt", "html"],
    name: "Markdown",
    capability: "view",
    group: "documents",
    description:
      "Preview Markdown (.md) online in your browser. Rendered view — drop the file into Filelathe.",
    blurb:
      "Markdown is rendered in-tab so README and notes are readable without a separate preview extension.",
  },
  {
    slug: "markdown",
    ext: "markdown",
    also: ["md", "txt"],
    name: "Markdown (.markdown)",
    capability: "view",
    group: "documents",
    description:
      "Open .markdown files in your browser with a rendered preview via Filelathe.",
    blurb:
      "Same Markdown renderer as .md — drop the file for a formatted preview.",
  },
  {
    slug: "txt",
    ext: "txt",
    also: ["log", "md"],
    name: "Plain text",
    capability: "view",
    group: "documents",
    description:
      "Open TXT files in your browser. Drop plain text into Filelathe to read it in a floating window.",
    blurb:
      "Plain text and logs open in a simple reader. Large files are sampled so the UI stays responsive.",
  },
  {
    slug: "log",
    ext: "log",
    also: ["txt"],
    name: "Log file",
    capability: "view",
    group: "documents",
    description:
      "Open .log files in your browser. Quick local text viewer for log dumps via Filelathe.",
    blurb:
      "Log files open as text. Filelathe shows a readable sample so you can skim without a heavy IDE.",
  },
  {
    slug: "html",
    ext: "html",
    also: ["htm", "md"],
    name: "HTML page",
    capability: "view",
    group: "web",
    description:
      "Open HTML files or paste a URL to preview a page in Filelathe’s web viewer.",
    blurb:
      "Local HTML files and fetched URLs open in a sandboxed page preview so you can glance at markup without leaving the tab.",
  },
  {
    slug: "htm",
    ext: "htm",
    also: ["html"],
    name: "HTM page",
    capability: "view",
    group: "web",
    description:
      "Open .htm files in your browser with Filelathe’s page preview.",
    blurb:
      "Same HTML viewer path as .html — drop the file for an in-tab preview.",
  },

  // Data
  {
    slug: "json",
    ext: "json",
    also: ["jsonl", "yaml", "csv"],
    name: "JSON",
    capability: "inspect",
    group: "data",
    description:
      "Open JSON files in your browser. Inspect structured data with Filelathe — drop a .json to get a dedicated UI.",
    blurb:
      "JSON objects open with a structured viewer path. Handy for config and API payloads you do not want to paste into a random online formatter.",
  },
  {
    slug: "jsonl",
    ext: "jsonl",
    also: ["json", "csv"],
    name: "JSON Lines",
    capability: "inspect",
    group: "data",
    description:
      "Open JSONL / NDJSON files in your browser with Filelathe.",
    blurb:
      "JSON Lines files are routed for inspection. Drop the file to explore records locally in your session.",
  },
  {
    slug: "csv",
    ext: "csv",
    also: ["tsv", "json"],
    name: "CSV spreadsheet",
    capability: "inspect",
    group: "data",
    description:
      "Open CSV files in your browser. Preview rows and columns locally with Filelathe — no spreadsheet install.",
    blurb:
      "CSV opens as a compact table preview (sampled rows) so you can verify exports quickly.",
  },
  {
    slug: "tsv",
    ext: "tsv",
    also: ["csv", "json"],
    name: "TSV table",
    capability: "inspect",
    group: "data",
    description:
      "Open TSV files online in your browser. Tab-separated preview via Filelathe.",
    blurb:
      "TSV uses the same table preview path as CSV, with tab delimiters.",
  },

  // Config / invent-friendly
  {
    slug: "edn",
    ext: "edn",
    also: ["json", "yaml", "clj"],
    name: "EDN (Extensible Data Notation)",
    capability: "invent",
    group: "config",
    description:
      "Open EDN files in your browser. Filelathe invents a mini-app for Clojure EDN when there is no built-in viewer.",
    blurb:
      "Unknown structured formats like EDN get a Haiku-invented mini-app for that file — inspect keys and values without a Clojure REPL.",
  },
  {
    slug: "yaml",
    ext: "yaml",
    also: ["yml", "toml", "json"],
    name: "YAML",
    capability: "invent",
    group: "config",
    description:
      "Open YAML files in your browser. Filelathe builds a small inspector UI for .yaml configs.",
    blurb:
      "YAML is treated as an inventable format: drop the file and get a generated mini-app tailored to its shape.",
  },
  {
    slug: "yml",
    ext: "yml",
    also: ["yaml", "toml", "json"],
    name: "YML",
    capability: "invent",
    group: "config",
    description:
      "Open .yml config files in your browser with a Filelathe-invented inspector.",
    blurb:
      "Same path as YAML — useful for CI and app config you want to skim privately in-tab.",
  },
  {
    slug: "toml",
    ext: "toml",
    also: ["yaml", "json", "ini"],
    name: "TOML",
    capability: "invent",
    group: "config",
    description:
      "Open TOML files online in your browser. Invented mini-app inspector via Filelathe.",
    blurb:
      "TOML configs get a generated UI so you can browse tables and keys without installing another tool.",
  },
  {
    slug: "xml",
    ext: "xml",
    also: ["html", "json"],
    name: "XML",
    capability: "invent",
    group: "config",
    description:
      "Open XML files in your browser. Filelathe invents a viewer for the document structure.",
    blurb:
      "XML drops get an invented mini-app — helpful for feeds, exports, and config you only need to peek at.",
  },
  {
    slug: "sql",
    ext: "sql",
    also: ["txt", "json"],
    name: "SQL script",
    capability: "invent",
    group: "data",
    description:
      "Open SQL files in your browser. Get a Filelathe mini-app for reading and navigating .sql scripts.",
    blurb:
      "SQL scripts are routed through invent so you get a readable UI instead of a raw dump.",
  },
  {
    slug: "ini",
    ext: "ini",
    also: ["toml", "cfg", "conf"],
    name: "INI config",
    capability: "invent",
    group: "config",
    description:
      "Open INI files in your browser with an invented Filelathe inspector.",
    blurb:
      "Classic INI/config files get a generated mini-app for section and key browsing.",
  },
  {
    slug: "cfg",
    ext: "cfg",
    also: ["ini", "conf", "toml"],
    name: "CFG config",
    capability: "invent",
    group: "config",
    description:
      "Open .cfg files online in your browser via Filelathe’s invent path.",
    blurb:
      "Drop a .cfg to get a small UI for reading configuration text locally.",
  },
  {
    slug: "env",
    ext: "env",
    also: ["txt", "ini"],
    name: "Dotenv / .env",
    capability: "invent",
    group: "config",
    description:
      "Open .env files in your browser carefully — Filelathe keeps processing local to your tab.",
    blurb:
      "Environment files stay in your browser session. Prefer local files you trust; Filelathe does not need them uploaded to invent a simple viewer.",
  },

  // Archives & containers
  {
    slug: "zip",
    ext: "zip",
    also: ["tar", "gz", "docx", "epub"],
    name: "ZIP archive",
    capability: "inspect",
    group: "archive",
    description:
      "Open ZIP files in your browser. List entries and click to open any file inside — extraction stays local in your tab.",
    blurb:
      "Filelathe reads the ZIP directory in your browser, shows the entry list with sizes, and lets you open an inner file (text, image, PDF, or a nested archive) in its own window. Bytes are never uploaded.",
  },
  {
    slug: "docx",
    ext: "docx",
    also: ["odt", "pptx", "xlsx", "zip"],
    name: "Word document (DOCX)",
    capability: "view",
    group: "archive",
    description:
      "Open DOCX files in your browser. Filelathe extracts the document text and opens it in the document viewer — no Office install.",
    blurb:
      "DOCX is a ZIP package. Filelathe reads word/document.xml locally, strips the XML to readable prose, embeds word/media images when present, and shows the result in the Markdown document viewer.",
  },
  {
    slug: "odt",
    ext: "odt",
    also: ["ods", "odp", "docx", "zip"],
    name: "OpenDocument Text (ODT)",
    capability: "view",
    group: "archive",
    description:
      "Open ODT files in your browser. Filelathe extracts content.xml text and shows it in the document viewer.",
    blurb:
      "ODT files are ZIP packages. Filelathe reads content.xml in your tab, recovers the prose, and opens it in the document viewer — a quick read without LibreOffice.",
  },
  {
    slug: "doc",
    ext: "doc",
    also: ["docx", "xls", "ppt", "msg"],
    name: "Word document (DOC)",
    capability: "view",
    group: "archive",
    description:
      "Open classic .doc files in your browser. Filelathe extracts the Word text and shows it in the document viewer — same path as markdown, not a hex dump.",
    blurb:
      "Pre-2007 Word files are OLE Compound Files. Filelathe reads the WordDocument stream (piece table when present), recovers the prose, and opens it in the Markdown document viewer so .doc feels like a readable document instead of an archive or hex inspector.",
  },
  {
    slug: "xls",
    ext: "xls",
    also: ["xlsx", "doc", "ppt", "csv"],
    name: "Excel workbook (XLS)",
    capability: "view",
    group: "archive",
    description:
      "Open classic .xls workbooks in your browser as an editable spreadsheet grid — same tool used for CSV.",
    blurb:
      "Excel 97–2003 .xls files are OLE Compound Files. Filelathe parses the BIFF workbook locally with SheetJS and opens the first sheet in the Spreadsheet editor, so classic Excel gets the same grid UX as CSV.",
  },
  {
    slug: "ppt",
    ext: "ppt",
    also: ["pptx", "doc", "xls"],
    name: "PowerPoint (PPT)",
    capability: "view",
    group: "archive",
    description:
      "Open classic .ppt decks in your browser. Filelathe lists OLE streams and peeks recoverable slide text locally.",
    blurb:
      "PowerPoint 97–2003 files are OLE Compound Files. Filelathe sniffs the container and lists streams such as PowerPoint Document. For full slide graphics, use .pptx — Filelathe renders modern decks with pptx-wasm.",
  },
  {
    slug: "pptx",
    ext: "pptx",
    also: ["ppt", "odp", "docx", "xlsx"],
    name: "PowerPoint (PPTX)",
    capability: "view",
    group: "archive",
    description:
      "Open PPTX decks in your browser with a canvas slide viewer — shapes, images, and charts render locally.",
    blurb:
      "Filelathe opens .pptx with pptx-wasm in your tab: navigate slides, see charts and images, and keep the file on-device. No Office install and no upload.",
  },
  {
    slug: "xlsx",
    ext: "xlsx",
    also: ["xls", "ods", "csv", "pptx"],
    name: "Excel workbook (XLSX)",
    capability: "view",
    group: "archive",
    description:
      "Open XLSX workbooks as an editable spreadsheet grid, with embedded charts shown as bar graphs when chart caches are present.",
    blurb:
      "Filelathe parses the workbook locally, opens the first sheet in the Spreadsheet editor, and surfaces xl/charts data as BarGraph widgets when DrawingML chart caches are available.",
  },
  {
    slug: "gz",
    ext: "gz",
    also: ["tgz", "tar", "zip"],
    name: "Gzip (.gz)",
    capability: "inspect",
    group: "archive",
    description:
      "Open .gz files in your browser. Filelathe decompresses gzip locally and opens the inner file in the right viewer.",
    blurb:
      "Gzip wraps a single file. Filelathe decompresses it in your tab with the browser DecompressionStream and opens the result — text, JSON, or a tarball — in its own window.",
  },
  {
    slug: "tar",
    ext: "tar",
    also: ["tgz", "gz", "zip"],
    name: "Tar archive",
    capability: "inspect",
    group: "archive",
    description:
      "Open TAR files in your browser. List archive members and open any entry — parsing runs locally in your tab.",
    blurb:
      "Filelathe parses ustar/posix tar headers in the browser, lists members with sizes, samples small text files, and opens any entry in its own window. No upload, no extract-to-disk.",
  },
  {
    slug: "tgz",
    ext: "tgz",
    also: ["tar", "gz", "zip"],
    name: "Gzipped tar (.tar.gz / .tgz)",
    capability: "inspect",
    group: "archive",
    description:
      "Open .tar.gz / .tgz files in your browser. Filelathe gunzips then lists the tar members, all locally.",
    blurb:
      "Filelathe decompresses the gzip layer with DecompressionStream, then parses the tar inside, so you can browse a .tar.gz and open individual files without a terminal.",
  },
];

export type SeoGuide = {
  slug: string;
  title: string;
  description: string;
  /** Plain-text sections: heading + paragraphs */
  sections: Array<{ heading: string; paragraphs: string[] }>;
  relatedSlugs: string[];
};

export const SEO_GUIDES: SeoGuide[] = [
  {
    slug: "open-tracker-modules-online",
    title: "How to open tracker modules (XM, MOD, IT) in your browser",
    description:
      "Play XM, MOD, IT, and S3M modules online without installing a tracker. How Filelathe’s in-browser libopenmpt player works.",
    relatedSlugs: ["xm", "mod", "it", "s3m"],
    sections: [
      {
        heading: "Why browser playback helps",
        paragraphs: [
          "Tracker modules (.xm, .mod, .it, .s3m, and related formats) still show up in demoscene packs, game rips, and chiptune archives. Installing a desktop player is fine at home — less fine on a locked-down laptop or when you only need a 30-second listen.",
          "Filelathe mounts a dedicated tracker player powered by libopenmpt in an AudioWorklet. You drop the file, wait for the worklet to load, then press Play.",
        ],
      },
      {
        heading: "Privacy",
        paragraphs: [
          "Module bytes are read in your browser tab for playback. They are not uploaded to a conversion farm just to hear the tune. Composing the window UI may call Filelathe’s API with file metadata; the audio path itself stays local.",
        ],
      },
      {
        heading: "Tips",
        paragraphs: [
          "Prefer opening the file from its real folder (Downloads, Documents). macOS Finder Recents sometimes hands the browser an empty or unreadable file stub.",
          "If Play stays disabled, wait for “libopenmpt” to finish loading, or use Retry. A hard refresh helps after deploys that update the worklet assets.",
        ],
      },
    ],
  },
  {
    slug: "view-unknown-file-formats",
    title: "View unknown file formats without installing software",
    description:
      "What to do when nothing opens your file. Filelathe invents a mini-app for unfamiliar formats like EDN, YAML, and niche exports.",
    relatedSlugs: ["edn", "yaml", "toml", "xml"],
    sections: [
      {
        heading: "The usual dead end",
        paragraphs: [
          "Most “online converters” only know a fixed list of office and media types. Niche formats — Clojure EDN, odd game exports, internal configs — get a shrug or a malware-looking download mirror.",
          "Filelathe routes known types to dedicated tools (PDF, images, CSV, trackers, …). Everything else can get a Haiku-invented mini-app: a small UI generated for that file’s shape.",
        ],
      },
      {
        heading: "What invent is good for",
        paragraphs: [
          "Invent shines for structured text and configs you want to skim: keys, tables, sections, hex/text samples. It is not a full emulator for disk images or ROMs — those are listed as planned host players separately.",
          "Saved mini-apps can stick around in your browser so the next file of the same kind reuses a familiar layout.",
        ],
      },
    ],
  },
  {
    slug: "private-in-browser-file-viewer",
    title: "Private in-browser file viewing (what stays local)",
    description:
      "How Filelathe handles files in your tab, what may hit the API, and why that matters versus upload-to-convert sites.",
    relatedSlugs: ["pdf", "csv", "png", "xm"],
    sections: [
      {
        heading: "Local-first viewing",
        paragraphs: [
          "Dropping a file into Filelathe reads it with the browser File API. Media playback, PDF embedding, and image editing use object URLs and WASM/worklets in your tab.",
          "That is different from sites that require uploading the whole file to a server before you see a preview.",
        ],
      },
      {
        heading: "When the network is used",
        paragraphs: [
          "Opening a URL fetches through Filelathe’s fetch API. Composing a UI may send metadata (name, type, small samples) so the right tool or an invented mini-app can be chosen. Rate limits apply on those API routes.",
          "If you are handling secrets (.env, private keys), prefer local files you trust and avoid pasting sensitive URLs.",
        ],
      },
    ],
  },
];

export const SEO_SITE = {
  origin: "https://www.filelathe.com",
  name: "Filelathe",
  tagline: "Open any file in your browser",
  homeTitle:
    "Filelathe — open XM, PDF, CSV, images & more in your browser",
  homeDescription:
    "Drop a file or paste a URL to open it in your browser. Play tracker modules, view PDFs, edit images, inspect CSV/JSON, or invent a mini-app for formats nothing else handles. Private in-tab tools.",
} as const;

export function capabilityVerb(capability: SeoCapability): string {
  switch (capability) {
    case "play":
      return "Play";
    case "edit":
      return "Open & edit";
    case "inspect":
      return "Inspect";
    case "invent":
      return "Open";
    default:
      return "Open";
  }
}
