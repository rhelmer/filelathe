/**
 * Regression: Tabs panes must be wrapped in Radix Tabs.Content so only the
 * active tab's children render. Upstream @json-render/shadcn skips this.
 *
 *   pnpm exec tsx scripts/spec-tabs-smoke.tsx
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { StateProvider } from "@json-render/react";
import { SpecTabs } from "../src/SpecTabs";

const html = renderToString(
  createElement(
    StateProvider,
    { initialState: { activeTab: "theory" } },
    createElement(
      SpecTabs,
      {
        props: {
          tabs: [
            { label: "Theory", value: "theory" },
            { label: "Clues", value: "clues" },
            { label: "Hex", value: "hex" },
          ],
          defaultValue: "theory",
          value: null,
        },
        emit: () => {},
      },
      createElement("div", null, "THEORY_PANE"),
      createElement("div", null, "CLUES_PANE"),
      createElement("div", null, "HEX_PANE"),
    ),
  ),
);

const contentCount = (html.match(/data-slot="tabs-content"/g) || []).length;
if (contentCount !== 3) {
  console.error(`FAIL: expected 3 Tabs.Content wrappers, got ${contentCount}`);
  process.exit(1);
}
if (!html.includes("THEORY_PANE")) {
  console.error("FAIL: active Theory pane missing");
  process.exit(1);
}
if (html.includes("HEX_PANE") || html.includes("CLUES_PANE")) {
  console.error("FAIL: inactive panes should not render without forceMount");
  process.exit(1);
}
if (!html.includes("hidden")) {
  console.error("FAIL: expected inactive Tabs.Content to be hidden");
  process.exit(1);
}

console.log("spec-tabs-smoke ok");
