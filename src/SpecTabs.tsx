import { Children, useState, type ReactNode } from "react";
import { useBoundProp } from "@json-render/react";
import { Tabs as RadixTabs } from "radix-ui";

type TabItem = { label: string; value: string };

/**
 * json-render shadcn Tabs updates the trigger highlight but renders pane
 * children without Radix Tabs.Content, so every pane stays visible. Wrap each
 * child in Tabs.Content keyed by the matching tab value (by index).
 */
export function SpecTabs({
  props,
  children,
  bindings,
  emit,
}: {
  props: {
    tabs: TabItem[];
    defaultValue: string | null;
    value: string | null;
  };
  children?: ReactNode;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}) {
  const tabs = props.tabs ?? [];
  const [boundValue, setBoundValue] = useBoundProp(
    props.value ?? undefined,
    bindings?.value,
  );
  const [localValue, setLocalValue] = useState(
    () => props.defaultValue ?? tabs[0]?.value ?? "",
  );
  const isBound = Boolean(bindings?.value);
  const value = isBound
    ? (boundValue ?? tabs[0]?.value ?? "")
    : localValue;
  const setValue = isBound ? setBoundValue : setLocalValue;
  const panes = Children.toArray(children);

  return (
    <RadixTabs.Root
      data-slot="tabs"
      data-orientation="horizontal"
      orientation="horizontal"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        emit("change");
      }}
      className="group/tabs flex flex-col gap-2"
    >
      <RadixTabs.List
        data-slot="tabs-list"
        data-variant="default"
        className="group/tabs-list inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground"
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            data-slot="tabs-trigger"
            value={tab.value}
            className="relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab, index) => (
        <RadixTabs.Content
          key={tab.value}
          data-slot="tabs-content"
          value={tab.value}
          className="outline-none"
        >
          {panes[index] ?? null}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
