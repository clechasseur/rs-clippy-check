import * as core from '@actions/core';

import * as input from './input';
import { run } from './run';

async function main(): Promise<void> {
  try {
    const actionInput = input.get();

    await run(actionInput);
  } catch (error) {
    core.setFailed(<Error>error);
  }
}

main();
