"use client";

import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/common";
import { Check, Copy } from "lucide-react";
import "highlight.js/styles/github-dark.css";

// A syntax-highlighted code block with a language label and copy button. Used by
// both the lesson renderer and the chat renderer so code looks the same
// everywhere. Highlights on the client; re-runs as `code` grows during streaming.
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      // Use the fenced language when highlight.js knows it; otherwise let it
      // auto-detect. `.value` is HTML-escaped by highlight.js, so it's safe.
      const result =
        lang && hljs.getLanguage(lang)
          ? hljs.highlight(code, { language: lang })
          : hljs.highlightAuto(code);
      el.innerHTML = result.value;
    } catch {
      el.textContent = code;
    }
  }, [code, lang]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-white/10 bg-[#0d1117] font-sans">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-white/45">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-white/55 transition-colors hover:bg-white/10 hover:text-white/85"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[13px] leading-relaxed">
        <code ref={ref} className={`hljs bg-transparent p-0 language-${lang ?? ""}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
