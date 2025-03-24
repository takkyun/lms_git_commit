import { LMStudioClient } from "@lmstudio/sdk";
import { confirm } from "@clack/prompts";
import { exec } from "child_process";
import { assertGitRepo, getStagedDiff } from "./git";
import { generatePrompt, isCommitType } from "./prompt";
import { copyToClipboard } from "./copy";

const defaultModel = 'QuantFactory/Mistral-Nemo-Japanese-Instruct-2408-GGUF/Mistral-Nemo-Japanese-Instruct-2408.Q4_K_M.gguf';
const defaultModelIdentifier = 'mistral-nemo-japanese-instruct-2408';

const checkModels = async () => {
  const baseUrl = getArgParam('baseUrl');
  const client = new LMStudioClient({ baseUrl });
  const loadedLLMs = await client.llm.listLoaded();
  if (loadedLLMs.length === 0) {
    await client.llm.load(defaultModel, {
      identifier: defaultModelIdentifier,
      noHup: true,
    } as any);
  }
  const model = loadedLLMs.find(llm => llm.identifier === defaultModelIdentifier);
  return model ?? await client.llm.model();
}

const constructCommitMessage = async (model: any, diff: string, prompt: string) => {
  const prediction = await model.respond([
    { role: "system", content: prompt },
    { role: "user", content: diff },
  ], {
    maxPredictedTokens: 1024,
    temperature: 0.7,
  });
  const content = prediction.content;
  if (content.match(/<think>[\s\S]*?<\/think>\n\n/m)) {
    return content.replace(/<think>[\s\S]*?<\/think>\n\n/m, '');
  }
  return content;
}

const getArgParam = (key: string): string | undefined => {
  const args = process.argv.slice(2);
  return args.filter(arg => arg.startsWith(`--${key}`)).map(arg => arg.split('=')[1])[0] ?? undefined;
}

const main = async () => {
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
  const prompt = generatePrompt(locale, len, isCommitType(type) ? type : 'conventional');
  const dryrun = getArgParam('dryrun') === 'true';
  if (dryrun) {
    const input = `**System:**\n${prompt}\n\n**User:**\n${staged.diff}`;
    console.log('Dry run:', input);
    if (clipboard) {
      copyToClipboard(input);
    }
    return;
  }
  const model = await checkModels();
  if (!model) {
    console.error('Model not found.');
    process.exit(1);
  }
  console.log('Model:', model.identifier);
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
