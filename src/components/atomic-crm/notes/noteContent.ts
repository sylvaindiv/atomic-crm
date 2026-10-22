import DOMPurify from "dompurify";
import { marked } from "marked";

export const sanitizeNoteHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
      "pre",
      "code",
      "hr",
      "s",
      "del",
    ],
    ALLOWED_ATTR: ["href", "title", "start"],
  });

// Stored rich notes begin with a block; historical text/Markdown stays untouched.
export const noteToHtml = (value?: string | null) =>
  sanitizeNoteHtml(
    /^\s*<(p|h[1-6]|ul|ol|blockquote|pre)(\s|>)/i.test(value ?? "")
      ? value!
      : (marked.parse(value ?? "", { async: false, breaks: true }) as string),
  );

export const noteToText = (value?: string | null) => {
  const root = document.createElement("div");
  root.innerHTML = noteToHtml(value);
  const read = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.replace(/\n/g, "") ?? "";
    }
    if (!(node instanceof Element)) return "";
    if (node.tagName === "BR") return "\n";
    if (node.tagName === "PRE") return (node.textContent ?? "") + "\n\n";
    const text = Array.from(node.childNodes).map(read).join("");
    if (node.tagName === "LI") return text.trim() + "\n";
    if (/^(P|H[1-6]|BLOCKQUOTE|PRE)$/.test(node.tagName)) {
      return text + (node.closest("li") ? "" : "\n\n");
    }
    return text;
  };
  return read(root)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[\s\u200b-\u200d\ufeff]+|[\s\u200b-\u200d\ufeff]+$/g, "");
};
