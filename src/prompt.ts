/**
 * The following code is from https://github.com/Nutlope/aicommits with some modifications.
 * Copyright (c) Hassan El Mghari
 */

const commitTypesArray = ['legacy', 'conventional'] as const;
export type CommitType = (typeof commitTypesArray)[number];
export const isCommitType = (type: string): type is CommitType => commitTypesArray.includes(type as CommitType);
const commitTypeFormats: Record<CommitType, string> = {
  'legacy': '<commit message>',
  conventional: '<type>(<optional scope>): <commit message>',
};
const specifyCommitFormat = (type: CommitType) =>
  `The output response must be in format:\n${commitTypeFormats[type]}`;

const commitTypes: Record<CommitType, string> = {
  'legacy': '',
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

export const generatePrompt = (
  locale = 'en',
  maxLength = 50,
  type = 'legacy' as CommitType
) =>
  [
    'Generate a concise git commit message written in present tense for the following code diff with the given specifications below:',
    `Message language: ${locale}`,
    `The message should consist of a summary and a detailed body. The summary must be a maximum of 50 characters. The detailed body can be empty. The total of summary and detailed body must be a maximum of ${maxLength} characters. Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit. No need to include any diff, please make sure the response the commit message only.`,
    commitTypes[type],
    specifyCommitFormat(type),
  ].filter(Boolean).join('\n');
