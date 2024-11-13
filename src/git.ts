/**
 * The following code is from https://github.com/Nutlope/aicommits with some modifications.
 * Copyright (c) Hassan El Mghari
 */
import { exec } from "child_process";

export const assertGitRepo = async () => {
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

export const getStagedDiff = async (excludeFiles?: string[]) => {
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