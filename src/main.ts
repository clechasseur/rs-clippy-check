import path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';

import { Cargo, Cross, CargoHack } from '@clechasseur/rs-actions-core';
import * as input from './input';
import { CheckRunner } from './check';

async function getProgram(actionInput: input.Input) {
  switch (actionInput.tool) {
    case 'cross':
      return await Cross.getOrInstall(actionInput.cacheKey);
    case 'cargo-hack':
      return await CargoHack.getOrInstall(actionInput.cacheKey);
    default:
      return await Cargo.get();
  }
}

export async function run(actionInput: input.Input): Promise<void> {
  const program = await getProgram(actionInput);

  // TODO: Simplify this block
  let rustcVersion = '';
  let cargoVersion = '';
  let clippyVersion = '';
  await exec.exec('rustc', ['-V'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (rustcVersion = buffer.toString().trim()),
    },
  });
  await program.call(['-V'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (cargoVersion = buffer.toString().trim()),
    },
  });
  await program.call(['clippy', '-V'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (clippyVersion = buffer.toString().trim()),
    },
  });

  let args: string[] = [];
  // Toolchain selection MUST go first in any condition
  if (actionInput.toolchain) {
    args.push(`+${actionInput.toolchain}`);
  }
  args.push('clippy');
  // `--message-format=json` should be right after the `cargo clippy`
  // because usually people are adding the `-- -D warnings` at the end
  // of arguments and it will mess up the output.
  args.push('--message-format=json');

  args = args.concat(actionInput.args);

  const runner = new CheckRunner(actionInput.workingDirectory);
  const options: exec.ExecOptions = {
    ignoreReturnCode: true,
    failOnStdErr: false,
    listeners: {
      stdline: (line: string) => {
        runner.tryPush(line);
      },
    },
  };
  if (actionInput.workingDirectory) {
    options.cwd = path.join(process.cwd(), actionInput.workingDirectory);
  }

  let clippyExitCode: number = 0;
  try {
    core.startGroup('Executing cargo clippy (JSON output)');
    clippyExitCode = await program.call(args, options);
  } finally {
    core.endGroup();
  }

  await runner.addSummary({
    rustc: rustcVersion,
    cargo: cargoVersion,
    clippy: clippyVersion,
  });

  if (clippyExitCode !== 0) {
    throw new Error(`Clippy has exited with exit code ${clippyExitCode}`);
  }
}

async function main(): Promise<void> {
  try {
    const actionInput = input.get();

    await run(actionInput);
  } catch (error) {
    core.setFailed((<Error>error).message);
  }
}

main();
