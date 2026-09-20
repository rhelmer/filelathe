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
  "contentsRedacted": true,
  "prompt": "… (sample/hex sections redacted)",
  "spec": { "root": "…", "elements": {}, "state": {} }
}
```

**Privacy:** Propose PR / Download from the app **strip dropped-file contents** (sample text, hex dumps, Textarea/Markdown bodies) and replace the real filename with `example.<ext>` before the JSON hits the clipboard. Only the mini-app structure and bindings are meant for a public PR. Reviewers should still skim `prompt` / `spec` for leftovers.

In the app, open **Saved mini-apps** and use **Propose PR** to add a file here via GitHub’s web editor (fork + pull request if you lack write access).
