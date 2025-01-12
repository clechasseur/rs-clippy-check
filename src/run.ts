import path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {
  Cargo,
  CargoHack,
  CargoHackOptions,
  Cross,
  CrossOptions,
} from '@clechasseur/rs-actions-core';

import * as input from './input';
import { CheckRunner } from './check';

async function getProgram(actionInput: input.Input) {
  switch (actionInput.tool) {
    case 'cross': {
      const options: CrossOptions = {
        toolchain: actionInput.toolchain,
        primaryKey: actionInput.cacheKey,
      };
      return await Cross.getOrInstall(options);
    }
    case 'cargo-hack': {
      const options: CargoHackOptions = {
        toolchain: actionInput.toolchain,
        primaryKey: actionInput.cacheKey,
      };
      return await CargoHack.getOrInstall(options);
    }
  }

  throw new Error(
    `Invalid tool '${actionInput.tool}' specified, must be one of [cross, cargo-hack]`,
  );
}

export async function run(actionInput: input.Input): Promise<void> {
  const cargo = await Cargo.get(actionInput.toolchain);
  const program = actionInput.tool ? await getProgram(actionInput) : cargo;

  // TODO: Simplify this block
  let rustcVersion = '';
  let cargoVersion = '';
  let programVersion = '';
  let clippyVersion = '';
  await exec.exec('rustc', ['-V'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (rustcVersion = buffer.toString().trim()),
    },
  });
  await cargo.call(['-V'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (cargoVersion = buffer.toString().trim()),
    },
  });
  if (actionInput.tool) {
    await program.call(['-V'], {
      silent: true,
      listeners: {
        stdout: (buffer: Buffer) => (programVersion = buffer.toString().trim()),
      },
    });
  }
  await cargo.call(['clippy', '-V'], {
    silent: true,
    listeners: {
      stdout: (buffer: Buffer) => (clippyVersion = buffer.toString().trim()),
    },
  });

  let args: string[] = [];
  args.push('clippy');
  // `--message-format=json` should be right after the `cargo clippy`
  // because usually people are adding the `-- -D warnings` at the end
  // of arguments, and it will mess up the output.
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
    ...(programVersion && { program: programVersion }),
    clippy: clippyVersion,
  });

  if (clippyExitCode !== 0) {
    throw new Error(`Clippy has exited with exit code ${clippyExitCode}`);
  }
}
