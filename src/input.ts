/**
 * Parse action input into a some proper thing.
 */

import { input } from '@clechasseur/rs-actions-core';

import stringArgv from 'string-argv';

// Parsed action input
export interface Input {
  token: string;
  toolchain?: string;
  args: string[];
  useCross: boolean;
  workingDirectory?: string;
  name: string;
}

export function get(): Input {
  const args = stringArgv(input.getInput('args'));
  let toolchain = input.getInput('toolchain');
  if (toolchain.startsWith('+')) {
    toolchain = toolchain.slice(1);
  }
  const useCross = input.getInputBool('use-cross');
  const workingDirectory = input.getInput('working-directory');
  const name = input.getInput('name');

  return {
    token: input.getInput('token'),
    args: args,
    useCross: useCross,
    toolchain: toolchain || undefined,
    workingDirectory: workingDirectory || undefined,
    name,
  };
}
