import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Render a LaTeX expression to HTML string
 * @param expr LaTeX expression to render (without $ delimiters)
 * @returns HTML string
 */
function renderLatexExpr(expr: string): string {
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode: false,
      strict: 'ignore',
    });
  } catch (e) {
    console.error('Failed to render LaTeX:', expr, e);
    return expr;
  }
}

/**
 * Render text with inline LaTeX expressions (delimited by $...$)
 * @param text Text containing LaTeX expressions like "Mass ($M_\odot$)"
 * @returns HTML string with LaTeX rendered
 */
export function renderLatex(text: string): string {
  // Replace all $...$ segments with KaTeX-rendered HTML
  return text.replace(/\$([^\$]+)\$/g, (match, latex) => {
    return renderLatexExpr(latex);
  });
}

/**
 * Check if a string contains LaTeX syntax
 * @param s String to check
 * @returns true if string contains LaTeX commands or $ delimiters
 */
export function hasLatex(s: string): boolean {
  // Check for dollar signs (LaTeX delimiters) or backslash commands
  return /\$/.test(s) || /\\[a-zA-Z]+/.test(s);
}

/**
 * Render text as LaTeX if it contains LaTeX commands, otherwise return as-is
 * @param text Text to render
 * @returns HTML string if LaTeX detected, otherwise original text
 */
export function renderTextOrLatex(text: string): string | { __html: string } {
  if (hasLatex(text)) {
    return { __html: renderLatex(text) };
  }
  return text;
}
