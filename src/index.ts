import { LLMSpecificModel, LMStudioClient } from "@lmstudio/sdk";
import { confirm } from "@clack/prompts";
import { exec } from "child_process";
import { assertGitRepo, getStagedDiff } from "./git";
import { generatePrompt } from "./prompt";

const client = new LMStudioClient();
const defaultModel = 'QuantFactory/Mistral-Nemo-Japanese-Instruct-2408-GGUF/Mistral-Nemo-Japanese-Instruct-2408.Q4_0.gguf';
const defaultModelIdentifier = 'mistral-nemo-japanese-instruct-2408';

async function main() {
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
  const args = process.argv.slice(2);
  const prefix = args.filter(arg => arg.startsWith('--prefix')).map(arg => arg.split('=')[1])[0] ?? undefined;
  const response = await constructCommitMessage(model, staged.diff);
  const message = [prefix, response].filter(p => !!p).join(' ');
  const confirmed = await confirm({ message: `Use this commit message?\n---\n${message}\n` });
  if (confirmed) {
    exec(`git commit -m "${message}"`);
  } else {
    console.log('Commit cancelled.');
  }
}
main();

async function checkModels() {
  const loadedLLMs = await client.llm.listLoaded();
  if (loadedLLMs.length === 0) {
    await client.llm.load(defaultModel, {
      identifier: defaultModelIdentifier,
      noHup: true,
    } as any);
  }
  return await client.llm.get({ identifier: defaultModelIdentifier });
}

const constructCommitMessage = async (model: LLMSpecificModel, diff: string) => {
  const prediction = model.respond([
    { role: "system", content: generatePrompt('English', 200, 'conventional') },
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

