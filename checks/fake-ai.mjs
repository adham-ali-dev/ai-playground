// A local stand-in for the Gateway's AI proxy, so suites can exercise
// successful model calls. It never reaches a real provider.
const FAKE = `
const calls = [];
let mode = { off: false, failModel: null };
const REPLIES = {
  "openai/gpt-4o-mini": "Welcome to the support team! This week you'll shadow a senior agent, learn our ticket queues and answer your first customer by Thursday. Ask questions early and often.",
  "anthropic/claude-3.5-haiku": "Hi and welcome aboard. Your first week: meet your buddy on Monday, work through the help-desk walkthrough on Tuesday, and take live chats with backup from Wednesday on.",
};
const CHAT = {
  "openai/gpt-4o-mini": "Welcome to the support team! Say hi in the team channel, grab a coffee with your buddy, and don't worry about knowing everything yet.",
  "anthropic/claude-3.5-haiku": "Hi and welcome aboard. We're glad you're here: post a quick intro and tell us your favourite snack for Friday's lunch.",
};
const SUBJECT = { "openai/gpt-4o-mini": "Welcome to the support team! Your first week at a glance" };
function reply(model, last) {
  const table = /team chat/i.test(last) ? CHAT : /subject line/i.test(last) ? SUBJECT : REPLIES;
  return table[model] ?? REPLIES[model] ?? "Here is a short answer from " + model + " to: " + last.slice(0, 60);
}
function page(description, instruction, version) {
  const title = description.split(/[.!?]/)[0].slice(0, 60);
  return "<!doctype html><html><head><meta charset=\\"utf-8\\"><title>" + title + "</title>" +
    "<style>body{font-family:sans-serif;padding:24px}h1{font-size:" + (version > 1 ? 40 : 24) + "px}</style></head>" +
    "<body><h1 id=\\"app-title\\">" + title + "</h1>" +
    (instruction ? "<p id=\\"change\\">" + instruction + "</p>" : "") +
    "<label>Bill <input id=\\"bill\\" value=\\"40\\"></label> <label>Tip % <input id=\\"tip\\" value=\\"15\\"></label>" +
    "<p id=\\"out\\"></p><script>const f=()=>{document.getElementById('out').textContent='Tip: '+(document.getElementById('bill').value*document.getElementById('tip').value/100).toFixed(2)};f();document.querySelectorAll('input').forEach(i=>i.addEventListener('input',f));</script>" +
    "</body></html>";
}
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/__calls") return Response.json(calls);
  if (url.pathname === "/__mode") { mode = { ...mode, ...(await request.json()) }; return Response.json(mode); }
  if (!url.pathname.endsWith("/chat/completions")) return new Response("not found", { status: 404 });
  const body = await request.json();
  calls.push({ path: url.pathname, body });
  if (mode.off) {
    const code = "ai_provider_not_configured";
    return Response.json({ error: "Service Unavailable", code, message: "openrouter is not configured.", setup: "Add an OpenRouter key." },
      { status: 503, headers: { "x-everyapp-error": code } });
  }
  if (mode.failModel && body.model === mode.failModel)
    return Response.json({ error: { message: "The model is overloaded. Try again later.", code: 502 } }, { status: 502 });
  const messages = body.messages ?? [];
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const users = messages.filter((m) => m.role === "user");
  const last = users.at(-1)?.content ?? "";
  let content;
  if (/single HTML file/i.test(system)) {
    const description = users[0]?.content ?? "";
    const assistantCount = messages.filter((m) => m.role === "assistant").length;
    const instruction = assistantCount > 0 ? last : "";
    content = "Here is the app.\\n\\n\`\`\`html\\n" + page(description, instruction, assistantCount + 1) + "\\n\`\`\`";
  } else content = reply(body.model, last);
  return Response.json({ id: "fake-" + calls.length, object: "chat.completion", model: body.model,
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
} };`;

export const fakeAi = {
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: "fake-ai" } },
  workers: [{ config: { name: "fake-ai", compatibilityDate: "2025-01-01",
    manifest: { mainModule: "fake.mjs", modules: { "fake.mjs": { type: "esm", contents: Buffer.from(FAKE) } } } } }],
};

async function worker(runtime) {
  return runtime.mf.getWorker("fake-ai");
}
export async function aiCalls(runtime) {
  return (await (await worker(runtime)).fetch("http://fake/__calls")).json();
}
export async function setAiMode(runtime, mode) {
  await (await worker(runtime)).fetch("http://fake/__mode", { method: "POST", body: JSON.stringify(mode) });
}
