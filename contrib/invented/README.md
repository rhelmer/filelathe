# Invented mini-app contributions

Haiku-invented **mini-apps** for unknown file types, contributed from local Filelathe sessions.

Each file is JSON. The interactive UI is stored as a [json-render](https://json-render.dev) **Spec** (`spec` field):

```json
{
  "version": 1,
  "source": "filelathe",
  "inventedBy": "haiku",
  "extension": "toml",
  "mimeType": "text/plain",
  "filenameHint": "example.toml",
  "scope": "extension",
  "contentsRedacted": true,
  "prompt": "(invent prompt redacted — contained file sample/hex; regenerate locally)",
  "spec": { "root": "…", "elements": {}, "state": {} }
}
```

**Privacy (important):** Dropped-file bytes must never land in a public PR.

- In the app, **Propose PR** / **Download** export a scrubbed payload only: empty `state` bodies (sample/hex/summary/etc.), cleared Textarea/Markdown string props, anonymized `example.<ext>` filename, and a **redacted invent prompt stub** (the live prompt embeds sample + hex and is never pasted).
- Specs are also scrubbed when saved to browser storage; at open time `hydrateInventedSpec` refills body/hex from the *current* drop.
- Export refuses to copy/download if a leak check still finds sample-like content.
- Reviewers should still skim `spec` for leftovers (Alert/Badge text can quote short facts).

**Dialect vs extension:** A format that shares an extension with a broader type (sitemap, RSS/Atom, SVG-in-XML, robots.txt) is saved as `scope: "dialect"` with a `dialect` id such as `xml-sitemap`, and proposed as `xml-sitemap.json`. Do not merge that Spec as the generic `.xml` template.

In the app, open **Saved mini-apps** and use **Propose PR** to add a file here via GitHub’s web editor (fork + pull request if you lack write access).
