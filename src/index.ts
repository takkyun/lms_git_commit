import { LLMSpecificModel, LMStudioClient } from "@lmstudio/sdk";
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
  constructCommitMessage(model, staged.diff);
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

const constructCommitMessage = async (model: LLMSpecificModel, diff: string) => {
  const prediction = model.respond([
    { role: "system", content: generatePrompt('English', 200, '') },
    { role: "user", content: diff },
  ], {
    maxPredictedTokens: 100,
    temperature: 0.7,
  });
  for await (const text of prediction) {
    process.stdout.write(text);
  }
}

const commitTypesArray = ['', 'conventional'] as const;
type CommitType = (typeof commitTypesArray)[number];
const commitTypeFormats: Record<CommitType, string> = {
  '': '<commit message>',
  conventional: '<type>(<optional scope>): <commit message>',
};
const specifyCommitFormat = (type: CommitType) =>
  `The output response must be in format:\n${commitTypeFormats[type]}`;

const commitTypes: Record<CommitType, string> = {
  '': '',
  /**
   * References:
   * Commitlint:
   * https://github.com/conventional-changelog/commitlint/blob/18fbed7ea86ac0ec9d5449b4979b762ec4305a92/%40commitlint/config-conventional/index.js#L40-L100
   *
   * Conventional Changelog:
   * https://github.com/conventional-changelog/conventional-changelog/blob/d0e5d5926c8addba74bc962553dd8bcfba90e228/packages/conventional-changelog-conventionalcommits/writer-opts.js#L182-L193
   */
  conventional: `Choose a type from the type-to-description JSON below that best describes the git diff:\n${JSON.stringify(
    {
      docs: 'Documentation only changes',
      style:
        'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
      refactor: 'A code change that neither fixes a bug nor adds a feature',
      perf: 'A code change that improves performance',
      test: 'Adding missing tests or correcting existing tests',
      build: 'Changes that affect the build system or external dependencies',
      ci: 'Changes to our CI configuration files and scripts',
      chore: "Other changes that don't modify src or test files",
      revert: 'Reverts a previous commit',
      feat: 'A new feature',
      fix: 'A bug fix',
    },
    null,
    2
  )}`,
};

const generatePrompt = (
  locale = 'en',
  maxLength = 50,
  type = '' as CommitType
) =>
  [
    'Generate a concise git commit message written in present tense for the following code diff with the given specifications below:',
    `Message language: ${locale}`,
    `Commit message must be a maximum of ${maxLength} characters.`,
    'Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit.',
    commitTypes[type],
    specifyCommitFormat(type),
  ].filter(Boolean).join('\n');
