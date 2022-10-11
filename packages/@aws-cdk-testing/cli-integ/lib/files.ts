import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

export async function rmFile(filename: string) {
  if (await fs.pathExists(filename)) {
    await fs.unlink(filename);
  }
}

export async function addToFile(filename: string, line: string) {
  let contents = await fs.pathExists(filename) ? await fs.readFile(filename, { encoding: 'utf-8' }) : '';
  if (!contents.endsWith('\n')) {
    contents += '\n';
  }
  contents += line + '\n';

  await writeFile(filename, contents);
}

export async function writeFile(filename: string, contents: string) {
  await fs.mkdirp(path.dirname(filename));
  await fs.writeFile(filename, contents, { encoding: 'utf-8' });
}

export async function copyDirectoryContents(dir: string, target: string) {
  for (const file of await fs.readdir(path.join(dir), { encoding: 'utf-8' })) {
    await fs.copyFile(path.join(dir, file), path.join(target, file));
  }
}

export function findUp(name: string, directory: string = process.cwd()): string | undefined {
  const absoluteDirectory = path.resolve(directory);

  const file = path.join(directory, name);
  if (fs.existsSync(file)) {
    return file;
  }

  const { root } = path.parse(absoluteDirectory);
  if (absoluteDirectory == root) {
    return undefined;
  }

  return findUp(name, path.dirname(absoluteDirectory));
}


/**
 * Docker-safe home directory
 */
export function homeDir() {
  return os.userInfo().homedir ?? os.homedir();
}