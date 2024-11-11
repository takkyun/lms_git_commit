import { LMStudioClient } from "@lmstudio/sdk";
import { exec } from "child_process";

const client = new LMStudioClient();
const defaultModel = 'QuantFactory/Mistral-Nemo-Japanese-Instruct-2408-GGUF/Mistral-Nemo-Japanese-Instruct-2408.Q4_0.gguf';
const defaultModelIdentifier = 'mistral-nemo-japanese-instruct-2408';

async function main() {
  const model = await checkModels();
  console.log('Model:', model.identifier);
  await assertGitRepo();
  const staged = await getStagedDiff();
  if (!staged || !staged.diff) {
    console.error('No staged changes found.');
    process.exit(1);
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

const excludeFromDiff = (path: string) => `':!${path}'`;
const filesToExclude = [
  'package-lock.json',
  'pnpm-lock.yaml',

  // yarn.lock, Cargo.lock, Gemfile.lock, Pipfile.lock, etc.
  '*.lock',
].map(excludeFromDiff);

const getStagedDiff = async (excludeFiles?: string[]) => {
  const args = [
    '--cached',
    '--diff-algorithm=minimal',
    '--',
    '.',
    ...filesToExclude,
    ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : [])
  ];
  const files = await new Promise<string>((resolve, reject) => {
    exec(`git diff ${['--name-only', ...args].join(' ')}`, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      }
      resolve(stdout);
    })
  }).catch(() => {
    return undefined;
  });

  if (!files) {
    return;
  }

  const diff = await new Promise<string>((resolve, reject) => {
    exec(`git diff ${args.join(' ')}`, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      }
      resolve(stdout);
    })
  }).catch(() => {
    return undefined;
  });

  return {
    files: files.split('\n'),
    diff,
  };
};

