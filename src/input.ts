/**
 * Parse action input into a some proper thing.
 */

import { input } from '@clechasseur/rs-actions-core';

import stringArgv from 'string-argv';

// Parsed action input
export interface Input {
  toolchain?: string;
  args: string[];
  workingDirectory?: string;
  tool?: string;
  cacheKey?: string;
}

export function get(): Input {
  const args = stringArgv(input.getInput('args'));
  let toolchain = input.getInput('toolchain');
  if (toolchain.startsWith('+')) {
    toolchain = toolchain.slice(1);
  }
  const workingDirectory = input.getInput('working-directory');
  const tool = input.getInput('tool');
  const cacheKey = input.getInput('cache-key');

  return {
    args: args,
    toolchain: toolchain || undefined,
    workingDirectory: workingDirectory || undefined,
    tool: tool || undefined,
    cacheKey: cacheKey || undefined,
  };
}
