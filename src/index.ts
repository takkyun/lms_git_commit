import { LMStudioClient } from "@lmstudio/sdk";
import { confirm } from "@clack/prompts";
import { exec } from "child_process";
import { assertGitRepo, getStagedDiff } from "./git";
import { generatePrompt, isCommitType } from "./prompt";
import { copyToClipboard } from "./copy";

// const defaultModel = 'QuantFactory/Mistral-Nemo-Japanese-Instruct-2408-GGUF/Mistral-Nemo-Japanese-Instruct-2408.Q4_K_M.gguf';
// const defaultModelIdentifier = 'mistral-nemo-japanese-instruct-2408';
// const defaultModel = 'lmstudio-community/gpt-oss-20b-GGUF/gpt-oss-20b-MXFP4.gguf';
// const defaultModelIdentifier = 'openai/gpt-oss-20b';
const defaultModel = 'lmstudio-community/gemma-3-12b-it-GGUF/gemma-3-12b-it-Q4_K_M.gguf';
const defaultModelIdentifier = 'google/gemma-3-12b';

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

/**
 * Truncate diff to fit within token limits
 * Keeps the summary and most recent changes, removes oldest changes if needed
 */
const truncateDiff = (diff: string, maxLength: number = 3000): string => {
  if (diff.length <= maxLength) {
    return diff;
  }

  // Split into diff headers (file names) and content
  const lines = diff.split('\n');

  let result = '';

  // First pass: collect file separators
  const fileSeparators: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('diff --git')) {
      fileSeparators.push(i);
    }
  }

  // If single file, just truncate the content
  if (fileSeparators.length <= 1) {
    return diff.substring(0, maxLength) + '\n... (truncated)';
  }

  // Keep first file and recent files, remove oldest middle files
  const lastFileIndex = fileSeparators.length - 1;
  const linesToKeep = [];

  // Always keep the first file
  const firstFileEnd = fileSeparators[1] || lines.length;
  linesToKeep.push(...lines.slice(fileSeparators[0], firstFileEnd));

  // Keep last few files (usually most important)
  const keepLastFiles = Math.min(3, fileSeparators.length - 1);
  for (let i = Math.max(1, lastFileIndex - keepLastFiles + 1); i <= lastFileIndex; i++) {
    const start = fileSeparators[i];
    const end = i < fileSeparators.length - 1 ? fileSeparators[i + 1] : lines.length;
    linesToKeep.push(...lines.slice(start, end));
  }

  result = linesToKeep.join('\n');

  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
  }

  return result + '\n... (truncated due to size)';
};

/**
 * Generate a simplified commit message when LLM fails due to context overflow
 */
const generateFallbackMessage = (diff: string, type: string): string => {
  // Extract file changes
  const files = diff.match(/^diff --git a\/.*? b\/.*?$/gm) || [];
  const uniqueFiles = [...new Set(files.map(f => f.split(' ')[3]?.replace(/^b\//, '') || 'files'))];

  // Detect change type from diff
  let changeType = type === 'conventional' ? 'chore' : '';
  let summary = '';

  if (diff.includes('feat:') || /^\+.*feature/mi.test(diff)) {
    changeType = 'feat';
    summary = `add new feature (${uniqueFiles.length} files)`;
  } else if (/^\+.*fix/mi.test(diff) || diff.includes('fix:')) {
    changeType = 'fix';
    summary = `fix bug (${uniqueFiles.length} files)`;
  } else if (/^\+.*test/mi.test(diff)) {
    changeType = 'test';
    summary = `add tests (${uniqueFiles.length} files)`;
  } else if (/^\+.*\/\/|^\+.*\/\*|docs/mi.test(diff)) {
    changeType = 'docs';
    summary = `update documentation (${uniqueFiles.length} files)`;
  } else if (diff.split('\n').filter(l => l.startsWith('-')).length > diff.split('\n').filter(l => l.startsWith('+')).length) {
    changeType = 'refactor';
    summary = `refactor code (${uniqueFiles.length} files)`;
  } else {
    summary = `update code (${uniqueFiles.length} files)`;
  }

  if (type === 'conventional') {
    return `${changeType}: ${summary}`;
  }
  return summary;
};

const generateMessage = async (model: any, prompt: string, diff: string, maxTokens: number = 1024) => {
  const prediction = await model.respond([
    { role: "system", content: prompt },
    { role: "user", content: diff },
  ], {
    maxPredictedTokens: maxTokens,
    temperature: 0.7,
  });
  const content = prediction.content;
  if (content.match(/<think>[\s\S]*?<\/think>\n\n/m)) {
    return content.replace(/<think>[\s\S]*?<\/think>\n\n/m, '');
  }
  if (content.match(/.*?<\|channel\|>final<\|message\|>/m)) {
    return content.replace(/.*?<\|channel\|>final<\|message\|>/m, '').trim();
  }
  return content;
};

const constructCommitMessage = async (model: any, diff: string, prompt: string) => {
  try {
    // First attempt: try with full diff
    try {
      return await generateMessage(model, prompt, diff);
    } catch (error: any) {
      // Check if this is a context length error
      if (error.message?.includes('context') || error.message?.includes('token')) {
        console.warn('⚠️  Context length exceeded, attempting recovery...');

        // Second attempt: try with truncated diff
        const truncatedDiff = truncateDiff(diff);
        try {
          const result = await generateMessage(model, prompt, truncatedDiff);
          console.warn('✓ Successfully recovered with truncated diff');
          return result;
        } catch (retryError: any) {
          // Third attempt: generate simple fallback message
          if (retryError.message?.includes('context') || retryError.message?.includes('token')) {
            console.warn('⚠️  Still exceeds limits, generating fallback message...');
            const commitType = prompt.includes('conventional') ? 'conventional' : 'legacy';
            const fallback = generateFallbackMessage(diff, commitType);
            console.warn(`✓ Using fallback message: ${fallback}`);
            return fallback;
          }
          throw retryError;
        }
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Fatal error in constructCommitMessage:', error.message);
    throw error;
  }
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
