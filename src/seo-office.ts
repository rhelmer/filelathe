/**
 * Extra landing-page copy for the office/archive cluster.
 * Facts are limited to what the in-tab parsers actually do
 * (see src/office.ts and src/archive.ts). Do not add capabilities here
 * that those modules do not implement.
 */

export type SeoOfficeLanding = {
  h1: string;
  /** Ordered steps for "How it works" — specific to this format. */
  steps: string[];
  can: string[];
  cant: string[];
  faqs: Array<{ q: string; a: string }>;
  /** Query-shaped sections. Paragraphs may include [label](/path/) links. */
  sections: Array<{ heading: string; paragraphs: string[] }>;
  /** Guide slugs. Always include the private-viewer guide plus one more. */
  guides: string[];
};

const privacy =
  "private in-browser viewing";
const privacyHref = "/guides/private-in-browser-file-viewer/";

function uploaded(detail: string): string {
  return `${detail} Choosing the tool window may send the filename, the type, and samples to the API. That is not an upload-to-convert service. See [${privacy}](${privacyHref}).`;
}

export const SEO_OFFICE_LANDINGS: Record<string, SeoOfficeLanding> = {
  docx: {
    h1: "View .DOCX files in your browser",
    steps: [
      "Drop the .docx on Filelathe, or use Choose file. On macOS, pick the file from its real folder — Finder Recents can hand the browser an empty stub.",
      "A DOCX is a ZIP package. Filelathe reads word/document.xml in your tab and strips the XML down to readable prose.",
      "Images in word/media are appended after the text when they are present, and the result opens in the document viewer.",
    ],
    can: [
      "Read the document text from word/document.xml without Word.",
      "Show embedded PNG, JPEG, GIF, WebP, BMP, and SVG images from word/media — up to 8 images, each up to 600KB — after the prose.",
      "Fall back to a ZIP entry list if the document text cannot be recovered.",
    ],
    cant: [
      "Edit the file or save a .docx.",
      "Reproduce Word layout, styles, headers, footers, footnotes, comments, or tracked changes. Tables and headings come through as plain paragraphs.",
      "Place pictures where they sat on the page. Long documents are cut off around the first 20,000 characters.",
      "Unlock a password-protected document.",
    ],
    faqs: [
      {
        q: "Can I view a DOCX in the browser without Word?",
        a: "Yes. Filelathe opens the package locally, reads word/document.xml, and shows the prose in the document viewer. You do not install Office.",
      },
      {
        q: "Will the page look like it does in Word?",
        a: "No. You get the text, plus embedded images listed after it. Styles, headers, comments, and tracked changes are not laid out.",
      },
      {
        q: "Are pictures inside the DOCX shown?",
        a: "Common image types under word/media are shown after the text, up to 8 images and 600KB each. Drawings and images larger than that are skipped.",
      },
      {
        q: "Can I edit or convert the DOCX?",
        a: "No. This is a viewer. It does not write a .docx back, and it does not convert the file to PDF.",
      },
      {
        q: "Does my DOCX get uploaded?",
        a: "The package is parsed in your tab. It is not sent to a conversion site. An API call may use the filename, type, and samples to choose the viewer.",
      },
    ],
    sections: [
      {
        heading: "How to open a .docx file without Word",
        paragraphs: [
          "Open Filelathe, then drop the file or use Choose file. The viewer reads the ZIP package in the tab and shows the text from word/document.xml. No Word, LibreOffice, or desktop install.",
          "If the XML cannot be read, you still get the archive listing, so you can see the parts inside the package — including word/media.",
        ],
      },
      {
        heading: "Open DOCX on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Filelathe is a website, so the same page works in Chrome, Safari, or Firefox. On a Chromebook, Mac, or iPad, use Choose file. On a desktop you can also drop the .docx onto the page.",
          "Nothing is installed. A locked-down laptop can view the document as long as the browser can run the page.",
        ],
      },
      {
        heading: "Does my .docx get uploaded?",
        paragraphs: [
          uploaded(
            "Filelathe unzips and reads the Word package in your browser. The file is not posted to an online converter.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "This page is a view, not a convert. You do not get a PDF, a new .docx, or a cloud copy. What you see is the extracted prose and any small embedded images the reader could pull from word/media.",
          "Classic binary Word files are a different path — see [.doc](/open/doc/). OpenDocument text is [.odt](/open/odt/).",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-docx-without-word",
    ],
  },

  doc: {
    h1: "Open a .DOC file in your browser",
    steps: [
      "Drop the .doc or use Choose file. Filelathe treats pre-2007 Word files as OLE Compound Files and reads them in the tab.",
      "It reads the WordDocument stream and, when the piece table is present, uses that table to recover the prose.",
      "The text opens in the document viewer — a readable document, not a hex dump. If the piece table is missing, it scrapes readable text from the stream instead.",
    ],
    can: [
      "Recover body text from the WordDocument stream, using the piece table when Word wrote one.",
      "Show that prose in the same document viewer used for Markdown, up to about 100,000 characters.",
      "Fall back to a scrape of readable text, or to the OLE stream list, when the piece table is not usable.",
    ],
    cant: [
      "Show images, drawings, or Word formatting. A .doc preview is text only.",
      "Edit the file or save a .doc or .docx.",
      "Unlock password-protected or corrupt documents. Those stay unreadable rather than being guessed.",
    ],
    faqs: [
      {
        q: "Can I open an old .doc without Word?",
        a: "Yes. Filelathe reads the OLE container locally and pulls text from the WordDocument stream. You do not install Office.",
      },
      {
        q: "Is a .doc opened the same way as a .docx?",
        a: "No. A .doc is an OLE Compound File, not a ZIP. A .docx is read from word/document.xml and can include word/media images. A .doc view is the recovered prose only.",
      },
      {
        q: "Why might some text be missing or jumbled?",
        a: "Text comes from the piece table when that table is intact. If it is missing, Filelathe scrapes readable runs from the stream, which can miss or reorder pieces. Formatting is not restored either way.",
      },
      {
        q: "Can I convert .doc to PDF or DOCX here?",
        a: "No. The page views the recovered text. It does not export a PDF or a .docx.",
      },
    ],
    sections: [
      {
        heading: "How to open a .doc file without Word",
        paragraphs: [
          "Drop the file or use Choose file. Filelathe sniffs the OLE container, reads WordDocument, and opens the prose in the document viewer. No desktop Word required.",
          "For a modern package with images, use the [.docx](/open/docx/) page instead. This path does not read word/document.xml.",
        ],
      },
      {
        heading: "Open a classic .doc on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Use the Filelathe site in the browser you already have. Choose file works on a Chromebook, Mac, or iPad; drop works on the desktop. There is no plug-in and no Office install.",
        ],
      },
      {
        heading: "Does my .doc get uploaded?",
        paragraphs: [
          uploaded(
            "The OLE file is parsed in your tab, including the WordDocument stream.",
          ),
        ],
      },
      {
        heading: "View vs convert: what a .doc preview keeps local",
        paragraphs: [
          "You are viewing recovered text, not converting the binary into another Office format. Nothing is written back to the .doc.",
          "The same local idea applies to [.xls](/open/xls/) and [.ppt](/open/ppt/), which are OLE files too, with their own viewers.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-docx-without-word",
    ],
  },

  odt: {
    h1: "Open .ODT files in your browser",
    steps: [
      "Drop the .odt or use Choose file. An OpenDocument text file is a ZIP package, and it stays in your tab.",
      "Filelathe reads content.xml locally and recovers the prose from that XML.",
      "The text opens in the document viewer so you can read it without LibreOffice.",
    ],
    can: [
      "Read content.xml in the browser and show the prose.",
      "Open the file with no LibreOffice or Word install.",
      "Fall back to the ZIP entry list if content.xml cannot be read.",
    ],
    cant: [
      "Edit or save the .odt.",
      "Match LibreOffice layout, styles, or embedded objects. The view is recovered text, capped around the first 20,000 characters.",
      "Build an image gallery. Embedded pictures are extracted for .docx, not for .odt.",
    ],
    faqs: [
      {
        q: "Can I open an ODT without LibreOffice?",
        a: "Yes. Filelathe reads content.xml from the ZIP package in your browser and shows the text in the document viewer.",
      },
      {
        q: "Does this edit the OpenDocument file?",
        a: "No. It is a reader. Changes are not written back to the .odt.",
      },
      {
        q: "How is ODT different from DOCX here?",
        a: "Both are ZIP packages opened locally. DOCX text comes from word/document.xml and can include word/media images. ODT text comes from content.xml and does not get that image gallery.",
      },
      {
        q: "Does my ODT get uploaded?",
        a: "No conversion upload. The package is read in the tab. An API call may use the filename, type, and samples to choose the viewer.",
      },
    ],
    sections: [
      {
        heading: "How to open an .odt file without LibreOffice",
        paragraphs: [
          "Drop the file or use Choose file. Filelathe opens the ZIP, reads content.xml, and shows the prose. You do not need LibreOffice, OpenOffice, or Word.",
        ],
      },
      {
        heading: "Open ODT on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Open the site in Chrome, Safari, or Firefox and use Choose file. Desktop browsers can also take a drop. The viewer is the same on each — there is no app to install.",
        ],
      },
      {
        heading: "Does my .odt get uploaded?",
        paragraphs: [
          uploaded(
            "content.xml is read in your browser after the ZIP is opened locally.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "Filelathe does not convert .odt to .docx or PDF. You get a reading view of the text. The package itself is handled in the tab.",
          "Word packages are documented on the [.docx](/open/docx/) page.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-docx-without-word",
    ],
  },

  xls: {
    h1: "View .XLS spreadsheets in your browser",
    steps: [
      "Drop the .xls or use Choose file. Excel 97–2003 workbooks are OLE Compound Files, read in your tab.",
      "SheetJS parses the BIFF workbook locally.",
      "The first sheet opens in the spreadsheet grid — the same editor used for CSV.",
    ],
    can: [
      "View the first sheet as a grid, about 100 data rows and 40 columns.",
      "Edit cells in that grid and download a CSV of what is on screen.",
      "Use the same grid you get for a CSV, without Excel installed.",
    ],
    cant: [
      "Open later sheets. Only the first sheet is loaded.",
      "Recalculate formulas. You see the values SheetJS reads, not a live Excel engine.",
      "Show charts. Chart caches are read from .xlsx only.",
      "Save an .xls. Download CSV writes a CSV, not a workbook. Password-protected books are not unlocked.",
    ],
    faqs: [
      {
        q: "Can I open an Excel 97–2003 .xls file in the browser?",
        a: "Yes. Filelathe parses the BIFF workbook with SheetJS in your tab and opens the first sheet in the grid.",
      },
      {
        q: "Which sheet do I see?",
        a: "The first sheet only, trimmed to about 100 data rows and 40 columns. Other sheets stay in the file.",
      },
      {
        q: "Can I edit the cells?",
        a: "You can edit the grid and download a CSV. That does not modify the original .xls.",
      },
      {
        q: "Are charts or macros included?",
        a: "No. Classic .xls opens as a value grid. Macros are not run. Charts are only surfaced for .xlsx, and only when chart caches exist.",
      },
    ],
    sections: [
      {
        heading: "How to open a .xls file without Excel",
        paragraphs: [
          "Drop the workbook or use Choose file. Filelathe reads the OLE container, parses BIFF with SheetJS, and shows the first sheet. No Excel install.",
          "A modern .xlsx uses a different reader — see [view .xlsx](/open/xlsx/). Plain exports can also be opened as [.csv](/open/csv/).",
        ],
      },
      {
        heading: "Open XLS on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Use Choose file on a Chromebook, Mac, or iPad, or drop the file on a desktop. The grid runs in the browser you already have.",
        ],
      },
      {
        heading: "Does my .xls get uploaded?",
        paragraphs: [
          uploaded(
            "SheetJS reads the BIFF workbook in your tab. The file is not sent away to be converted.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "The grid is a view of the first sheet plus an optional CSV download of those cells. Filelathe does not produce a new .xls or .xlsx.",
          "Formula cells show stored values. They are not recalculated in the browser.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "view-excel-files-in-the-browser",
    ],
  },

  xlsx: {
    h1: "View .XLSX spreadsheets in your browser",
    steps: [
      "Drop the .xlsx or use Choose file. Parsing runs in the browser; the workbook is not uploaded to a converter.",
      "Filelathe opens the first sheet in the spreadsheet editor.",
      "When DrawingML chart caches exist under xl/charts, those charts are shown as bar graphs — first series only, up to 4 charts.",
    ],
    can: [
      "View the first sheet as a grid, about 100 data rows and 40 columns.",
      "See up to 4 charts as bar graphs when the workbook stored cached values in xl/charts.",
      "Edit the grid and download a CSV of the cells on screen.",
    ],
    cant: [
      "Save an .xlsx or run Excel’s formula engine. You see values SheetJS reads.",
      "Open sheets after the first, pivot tables, or sparklines.",
      "Draw a chart that has no cached values, or chart types other than a bar graph of the first series.",
      "Unlock a password-protected workbook.",
    ],
    faqs: [
      {
        q: "How do I view an XLSX without Excel?",
        a: "Drop it on Filelathe or use Choose file. The first sheet opens in a grid in your browser. No Office install and no signup.",
      },
      {
        q: "Can I edit the workbook?",
        a: "You can change cells in the grid and download a CSV. The original .xlsx is not rewritten.",
      },
      {
        q: "Will formulas recalculate?",
        a: "No. The grid shows the values read from the file. It is not a live calculation engine.",
      },
      {
        q: "How are charts shown?",
        a: "If xl/charts contains cached series data, Filelathe draws up to 4 bar graphs from the first series of each chart. Charts without cached values are skipped. Classic .xls does not use this path.",
      },
      {
        q: "Does my XLSX get uploaded?",
        a: "The workbook is parsed in the tab. It is not sent to a conversion site. Choosing the window may send the filename, type, and samples to the API.",
      },
    ],
    sections: [
      {
        heading: "How to open an .xlsx file without Excel",
        paragraphs: [
          "Use Choose file or drop the workbook. Filelathe reads it locally and opens the first sheet in the spreadsheet grid. You do not need Excel or a Microsoft account.",
          "Excel 97–2003 files use the BIFF reader on the [.xls](/open/xls/) page. CSV exports use the [.csv](/open/csv/) viewer.",
        ],
      },
      {
        heading: "Open XLSX on a Chromebook, Mac, or iPad",
        paragraphs: [
          "The site works in the browser. On a Chromebook, Mac, or iPad, use Choose file. A desktop drop works too. There is no add-in to install.",
        ],
      },
      {
        heading: "Does my .xlsx get uploaded?",
        paragraphs: [
          uploaded(
            "Sheet parsing and chart-cache reads happen in your browser.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "You are not converting the workbook to PDF or to Google Sheets. The view is the first sheet, optional bar graphs from chart caches, and a CSV download if you want the grid as text.",
          "That CSV is the cells on screen. It is not a round-trip of the .xlsx.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "view-excel-files-in-the-browser",
    ],
  },

  ppt: {
    h1: "Open a .PPT file in your browser",
    steps: [
      "Drop the .ppt or use Choose file. PowerPoint 97–2003 files are OLE Compound Files, sniffed locally.",
      "Filelathe lists streams such as PowerPoint Document.",
      "Recoverable slide text can be peeked from those streams. Slide graphics are not drawn — a .pptx uses the canvas viewer instead.",
    ],
    can: [
      "List the OLE streams in the archive browser, including PowerPoint Document.",
      "Peek recoverable text from the container without PowerPoint installed.",
    ],
    cant: [
      "Render slide graphics, layouts, or animations. This is not a slideshow.",
      "Edit the deck or export PDF.",
      "Use the pptx-wasm canvas. That renderer is for [.pptx](/open/pptx/) only.",
    ],
    faqs: [
      {
        q: "Can I open a classic .ppt online?",
        a: "Yes, as an OLE container. Filelathe lists streams such as PowerPoint Document and can peek recoverable text. It does not draw the slides.",
      },
      {
        q: "Will I see the slides?",
        a: "Not as graphics. Classic .ppt stays on the archive browser. For shapes, images, and charts on a canvas, open a .pptx.",
      },
      {
        q: "What should I use for a full slideshow?",
        a: "A .pptx file. Filelathe renders those with pptx-wasm in the tab. A .ppt is not converted into a .pptx here.",
      },
      {
        q: "Is the .ppt uploaded?",
        a: "No. The OLE container is read in your browser. An API call may use the filename, type, and samples to choose the tool.",
      },
    ],
    sections: [
      {
        heading: "How to open a .ppt file without PowerPoint",
        paragraphs: [
          "Drop the file or use Choose file. Filelathe sniffs the OLE container and lists streams such as PowerPoint Document, with a peek of recoverable text. You do not install PowerPoint.",
          "If you need the slides themselves, export or save as .pptx and open that on the [PPTX page](/open/pptx/). Filelathe does not perform that conversion.",
        ],
      },
      {
        heading: "Open PPT on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Open the site and use Choose file on a Chromebook, Mac, or iPad. You get the stream list and any peeked text, not a slide canvas. The same limit applies on every platform.",
        ],
      },
      {
        heading: "Does my .ppt get uploaded?",
        paragraphs: [
          uploaded(
            "The compound file is inspected in your tab.",
          ),
        ],
      },
      {
        heading: "View vs convert: what a .ppt peek keeps local",
        paragraphs: [
          "There is no convert-to-PDF and no convert-to-pptx step. The local result is the OLE listing and recoverable text.",
          "Modern decks are a separate viewer: [.pptx](/open/pptx/).",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-powerpoint-online",
    ],
  },

  pptx: {
    h1: "Open .PPTX slides in your browser",
    steps: [
      "Drop the .pptx or use Choose file. Filelathe checks the ZIP package in your tab for ppt/slides/slide parts.",
      "pptx-wasm renders the deck to a canvas in the browser.",
      "Move between slides with the on-page controls. Shapes, images, and charts render locally. No Office install and no upload to a converter.",
    ],
    can: [
      "Navigate slides on a canvas rendered by pptx-wasm.",
      "See shapes, images, and charts that the renderer can draw from the package.",
      "Keep the file in the tab, with no PowerPoint install.",
    ],
    cant: [
      "Edit slides or export a new .pptx or PDF.",
      "Guarantee animations, transitions, embedded video, or every SmartArt.",
      "Open a classic .ppt this way. Those stay on the OLE listing — see [.ppt](/open/ppt/).",
    ],
    faqs: [
      {
        q: "How do I open a PowerPoint file in the browser?",
        a: "Drop a .pptx or use Choose file. Filelathe renders the slides with pptx-wasm on a canvas in the tab. No PowerPoint and no signup.",
      },
      {
        q: "What gets drawn on the canvas?",
        a: "Shapes, images, and charts that pptx-wasm can read from the package. If the package has no slide parts, you get the ZIP listing instead of a blank viewer.",
      },
      {
        q: "Can I edit, or play animations?",
        a: "No. You can move between slides. Animations, transitions, and editing are not part of this viewer.",
      },
      {
        q: "Does the deck get uploaded?",
        a: "The package stays in the browser for rendering. It is not sent to a conversion site. Choosing the window may send the filename, type, and samples to the API.",
      },
    ],
    sections: [
      {
        heading: "How to open a .pptx file without PowerPoint",
        paragraphs: [
          "Open Filelathe and drop the deck, or use Choose file. The canvas viewer walks the slides in your tab. You do not need PowerPoint, Keynote, or an account.",
          "A 97–2003 .ppt is not rendered this way. That format is listed on the [.ppt](/open/ppt/) page.",
        ],
      },
      {
        heading: "Open PPTX on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Use the site in Chrome, Safari, or Firefox. Choose file covers Chromebook, Mac, and iPad; drop covers the desktop. The wasm renderer runs locally in that browser.",
        ],
      },
      {
        heading: "Does my .pptx get uploaded?",
        paragraphs: [
          uploaded(
            "pptx-wasm draws the slides in your tab from the package you opened.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "Filelathe does not convert the deck to PDF, video, or images for download. You view the slides on the canvas. The package is not rewritten.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-powerpoint-online",
    ],
  },

  zip: {
    h1: "Open .ZIP files in your browser",
    steps: [
      "Drop the .zip or use Choose file. Filelathe reads the ZIP directory in your browser.",
      "You get an entry list with sizes.",
      "Click an inner file — text, image, PDF, or a nested archive — to open it in its own window. The bytes are not uploaded to be converted.",
    ],
    can: [
      "List entries and sizes from the ZIP directory, up to 200 names in the preview.",
      "Open an inner file in its own viewer when Filelathe knows that type, including a nested archive.",
    ],
    cant: [
      "Create, rename, or recompress the archive.",
      "Unlock a password-protected ZIP.",
      "Inflate entries without a cap. Decompressed output is limited (32MB) so a zip bomb stops instead of filling the tab.",
    ],
    faqs: [
      {
        q: "Can I browse a ZIP without extracting it to disk?",
        a: "Yes. Filelathe reads the directory in your browser and lists entries with sizes. Nothing is unpacked onto your drive.",
      },
      {
        q: "Can I open a file inside the ZIP?",
        a: "Yes. Choose an entry and it opens in its own window — for example text, an image, a PDF, or another archive. A .docx inside a ZIP is still a Word package; the DOCX viewer reads word/document.xml when you open that file on its own.",
      },
      {
        q: "Is the archive uploaded?",
        a: "No. Listing and extraction run in the tab. An API call may use the filename, type, and samples to choose a tool for an inner file.",
      },
      {
        q: "What will not open?",
        a: "Password-protected ZIPs are not unlocked. The preview lists at most 200 entries, and decompression stops at the 32MB guard.",
      },
    ],
    sections: [
      {
        heading: "How to open a .zip file without an archiver",
        paragraphs: [
          "Drop the archive or use Choose file. Filelathe reads the central directory locally and lists names and sizes. Click a member to view it. No unzip utility and no upload.",
          "Office packages are ZIPs with a fixed layout. A file you already know is Word is better opened as [.docx](/open/docx/), Excel as [.xlsx](/open/xlsx/), or PowerPoint as [.pptx](/open/pptx/).",
        ],
      },
      {
        heading: "Open ZIP on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Use Choose file in the browser on a Chromebook, Mac, or iPad. Desktop browsers also accept a drop. The listing runs in the tab, so there is no app to install.",
        ],
      },
      {
        heading: "Does my .zip get uploaded?",
        paragraphs: [
          uploaded(
            "The directory is read in your browser, and an inner file is extracted in the tab when you open it.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "Filelathe does not rehost the archive or convert it to another container. You view the listing and open members locally. There is no download-all step.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-docx-without-word",
    ],
  },

  tar: {
    h1: "Open .TAR archives in your browser",
    steps: [
      "Drop the .tar or use Choose file. Filelathe parses ustar and posix tar headers in the browser.",
      "Members are listed with sizes. Small text files can be sampled in the preview.",
      "Open any entry in its own window. There is no extract-to-disk step and no upload.",
    ],
    can: [
      "List ustar/posix members and sizes, up to 200 names.",
      "Sample small text members and open an entry in its own window.",
    ],
    cant: [
      "Write a new tar or unpack the archive onto your disk.",
      "Honor pax and GNU extended headers. Those records are skipped, so some long names may not list.",
      "Open a gzip layer by itself. A .tar.gz belongs on the [.tgz](/open/tgz/) page.",
    ],
    faqs: [
      {
        q: "Can I open a .tar file online?",
        a: "Yes. Filelathe parses ustar and posix headers in your browser, lists members, and opens an entry on click.",
      },
      {
        q: "Which tar formats work?",
        a: "ustar and posix. Pax and GNU extended-header records are skipped, so unusual long filenames may be missing from the list.",
      },
      {
        q: "Can I open one member without unpacking to disk?",
        a: "Yes. Choosing an entry opens that file in its own window. The archive is not extracted onto your drive.",
      },
      {
        q: "Is the tar uploaded?",
        a: "No. Headers are parsed in the tab. An API call may use the filename, type, and samples to choose a viewer for an entry.",
      },
    ],
    sections: [
      {
        heading: "How to open a .tar file without a terminal",
        paragraphs: [
          "Drop the archive or use Choose file. Filelathe walks the 512-byte headers locally and lists members. Click one to view it. You do not need tar on the command line.",
        ],
      },
      {
        heading: "Open TAR on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Choose file works in the browser on a Chromebook, Mac, or iPad. There is no tar binary to install. A gzipped tar should be opened as [.tgz](/open/tgz/) — the name .tar.gz is detected as that.",
        ],
      },
      {
        heading: "Does my .tar get uploaded?",
        paragraphs: [
          uploaded(
            "The tar headers and the member you open are handled in your browser.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "This is a browser listing, not a convert-to-zip service. Members you open are viewed locally. The archive is not rewritten.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-docx-without-word",
    ],
  },

  gz: {
    h1: "Open .GZ files in your browser",
    steps: [
      "Drop the .gz or use Choose file. Gzip wraps a single file, and the bytes stay in your tab.",
      "Filelathe decompresses it with the browser DecompressionStream.",
      "The inner file — text, JSON, or a tarball — opens in its own window.",
    ],
    can: [
      "Decompress one gzip member locally with DecompressionStream.",
      "Open the inner file in its own window when it is text, JSON, or a tarball.",
    ],
    cant: [
      "Browse several files inside a plain .gz. Gzip is one member. A multi-file archive is [.tar.gz / .tgz](/open/tgz/) or [.zip](/open/zip/).",
      "Recompress or edit the gzip.",
      "Treat gzip as encryption. There is no password to enter; a corrupt stream fails instead.",
    ],
    faqs: [
      {
        q: "What does Filelathe do with a .gz file?",
        a: "It decompresses the single gzip member in your browser with DecompressionStream and opens the inner file.",
      },
      {
        q: "Can it open a .tar.gz?",
        a: "A name ending in .tar.gz or .tgz is opened as a gzipped tar: gunzip, then the member list. Use the .tgz page for that. A plain .gz is one inner file.",
      },
      {
        q: "Is gzip decompressed locally?",
        a: "Yes. DecompressionStream runs in the tab. The file is not uploaded to be unpacked.",
      },
      {
        q: "Can I recompress or edit the archive?",
        a: "No. You can view the inner file. Filelathe does not write a new .gz.",
      },
    ],
    sections: [
      {
        heading: "How to open a .gz file without gzip",
        paragraphs: [
          "Drop the file or use Choose file. Filelathe inflates the gzip stream in the browser and opens whatever was inside — one file, not a directory listing.",
        ],
      },
      {
        heading: "Open GZ on a Chromebook, Mac, or iPad",
        paragraphs: [
          "Choose file in Chrome, Safari, or Firefox. No gzip binary and no install. If the name is .tar.gz, open it as a [gzipped tar](/open/tgz/) so you get the member list.",
        ],
      },
      {
        heading: "Does my .gz get uploaded?",
        paragraphs: [
          uploaded(
            "Decompression uses the browser DecompressionStream in your tab.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "Filelathe views the decompressed file. It does not upload the .gz to a conversion API and it does not hand you a recompressed archive.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-docx-without-word",
    ],
  },

  tgz: {
    h1: "Open .TAR.GZ files in your browser",
    steps: [
      "Drop the .tgz or .tar.gz, or use Choose file. Filelathe detects that name as a gzipped tar.",
      "The gzip layer is decompressed with DecompressionStream, then the tar inside is parsed.",
      "Members are listed so you can open individual files without a terminal.",
    ],
    can: [
      "Gunzip a .tar.gz or .tgz locally, then list the tar members.",
      "Open one member in its own window. ustar and posix headers are the ones that list.",
    ],
    cant: [
      "Unpack the archive onto your disk or build a new .tgz.",
      "Show pax or GNU extended headers. Those records are skipped.",
      "Treat a plain .gz (one file, not a tar) as a member list — that is the [.gz](/open/gz/) path.",
    ],
    faqs: [
      {
        q: "How do I open a .tar.gz or .tgz in the browser?",
        a: "Drop it on Filelathe or use Choose file. The gzip layer is inflated in the tab, then the tar members are listed.",
      },
      {
        q: "What is the difference between .gz and .tgz here?",
        a: "A plain .gz decompresses to one inner file. A .tgz or a name ending in .tar.gz is gunzipped and then listed as a tar.",
      },
      {
        q: "Can I open a single file from the archive?",
        a: "Yes. Click a member to open it in its own window. The rest of the archive is not written to disk.",
      },
      {
        q: "Does the archive leave my device?",
        a: "Decompression and the tar parse run in the browser. The archive is not uploaded to be extracted. An API call may use the filename, type, and samples to choose a viewer.",
      },
    ],
    sections: [
      {
        heading: "How to open a .tar.gz file without a terminal",
        paragraphs: [
          "Use Choose file or drop the archive. Filelathe gunzips with DecompressionStream and then reads the tar headers. You get a member list instead of a shell.",
        ],
      },
      {
        heading: "Open TAR.GZ on a Chromebook, Mac, or iPad",
        paragraphs: [
          "The site works in the browser you already have. Choose file on a Chromebook, Mac, or iPad. No tar or gzip install. A plain .tar without gzip is the [.tar](/open/tar/) page.",
        ],
      },
      {
        heading: "Does my .tar.gz get uploaded?",
        paragraphs: [
          uploaded(
            "Both the gzip inflate and the tar parse run in your tab.",
          ),
        ],
      },
      {
        heading: "View vs convert: what stays on your device",
        paragraphs: [
          "Filelathe does not convert the tarball to a ZIP and does not upload it to an extractor. You view members locally, one file at a time.",
        ],
      },
    ],
    guides: [
      "private-in-browser-file-viewer",
      "open-docx-without-word",
    ],
  },
};
