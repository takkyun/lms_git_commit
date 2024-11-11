import { LMStudioClient } from "@lmstudio/sdk";
import { exec } from "child_process";

const client = new LMStudioClient();
const defaultModel = 'QuantFactory/Mistral-Nemo-Japanese-Instruct-2408-GGUF/Mistral-Nemo-Japanese-Instruct-2408.Q4_0.gguf';
const defaultModelIdentifier = 'mistral-nemo-japanese-instruct-2408';

async function main() {
  const model = await checkModels();
  console.log('Model:', model.identifier);
  await assertGitRepo();
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

const assertGitRepo = async () => {
  const result = await new Promise<string>((resolve, reject) => {
    exec('git rev-parse --show-toplevel', (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      }
      resolve(stdout);
    })
  }).catch(() => {
    throw new Error('The current directory must be a Git repository!');
  });
  return result;
};
