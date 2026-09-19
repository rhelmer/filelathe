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
  "prompt": "…",
  "spec": { "root": "…", "elements": {}, "state": {} }
}
```

In the app, open **Saved mini-apps** and use **Propose PR** to add a file here via GitHub’s web editor (fork + pull request if you lack write access).
