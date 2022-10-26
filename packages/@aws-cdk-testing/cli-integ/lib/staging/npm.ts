/* eslint-disable no-console */
import * as path from 'path';
import * as fs from 'fs-extra';
import { homeDir } from '../files';
import { shell } from '../shell';
import { LoginInformation } from './codeartifact';
import { parallelShell } from './parallel-shell';
import { addToEnvFile } from './usage-dir';

export async function uploadNpmPackages(packages: string[], login: LoginInformation, usageDir: string) {
  // Creating an ~/.npmrc that references an envvar is what you're supposed to do. (https://docs.npmjs.com/private-modules/ci-server-config)
  await writeNpmLoginToken(login.npmEndpoint, '${NPM_TOKEN}');

  await parallelShell(packages, async (pkg, output) => {
    console.log(`⏳ ${pkg}`);

    // path.resolve() is required -- if the filename ends up looking like `js/bla.tgz` then NPM thinks it's a short form GitHub name.
    await shell(['node', require.resolve('npm'), 'publish', path.resolve(pkg)], {
      modEnv: {
        npm_config_registry: login.npmEndpoint,
        NPM_TOKEN: login.authToken,
      },
      show: 'error',
      output,
    });

    console.log(`✅ ${pkg}`);
  }, (pkg, output) => {
    if (output.toString().includes('code EPUBLISHCONFLICT')) {
      console.log(`❌ ${pkg}: already exists. Skipped.`);
      return true;
    }
    if (output.toString().includes('code EPRIVATE')) {
      console.log(`❌ ${pkg}: is private. Skipped.`);
      return true;
    }
    return false;
  });

  // Add variables to env file
  await addToEnvFile(usageDir, 'npm_config_registry', login.npmEndpoint);
  await addToEnvFile(usageDir, 'NPM_TOKEN', login.authToken);
}

async function writeNpmLoginToken(endpoint: string, token: string) {
  const rcFile = path.join(homeDir(), '.npmrc');
  const lines = (await fs.pathExists(rcFile) ? await fs.readFile(rcFile, { encoding: 'utf-8' }) : '').split('\n');
  const key = `${endpoint.replace(/^https:/, '')}:_authToken=`;

  updateNpmSetting(lines, key, token);
  updateNpmSetting(lines, 'always-auth', 'true'); // Necessary to make NPM 6 work

  await fs.writeFile(rcFile, lines.join('\n'), { encoding: 'utf-8' });
}

function updateNpmSetting(lines: string[], key: string, value: string) {
  const prefix = `${key}=`;
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(prefix)) {
      lines[i] = prefix + value;
      found = true;
      break;
    }
  }
  if (!found) {
    lines.push(prefix + value);
  }
}

// Environment variable, .npmrc in same directory as package.json or in home dir