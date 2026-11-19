/** What a request needs to reproduce a prompt. */
export interface CodeInput {
  model: string;
  systemInstruction: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  turns: { role: "user" | "model"; text: string }[];
}

export type CodeLanguage = "curl" | "javascript" | "python";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function body(input: CodeInput) {
  const messages = [
    ...(input.systemInstruction.trim()
      ? [{ role: "system", content: input.systemInstruction }]
      : []),
    ...input.turns.map((turn) => ({
      role: turn.role === "model" ? "assistant" : "user",
      content: turn.text,
    })),
  ];
  return {
    model: input.model,
    messages,
    temperature: input.temperature,
    top_p: input.topP,
    max_tokens: input.maxOutputTokens,
  };
}

function indent(text: string, spaces: number): string {
  return text.replaceAll("\n", `\n${" ".repeat(spaces)}`);
}

/** A ready-to-run request for an OpenAI-compatible chat completions endpoint. */
export function codeFor(language: CodeLanguage, input: CodeInput): string {
  const json = JSON.stringify(body(input), null, 2);
  if (language === "curl") {
    return [
      `curl ${ENDPOINT} \\`,
      `  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${json.replaceAll("'", "'\\''")}'`,
    ].join("\n");
  }
  if (language === "javascript") {
    return [
      `const response = await fetch("${ENDPOINT}", {`,
      `  method: "POST",`,
      `  headers: {`,
      `    Authorization: \`Bearer \${process.env.OPENROUTER_API_KEY}\`,`,
      `    "Content-Type": "application/json",`,
      `  },`,
      `  body: JSON.stringify(${indent(json, 2)}),`,
      `});`,
      `const data = await response.json();`,
      `console.log(data.choices[0].message.content);`,
    ].join("\n");
  }
  return [
    `import json`,
    `import os`,
    `import urllib.request`,
    ``,
    `payload = json.loads(r"""${json.replaceAll('"""', '\\"\\"\\"')}""")`,
    ``,
    `request = urllib.request.Request(`,
    `    "${ENDPOINT}",`,
    `    data=json.dumps(payload).encode(),`,
    `    headers={`,
    `        "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",`,
    `        "Content-Type": "application/json",`,
    `    },`,
    `)`,
    `with urllib.request.urlopen(request) as response:`,
    `    data = json.load(response)`,
    `print(data["choices"][0]["message"]["content"])`,
  ].join("\n");
}
