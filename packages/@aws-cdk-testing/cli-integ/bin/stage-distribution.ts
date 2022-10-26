/* eslint-disable no-console */
import * as path from 'path';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as yargs from 'yargs';
import { shell } from '../lib';
import { TestRepository, LoginInformation } from '../lib/staging/codeartifact';
import { uploadJavaPackages } from '../lib/staging/maven';
import { uploadNpmPackages } from '../lib/staging/npm';
import { uploadDotnetPackages } from '../lib/staging/nuget';
import { uploadPythonPackages } from '../lib/staging/pypi';
import { prepareUsageDir, loadCurrentCodeArtifactUsage, addToEnvFile, DEFAULT_USAGE_DIR } from '../lib/staging/usage-dir';

async function main() {
  await yargs
    .usage('$0 <command>')
    .option('npm', {
      description: 'Upload NPM packages only',
      type: 'boolean',
      requiresArg: false,
    })
    .option('python', {
      description: 'Upload Python packages only',
      type: 'boolean',
      requiresArg: false,
    })
    .option('java', {
      description: 'Upload Java packages only',
      type: 'boolean',
      requiresArg: false,
    })
    .option('dotnet', {
      description: 'Upload Dotnet packages only',
      type: 'boolean',
      requiresArg: false,
    })
    .command('publish <DIRECTORY>', 'Publish a given directory', cmd => cmd
      .positional('DIRECTORY', {
        descripton: 'Directory distribution',
        type: 'string',
        demandOption: true,
      })
      .option('name', {
        alias: 'n',
        description: 'Name of the repository to create (default: generate unique name)',
        type: 'string',
        requiresArg: true,
      }), async (args) => {

      await validateDirectory(args);
      const repo = await (args.name ? TestRepository.newWithName(args.name) : TestRepository.newRandom());
      const { usageDir } = await publish(await repo.loginInformation(), args);

      header('Done');
      console.log('To activate these settings:');
      console.log(`    source ${usageDir}/activate.bash`);
    })
    .command('run <DIRECTORY> <COMMAND..>', 'Publish and run a command', cmd => cmd
      .positional('DIRECTORY', {
        descripton: 'Directory distribution',
        type: 'string',
        demandOption: true,
      })
      .positional('COMMAND', {
        alias: 'c',
        description: 'Run the given command with the packages staged',
        type: 'string',
        array: true,
        demandOption: true,
      })
      .option('cleanup', {
        alias: 'C',
        description: 'Cleanup the repository afterwards',
        type: 'boolean',
        default: true,
        requiresArg: false,
      }), async (args) => {

      await validateDirectory(args);
      const repo = await TestRepository.newRandom();
      const { usageDir } = await publish(await repo.loginInformation(), args);

      try {
        await loadCurrentCodeArtifactUsage(usageDir);
        await shell(args.COMMAND ?? [], {
          shell: true,
          show: 'always',
        });
      } finally {
        if (args.cleanup) {
          await repo.delete();
        }
      }
    })
    .command('cleanup', 'Clean up testing repository', cmd => cmd
      .option('name', {
        alias: 'n',
        description: 'Name of the repository to cleanup (default: most recent)',
        type: 'string',
        requiresArg: true,
      }), async (args) => {

      let repositoryName = args.name;
      if (!repositoryName) {
        await loadCurrentCodeArtifactUsage(DEFAULT_USAGE_DIR);
        repositoryName = process.env.CODEARTIFACT_REPO;
      }

      if (!repositoryName) {
        console.log(`No --name given and no $CODEARTIFACT_REPO found in ${DEFAULT_USAGE_DIR}, nothing cleaned up`);
        return;
      }

      const repo = TestRepository.existing(repositoryName);
      await repo.delete();
    })
    .command('gc', 'Clean up day-old testing repositories', cmd => cmd, async () => {
      await TestRepository.gc();
    })
    .demandCommand(1, 'You must supply a command')
    .help()
    .strictOptions()
    .showHelpOnFail(false)
    .parse();
}

async function validateDirectory(args: {
  DIRECTORY: string,
}) {
  if (!await fs.pathExists(path.join(args.DIRECTORY, 'build.json'))) {
    throw new Error(`${args.DIRECTORY} does not look like a CDK dist directory (build.json missing)`);
  }
}

async function publish(login: LoginInformation, args: {
  DIRECTORY: string,
  npm?: boolean;
  python?: boolean;
  java?: boolean;
  dotnet?: boolean;
}) {
  const directory = `${args.DIRECTORY}`;

  const all = args.npm === undefined && args.python === undefined && args.java === undefined && args.dotnet === undefined;

  const buildJson = await fs.readJson(path.join(directory, 'build.json'));

  const usageDir = await prepareUsageDir();
  await addToEnvFile(usageDir, 'BUILD_VERSION', buildJson.version);
  await addToEnvFile(usageDir, 'CODEARTIFACT_REPO', login.repositoryName);

  if (all || args.npm) {
    header('NPM');
    await uploadNpmPackages(glob.sync(path.join(directory, 'js', '*.tgz')), login, usageDir);
  }

  if (all || args.python) {
    header('Python');
    await uploadPythonPackages(glob.sync(path.join(directory, 'python', '*')), login, usageDir);
  }

  if (all || args.java) {
    header('Java');
    await uploadJavaPackages(glob.sync(path.join(directory, 'java', '**', '*.pom')), login, usageDir);
  }

  if (all || args.dotnet) {
    header('.NET');
    await uploadDotnetPackages(glob.sync(path.join(directory, 'dotnet', '**', '*.nupkg')), login, usageDir);
  }

  return { usageDir };
}

function header(caption: string) {
  console.log('');
  console.log('/'.repeat(70));
  console.log(`//  ${caption}`);
  console.log('');
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
