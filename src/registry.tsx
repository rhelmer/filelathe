import { useRef } from "react";
import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { ArchiveBrowser } from "./ArchiveBrowser";
import { BinaryInspector } from "./BinaryInspector";
import { catalog } from "./catalog";
import { InventedViewer } from "./InventedViewer";
import { MarkdownView } from "./MarkdownView";
import { PdfViewer, VideoPlayer } from "./PdfVideo";
import { PixelEditor } from "./PixelEditor";
import { SlideViewer } from "./SlideViewer";
import { Spreadsheet } from "./Spreadsheet";
import { TrackerPlayer } from "./TrackerPlayer";
import { usePersistedMedia } from "./use-persisted-media";
import { WebPageViewer } from "./WebPageViewer";

function Metric({
  props,
}: {
  props: {
    label: string;
    value: string;
    change: string | null;
    changeType: "positive" | "negative" | "neutral" | null;
    prefix: string | null;
    suffix: string | null;
  };
}) {
  const changeColor =
    props.changeType === "positive"
      ? "text-emerald-600"
      : props.changeType === "negative"
        ? "text-red-600"
        : "text-muted-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">
        {props.prefix}
        {props.value}
        {props.suffix}
      </div>
      {props.change ? (
        <div className={`mt-1 text-sm ${changeColor}`}>{props.change}</div>
      ) : null}
    </div>
  );
}

function BarGraph({
  props,
}: {
  props: {
    title: string | null;
    data: Array<{ label: string; value: number }>;
  };
}) {
  const max = Math.max(...props.data.map((d) => d.value), 1);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      {props.title ? (
        <div className="mb-3 text-sm font-medium">{props.title}</div>
      ) : null}
      <div className="flex h-40 items-end gap-2">
        {props.data.map((item) => (
          <div
            key={item.label}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div
              className="w-full rounded-t-md bg-primary/80"
              style={{ height: `${(item.value / max) * 100}%` }}
              title={`${item.label}: ${item.value}`}
            />
            <span className="text-[10px] text-muted-foreground">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudioPlayer({
  props,
  emit,
}: {
  props: {
    src: string;
    title: string | null;
    autoplay: boolean | null;
  };
  emit: (event: string) => void;
}) {
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  usePersistedMedia(mediaRef, props.src);

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
      {props.title ? (
        <div className="text-sm font-medium">{props.title}</div>
      ) : null}
      <audio
        ref={mediaRef}
        className="w-full"
        controls
        src={props.src}
        autoPlay={Boolean(props.autoplay)}
        preload="metadata"
        onPlay={() => emit("play")}
        onPause={() => emit("pause")}
        onEnded={() => emit("ended")}
      >
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

export const { registry } = defineRegistry(catalog, {
  components: {
    ...shadcnComponents,
    Metric,
    BarGraph,
    AudioPlayer,
    PixelEditor,
    Spreadsheet,
    PdfViewer,
    SlideViewer,
    VideoPlayer,
    TrackerPlayer,
    MarkdownView,
    WebPageViewer,
    ArchiveBrowser,
    BinaryInspector,
    InventedViewer,
  },
  actions: {
    formSubmit: async () => {},
  },
});
