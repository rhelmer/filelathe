import { useRef } from "react";
import { safeHttpUrl } from "./resource-utils";
import { usePersistedMedia } from "./use-persisted-media";

function frameSrc(src: string): string | null {
  if (src.startsWith("blob:")) return src;
  return safeHttpUrl(src);
}

export function PdfViewer({
  props,
}: {
  props: {
    src: string;
    title: string | null;
  };
}) {
  const src = frameSrc(props.src);
  return (
    <div className="space-y-2">
      {props.title ? (
        <div className="text-sm font-medium">{props.title}</div>
      ) : null}
      {src ? (
        <iframe
          title={props.title ?? "PDF"}
          src={src}
          className="h-[420px] w-full rounded-lg border bg-white"
        />
      ) : (
        <p className="text-sm text-muted-foreground">No PDF loaded.</p>
      )}
      {src ? (
        <a
          className="text-xs text-primary underline"
          href={src}
          target="_blank"
          rel="noreferrer"
        >
          Open in new tab
        </a>
      ) : null}
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
