import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Office docx embeds raster/SVG images as data: URLs; defaultUrlTransform strips them. */
const DATA_IMAGE =
  /^data:image\/(?:png|jpeg|jpg|gif|webp|bmp|svg\+xml);base64,[a-z0-9+/=\s]+$/i;

export function markdownUrlTransform(url: string): string {
  const trimmed = url.trim();
  if (DATA_IMAGE.test(trimmed)) return trimmed.replace(/\s+/g, "");
  return defaultUrlTransform(trimmed);
}

export function MarkdownView({
  props,
}: {
  props: {
    markdown: string;
    title: string | null;
  };
}) {
  const source = typeof props.markdown === "string" ? props.markdown : "";
  if (!source.trim()) {
    return (
      <p className="text-sm text-muted-foreground">
        No markdown content loaded.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {props.title ? (
        <div className="text-sm font-medium">{props.title}</div>
      ) : null}
      <article className="markdown-body max-w-none space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={markdownUrlTransform}
        >
          {source}
        </ReactMarkdown>
      </article>
    </div>
  );
}
