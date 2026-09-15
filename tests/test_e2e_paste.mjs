import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGIN = "http://127.0.0.1:8188";
const SAMPLE = "e2e-paste-ok";
const JUNK =
  "C:\\Users\\Sam\\AppData\\Local\\Packages\\MicrosoftWindows.Client.Core_cw5n1h2txyewy\\TempState\\ScreenClip\\{804F6E43-E065-41BA-A403-D20472527A55}.png";
const UI_PATH = fileURLToPath(new URL("../web/pe_ui.js", import.meta.url));
const STATE_PATH = fileURLToPath(new URL("../web/prompt_editor_state.mjs", import.meta.url));

async function loadWorkspaceFrontend(page) {
  await page.route("**/extensions/ComfyUI-PromptEditor/pe_ui.js*", async (route) => {
    await route.fulfill({ contentType: "text/javascript", body: await readFile(UI_PATH, "utf8") });
  });
  await page.route("**/extensions/ComfyUI-PromptEditor/prompt_editor_state.mjs*", async (route) => {
    await route.fulfill({ contentType: "text/javascript", body: await readFile(STATE_PATH, "utf8") });
  });
}

async function addPromptEditor(page) {
  await page.waitForFunction(
    () => window.app && window.app.graph && window.LiteGraph && window.app.graph.add,
    null,
    { timeout: 120000 }
  );
  await page.evaluate(() => {
    const n = window.LiteGraph.createNode("XAI_PromptEditor");
    if (!n) throw new Error("LiteGraph.createNode(XAI_PromptEditor) returned null");
    window.app.graph.add(n);
    n.pos = [60, 60];
    window.app.graph.setDirtyCanvas(true, true);
  });
  await page.waitForSelector(".xai-pe-textarea", { timeout: 30000 });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
const page = await context.newPage();
page.setDefaultTimeout(120000);

try {
  await loadWorkspaceFrontend(page);
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
  await addPromptEditor(page);
  const pasteBtn = page.locator(".xai-pe-toolbar button", { hasText: /^Paste$|^✓ Pasted$|^Ctrl\+V$/ }).first();

  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, SAMPLE);
  await pasteBtn.click();
  await page.waitForTimeout(400);
  const afterPaste = await page.locator(".xai-pe-textarea").first().inputValue();
  if (afterPaste !== SAMPLE) {
    throw new Error(`expected ${JSON.stringify(SAMPLE)}, got ${JSON.stringify(afterPaste)}`);
  }

  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, JUNK);
  await pasteBtn.click();
  await page.waitForTimeout(400);
  const afterJunk = await page.locator(".xai-pe-textarea").first().inputValue();
  if (afterJunk !== SAMPLE) {
    throw new Error(`junk path overwrote editor: ${JSON.stringify(afterJunk)}`);
  }

  const deniedContext = await browser.newContext();
  const deniedPage = await deniedContext.newPage();
  deniedPage.setDefaultTimeout(120000);
  try {
    await loadWorkspaceFrontend(deniedPage);
    await deniedPage.goto(ORIGIN, { waitUntil: "domcontentloaded" });
    await addPromptEditor(deniedPage);
    const deniedButton = deniedPage.locator(".xai-pe-toolbar button", { hasText: /^Paste$/ }).first();
    await deniedButton.click();
    const deniedLabel = await deniedButton.textContent();
    const notice = await deniedPage.locator(".xai-pe-paste-notice").first().textContent();
    if (deniedLabel !== "Paste") throw new Error(`paste button changed to ${JSON.stringify(deniedLabel)}`);
    if (!notice?.includes("Chrome/Chromium") || !notice.includes("Firefox")) {
      throw new Error(`missing browser-specific permission guidance: ${JSON.stringify(notice)}`);
    }
  } finally {
    await deniedContext.close();
  }

  console.log("PASS paste is immediate when allowed and gives stable guidance when denied");
} finally {
  await browser.close();
}
