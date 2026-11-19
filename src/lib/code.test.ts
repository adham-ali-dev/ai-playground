import { describe, expect, it } from "vitest";
import { codeFor, type CodeInput } from "./code";
import { extractHtml, fileNameFor } from "./html";

const input: CodeInput = {
  model: "openai/gpt-4o-mini",
  systemInstruction: "Be brief. Don't ramble.",
  temperature: 0.4,
  topP: 0.9,
  maxOutputTokens: 512,
  turns: [
    { role: "user", text: "Hi" },
    { role: "model", text: "Hello!" },
  ],
};

describe("codeFor", () => {
  it("reproduces the prompt in every language", () => {
    for (const language of ["curl", "javascript", "python"] as const) {
      const code = codeFor(language, input);
      expect(code).toContain("openai/gpt-4o-mini");
      expect(code).toContain('"temperature": 0.4');
      expect(code).toContain('"top_p": 0.9');
      expect(code).toContain('"max_tokens": 512');
      expect(code).toContain('"role": "assistant"');
      expect(code).toContain("OPENROUTER_API_KEY");
    }
  });
  it("leaves out empty system instructions", () => {
    expect(codeFor("curl", { ...input, systemInstruction: " " })).not.toContain('"system"');
  });
  it("escapes single quotes for the shell", () => {
    expect(codeFor("curl", input)).toContain("Don'\\''t");
  });
  it("produces valid JSON for JavaScript", () => {
    const code = codeFor("javascript", input);
    const json = code.slice(code.indexOf("JSON.stringify(") + 15, code.lastIndexOf("),"));
    expect(JSON.parse(json).messages).toHaveLength(3);
  });
});

describe("extractHtml", () => {
  it("takes a fenced block", () => {
    expect(extractHtml("Sure:\n```html\n<!doctype html><html><body>x</body></html>\n```\nDone")).toBe(
      "<!doctype html><html><body>x</body></html>",
    );
  });
  it("takes a bare document", () => {
    expect(extractHtml("<html><body>y</body></html>")).toBe("<html><body>y</body></html>");
  });
  it("is null without a page", () => {
    expect(extractHtml("I can't help with that.")).toBeNull();
  });
  it("names downloads", () => {
    expect(fileNameFor("Tip splitter!")).toBe("tip-splitter.html");
  });
});
