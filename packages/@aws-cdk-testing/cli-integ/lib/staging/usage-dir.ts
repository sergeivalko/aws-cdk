import * as path from 'path';
import * as fs from 'fs-extra';
import { addToFile, copyDirectoryContents, homeDir } from '../files';

export const DEFAULT_USAGE_DIR = path.join(homeDir(), '.codeartifact/usage');

/**
 * The usage directory is where we write per-session config files to access the CodeArtifact repository.
 *
 * Contract:
 *
 * There are two special entries:
 *
 * - `env`, a file with `key=value` entries for environment variables to  set.
 * - `cwd/`, a directory with files that need to be copied into the current directory before each command.
 */
export async function prepareUsageDir() {
  const dir = DEFAULT_USAGE_DIR;
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdirp(path.join(dir, 'cwd'));
  await fs.writeFile(path.join(dir, 'env'), '', { encoding: 'utf-8' });

  await addToEnvFile(dir, 'CWD_FILES_DIR', path.join(dir, 'cwd'));
  // Write a bash helper to load these settings
  await fs.writeFile(path.join(dir, 'activate.bash'), [
    `while read -u10 line; do [[ -z $line ]] || export "$line"; done 10<${dir}/env`,
    'cp -R $CWD_FILES_DIR/ .', // Copy files from directory even if it is empty
  ].join('\n'), { encoding: 'utf-8' });

  return dir;
}

export async function addToEnvFile(usageDir: string, key: string, value: string) {
  await addToFile(path.join(usageDir, 'env'), `${key}=${value}`);
}

export async function loadCurrentCodeArtifactUsage(dir: string) {
  for (const line of (await fs.readFile(path.join(dir, 'env'), { encoding: 'utf-8' })).split('\n')) {
    const parts = line.split('=');
    if (parts.length === 2) {
      process.env[parts[0]] = parts[1];
    }
  }

  await copyDirectoryContents(path.join(dir, 'cwd'), '.');
}