/**
 * Shared text/caret helpers used by the block editor.
 */

/**
 * Decide whether pressing "/" should open the slash-command menu.
 * Notion-style discipline: only when the caret sits at the start of a line
 * or right after whitespace — typing "and/or", "10/5" or URLs never opens it.
 */
export function shouldOpenSlashMenu(text: string, caretIndex: number): boolean {
  if (caretIndex < 0 || caretIndex > text.length) return false;
  const prev = caretIndex === 0 ? '' : text[caretIndex - 1];
  // The "/" itself hasn't been typed yet when we evaluate the previous char,
  // so we accept: start of text, after newline, space or tab.
  if (prev === '') return true;
  return /[\s]/.test(prev);
}

/**
 * Strip a stray trigger "/" that opened the slash menu but never became
 * part of a command (the menu has its own search input).
 */
export function stripSlashTrigger(text: string, caretIndex: number): string {
  if (caretIndex <= 0 || caretIndex > text.length) return text;
  if (text[caretIndex - 1] !== '/') return text;
  return text.slice(0, caretIndex - 1) + text.slice(caretIndex);
}
