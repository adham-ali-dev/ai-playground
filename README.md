# AI Playground

A private workspace where your team tries AI models on their own prompts, compares answers side by side, copies the code to call a model, and builds small web apps by describing them.

Inspired by https://aistudio.google.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Run prompts with a chosen model, system instructions, temperature, top-p and max output tokens, then edit, delete, rate or rerun any turn.
- Find, sort, rename, duplicate and delete your saved prompts.
- Copy a prompt as a ready-to-run cURL, JavaScript or Python request.
- Send the same conversation to two models and read their answers side by side.
- Describe a web app, refine it in chat, restore versions, download the HTML, and share or remix apps within your organization.

Left out: accounts and sign-in, which your Gateway handles; image, video, audio and live voice models; model tools such as search grounding and function calling; file and audio inputs; publishing apps to outside hosting; developer API keys and usage dashboards.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev` (put `OPENROUTER_API_KEY` in `.dev.vars` to call models directly)
- Test: `pnpm test`; the release checks in `checks/` run against a packaged build with `node /home/user/oss-new/control/runtime/try-release.mjs` in the oss.new workspace.
- Deploy: `pnpm run deploy`

There are no secrets or settings of the app's own. Models run through your Gateway's OpenRouter provider: add a key with `everyapp provider add openrouter` ([get one](https://openrouter.ai/keys)). The database is created on deploy.

## Limitations

- Until an OpenRouter key is on the Gateway, runs and app builds show an error instead of an answer.
- Answers arrive whole, not streamed; long answers and app builds can take a while.
- The model list is fixed in `src/lib/models.ts`, and apps are built with Claude 3.5 Haiku.
- Built apps run in a sandboxed preview with no network access to this app; downloaded files run anywhere.
- The checks use a local stand-in for the model provider; real OpenRouter calls and deployment were not run here.
