import { LLMSpecificModel, LMStudioClient } from "@lmstudio/sdk";
import { confirm } from "@clack/prompts";
import { exec } from "child_process";
import { assertGitRepo, getStagedDiff } from "./git";
import { CommitType, generatePrompt, isCommitType } from "./prompt";
import { copyToClipboard } from "./copy";

const client = new LMStudioClient();
const defaultModel = 'lightblue/suzume-llama-3-8B-japanese-gguf/ggml-model-Q4_K_M.gguf';
const defaultModelIdentifier = 'suzume-llama-3-8b-japanese';

const checkModels = async () => {
  const loadedLLMs = await client.llm.listLoaded();
  if (loadedLLMs.length === 0) {
    await client.llm.load(defaultModel, {
      identifier: defaultModelIdentifier,
      noHup: true,
    } as any);
  }
  return await client.llm.get({ identifier: defaultModelIdentifier });
}

const constructCommitMessage = async (model: LLMSpecificModel, diff: string, prompt: string) => {
  const prediction = model.respond([
    { role: "system", content: prompt },
    { role: "user", content: diff },
  ], {
    maxPredictedTokens: 100,
    temperature: 0.7,
  });
  let message = '';
  for await (const text of prediction) {
    message += text;
  }
  return message;
}

const getArgParam = (key: string): string | undefined => {
  const args = process.argv.slice(2);
  return args.filter(arg => arg.startsWith(`--${key}`)).map(arg => arg.split('=')[1])[0] ?? undefined;
}

const main = async () => {
  const model = await checkModels();
  if (!model) {
    console.error('Model not found.');
    process.exit(1);
  }
  console.log('Model:', model.identifier);
  await assertGitRepo();
  const staged = await getStagedDiff();
  if (!staged || !staged.diff) {
    console.error('No staged changes found.');
    process.exit(1);
  }
  const prefix = getArgParam('prefix');
  const locale = getArgParam('locale') ?? 'English';
  const len = parseInt(getArgParam('len') ?? '200');
  const type = getArgParam('type') ?? '';
  const clipboard = getArgParam('clipboard') === 'true';
  const dryrun = getArgParam('dryrun') === 'true';
  const prompt = generatePrompt(locale, len, isCommitType(type) ? type : '');
  if (dryrun) {
    const input = `**System:**\n${prompt}\n\n**User:**\n${staged.diff}`;
    console.log('Dry run:', input);
    if (clipboard) {
      copyToClipboard(input);
    }
    return;
  }
  const response = await constructCommitMessage(model, staged.diff, prompt);
  const message = [prefix, response].filter(p => !!p).join(' ');
  const confirmed = await confirm({ message: `Use this commit message?\n---\n${message}\n` });
  if (confirmed) {
    if (clipboard) {
      copyToClipboard(message);
    } else {
      exec(`git commit -m "${message}"`)
    }
  } else {
    console.error('cancelled.');
  }
}
main();
