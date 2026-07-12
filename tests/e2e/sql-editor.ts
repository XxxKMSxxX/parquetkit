import type { Page } from "@playwright/test";

// The SQL editor is a CodeMirror contenteditable, not a <textarea>, so
// locator.fill()/toHaveValue() don't apply. keyboard.insertText() dispatches
// a single input event (no keydown), which sidesteps CodeMirror's keymaps
// (autocomplete-accept-on-Enter, close-brackets, …) while typing test fixtures.
// Assert on editorContent(page) with toHaveText() instead of toHaveValue().
export async function setEditorText(page: Page, text: string) {
  const editor = page.getByTestId("sql-editor");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(text);
}

export function editorContent(page: Page) {
  return page.getByTestId("sql-editor").locator(".cm-content");
}
