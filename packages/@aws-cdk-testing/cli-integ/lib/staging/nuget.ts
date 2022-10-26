/* eslint-disable no-console */
import { writeFile } from '../files';
import { shell } from '../shell';
import { LoginInformation } from './codeartifact';
import { parallelShell } from './parallel-shell';
import { UsageDir } from './usage-dir';

export async function nugetLogin(login: LoginInformation, usageDir: UsageDir) {
  // NuGet.Config MUST live in the current directory or in the home directory, and there is no environment
  // variable to configure its location.
  await writeNuGetConfigFile(usageDir.cwdFile('NuGet.Config'), login);
}

export async function uploadDotnetPackages(packages: string[], usageDir: UsageDir) {
  await usageDir.copyCwdFileHere('NuGet.Config');

  await parallelShell(packages, async (pkg, output) => {
    console.log(`⏳ ${pkg}`);

    await shell(['dotnet', 'nuget', 'push',
      pkg,
      '--source', 'CodeArtifact',
      '--no-symbols',
      '--force-english-output',
      '--disable-buffering',
      '--timeout', '600',
      '--skip-duplicate'], {
      output,
    });

    console.log(`✅ ${pkg}`);
  },
  (pkg, output) => {
    if (output.toString().includes('Conflict')) {
      console.log(`❌ ${pkg}: already exists. Skipped.`);
      return true;
    }
    return false;
  });
}

async function writeNuGetConfigFile(filename: string, login: LoginInformation) {
  // `dotnet nuget push` has an `--api-key` parameter, but CodeArtifact
  // does not support that. We must authenticate with Basic auth.
  await writeFile(filename, `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
    <add key="CodeArtifact" value="${login.nugetEndpoint}v3/index.json" />
  </packageSources>
  <activePackageSource>
    <add key="CodeArtifact" value="${login.nugetEndpoint}v3/index.json" />
  </activePackageSource>
  <packageSourceCredentials>
    <CodeArtifact>
        <add key="Username" value="aws" />
        <add key="ClearTextPassword" value="${login.authToken}" />
      </CodeArtifact>
  </packageSourceCredentials>
</configuration>`);
}

// NuGet.Config in current directory