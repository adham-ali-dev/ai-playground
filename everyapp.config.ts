import { defineEveryApp } from "@every-app/sdk";
import { MODEL_IDS } from "./src/lib/models.ts";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB), never the file.
export default defineEveryApp({
  id: "ai-playground",
  name: "AI Playground",
  description:
    "Try AI models on your own prompts, compare their answers, get the code to call them, and build small web apps by describing them.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
  },
  providers: [
    {
      id: "openrouter",
      why: "Runs prompts and builds apps with the models you pick.",
      docs: "https://openrouter.ai/keys",
    },
  ],
  ai: { models: MODEL_IDS },
});
