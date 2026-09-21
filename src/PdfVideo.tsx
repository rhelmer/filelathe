import { useRef } from "react";
import { usePersistedMedia } from "./use-persisted-media";

export function PdfViewer({
  props,
}: {
  props: {
    src: string;
    title: string | null;
  };
}) {
  return (
    <div className="space-y-2">
      {props.title ? (
        <div className="text-sm font-medium">{props.title}</div>
      ) : null}
      <iframe
        title={props.title ?? "PDF"}
        src={props.src}
        className="h-[420px] w-full rounded-lg border bg-white"
      />
      <a
        className="text-xs text-primary underline"
        href={props.src}
        target="_blank"
        rel="noreferrer"
      >
        Open in new tab
      </a>
    </div>
  );
}

export function VideoPlayer({
  props,
}: {
  props: {
    src: string;
    title: string | null;
  };
}) {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  usePersistedMedia(mediaRef, props.src);

  return (
    <div className="space-y-2">
      {props.title ? (
        <div className="text-sm font-medium">{props.title}</div>
      ) : null}
      <video
        ref={mediaRef}
        className="w-full rounded-lg border bg-black"
        controls
        src={props.src}
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}
