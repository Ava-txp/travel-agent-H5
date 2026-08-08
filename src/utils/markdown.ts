/**
 * DOMPurify：基于浏览器 DOM 的 HTML 消毒库。输入不可信 HTML，输出去掉脚本、事件处理器、危险协议等后的安全 HTML。和 v-html 搭配是标配
 * marked：Markdown 解析器。将 Markdown 文本转换为 HTML。
 *
 * 使用 DOMPurify 和 marked 搭配，可以实现安全的 Markdown 渲染。
 */

import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  breaks: true, // 换行 → <br>
  gfm: true, // GFM
});

type PurifyLike = {
  sanitize?: (html: string, config?: Record<string, unknown>) => string;
};

/** DOMPurify 可能是已绑定 window 的实例，也可能是需传入 window 的工厂 */
type DomPurifyExport = PurifyLike & ((root: Window) => PurifyLike);

/**
 * DOMPurify 在无 window 时 default export 是工厂函数且没有 sanitize。
 * 浏览器下优先用实例；否则主动传入 window 再创建。
 */
const getPurify = (): PurifyLike | null => {
  const candidate = DOMPurify as unknown as DomPurifyExport;

  if (typeof candidate.sanitize === "function") {
    return candidate;
  }

  if (typeof window !== "undefined" && typeof candidate === "function") {
    try {
      return candidate(window);
    } catch {
      return null;
    }
  }

  return null;
};

/** 转义 HTML 特殊字符，供消毒不可用时的安全降级 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Markdown → HTML；消毒不可用时 Fail Closed，转义为纯文本 */
export function renderMarkdown(content: string): string {
  if (!content) return "";

  // 统一换行，避免流式/转义导致排版混乱
  const normalized = content.replace(/\r\n/g, "\n").replace(/\\n/g, "\n");
  const purify = getPurify();

  // 消毒不可用：不当 HTML 渲染，转义后保留换行
  if (!purify?.sanitize) {
    return escapeHtml(normalized).replace(/\n/g, "<br>");
  }

  // 解析：默认可能返回 Promise；这里强制同步
  const html = marked.parse(normalized, { async: false }) as string;

  return purify.sanitize(html, {
    USE_PROFILES: { html: true }, // 只允许常规 HTML 标签配置
  });
}
