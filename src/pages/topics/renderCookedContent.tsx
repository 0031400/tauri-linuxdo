import type { ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function normalizeLinuxDoUrl(url: string) {
  if (!url) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://linux.do${url}`;
  return url;
}

export function renderCookedContent(
  cookedHtml: string,
  handlers: {
    onOpenImage: (url: string) => void;
    onOpenLink: (url: string) => void;
  },
): ReactNode[] {
  const doc = new DOMParser().parseFromString(`<div id="cooked-root">${cookedHtml}</div>`, "text/html");
  const root = doc.getElementById("cooked-root");
  if (!root) return [];

  let seq = 0;
  const nextKey = () => `cooked-${seq++}`;

  const renderChildren = (node: ParentNode): ReactNode[] =>
    Array.from(node.childNodes)
      .map((child) => renderNode(child))
      .filter((item): item is ReactNode => item !== null);

  const renderImage = (element: HTMLImageElement, key: string, className?: string) => {
    const src = normalizeLinuxDoUrl(element.getAttribute("src") ?? "");
    const alt = element.getAttribute("alt") ?? "";
    const title = element.getAttribute("title") ?? "";
    const isEmoji = element.classList.contains("emoji");
    const width = element.getAttribute("width");
    const height = element.getAttribute("height");

    if (isEmoji) {
      return (
        <img
          key={key}
          src={src}
          alt={alt}
          title={title}
          className={className ?? "mx-0.5 inline h-5 w-5 align-text-bottom"}
          loading="lazy"
        />
      );
    }

    return (
      <button
        key={key}
        type="button"
        onClick={() => {
          if (src) handlers.onOpenImage(src);
        }}
        className="my-2 block w-full cursor-zoom-in overflow-hidden rounded-xl"
      >
        <img
          src={src}
          alt={alt}
          title={title}
          width={width ? Number(width) : undefined}
          height={height ? Number(height) : undefined}
          className="h-auto max-w-full rounded-xl"
          loading="lazy"
        />
      </button>
    );
  };

  const renderNode = (node: Node): ReactNode | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text) return null;
      return text;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (tag === "script" || tag === "style") return null;

    if (tag === "div" && element.classList.contains("lightbox-wrapper")) {
      const anchor = element.querySelector("a.lightbox") as HTMLAnchorElement | null;
      const image = element.querySelector("img") as HTMLImageElement | null;
      const filename = element.querySelector(".filename")?.textContent?.trim();
      const info = element.querySelector(".informations")?.textContent?.trim();
      const imageUrl = normalizeLinuxDoUrl(
        anchor?.getAttribute("href") ?? image?.getAttribute("src") ?? "",
      );

      return (
        <figure key={nextKey()} className="my-3">
          {image ? (
            <button
              type="button"
              onClick={() => {
                const src = imageUrl || image.getAttribute("src") || "";
                if (src) handlers.onOpenImage(src);
              }}
              className="block w-full cursor-zoom-in overflow-hidden rounded-xl"
            >
              <img
                src={normalizeLinuxDoUrl(image.getAttribute("src") ?? "")}
                alt={image.getAttribute("alt") ?? ""}
                title={image.getAttribute("title") ?? ""}
                width={image.getAttribute("width") ? Number(image.getAttribute("width")) : undefined}
                height={image.getAttribute("height") ? Number(image.getAttribute("height")) : undefined}
                className="h-auto max-w-full rounded-xl"
                loading="lazy"
              />
            </button>
          ) : null}
          {!image && imageUrl ? (
            <button
              type="button"
              onClick={() => handlers.onOpenImage(imageUrl)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
            >
              View image
            </button>
          ) : null}
          {filename || info ? (
            <figcaption className="mt-1 text-xs text-slate-500">
              {[filename, info].filter(Boolean).join(" | ")}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    if (tag === "img") {
      return renderImage(element as HTMLImageElement, nextKey());
    }

    if (tag === "a") {
      const href = normalizeLinuxDoUrl((element as HTMLAnchorElement).getAttribute("href") ?? "");
      const children = renderChildren(element);
      return (
        <a
          key={nextKey()}
          href={href}
          onClick={(event) => {
            event.preventDefault();
            if (href) handlers.onOpenLink(href);
          }}
          className="text-sky-700 underline"
        >
          {children.length > 0 ? children : href}
        </a>
      );
    }

    if (tag === "br") return <br key={nextKey()} />;

    if (tag === "pre") {
      const codeElement = element.querySelector("code");
      const rawClass = codeElement?.getAttribute("class") ?? "";
      const language =
        rawClass.match(/(?:lang|language)-([a-z0-9_+-]+)/i)?.[1]?.toLowerCase() ?? "text";
      const codeText = codeElement?.textContent ?? element.textContent ?? "";

      return (
        <SyntaxHighlighter
          key={nextKey()}
          language={language}
          style={oneDark}
          PreTag="div"
          customStyle={{
            margin: "0.75rem 0",
            borderRadius: "1rem",
            padding: "1rem",
            overflow: "auto",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
          codeTagProps={{
            style: {
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
            },
          }}
        >
          {codeText}
        </SyntaxHighlighter>
      );
    }

    if (tag === "span" && element.classList.contains("discourse-local-date")) {
      const fallbackText = element.textContent ?? "";
      const text = element.getAttribute("data-email-preview") || fallbackText;
      return (
        <time key={nextKey()} dateTime={fallbackText} className="font-medium text-slate-700">
          {text}
        </time>
      );
    }

    const children = renderChildren(element);

    switch (tag) {
      case "p":
        return (
          <p key={nextKey()} className="my-3">
            {children}
          </p>
        );
      case "strong":
        return <strong key={nextKey()}>{children}</strong>;
      case "em":
        return <em key={nextKey()}>{children}</em>;
      case "blockquote":
        return (
          <blockquote key={nextKey()} className="my-3 border-l-4 border-slate-200 pl-4">
            {children}
          </blockquote>
        );
      case "code":
        return (
          <code key={nextKey()} className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">
            {children}
          </code>
        );
      case "ul":
        return (
          <ul key={nextKey()} className="my-3 list-disc space-y-1 pl-6">
            {children}
          </ul>
        );
      case "ol":
        return (
          <ol key={nextKey()} className="my-3 list-decimal space-y-1 pl-6">
            {children}
          </ol>
        );
      case "li":
        return <li key={nextKey()}>{children}</li>;
      case "div":
        return (
          <div key={nextKey()} className="my-2">
            {children}
          </div>
        );
      default:
        return <span key={nextKey()}>{children}</span>;
    }
  };

  return renderChildren(root);
}
