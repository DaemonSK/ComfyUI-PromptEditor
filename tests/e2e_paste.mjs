import { chromium } from "playwright";

const ORIGIN = "http://127.0.0.1:8188";
const SAMPLE = "e2e-paste-ok";
const JUNK =
  "C:\\Users\\Sam\\AppData\\Local\\Packages\\MicrosoftWindows.Client.Core_cw5n1h2txyewy\\TempState\\ScreenClip\\{804F6E43-E065-41BA-A403-D20472527A55}.png";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
const page = await context.newPage();
page.setDefaultTimeout(120000);

try {
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
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

  console.log("PASS paste inserts text and ignores ScreenClip path");
} finally {
  await browser.close();
}
