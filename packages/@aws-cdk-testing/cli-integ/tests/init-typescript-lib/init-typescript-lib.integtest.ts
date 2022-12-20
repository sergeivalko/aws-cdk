import { integTest, withTemporaryDirectory, ShellHelper, withPackages } from '../../lib';
import { typescriptVersionsSync } from '../../lib/npm';

typescriptVersionsSync().forEach(tsVersion => {
  integTest(`typescript ${tsVersion} init lib`, withTemporaryDirectory(withPackages(async (context) => {
    const shell = ShellHelper.fromContext(context);
    await context.packages.makeCliAvailable();

    await shell.shell(['node', '--version']);
    await shell.shell(['npm', '--version']);

    await shell.shell(['cdk', 'init', '-l', 'typescript', 'lib', '--generate-only']);
    await shell.shell(['npm', 'install', '--save-dev', `typescript@${tsVersion}`]);
    await shell.shell(['npm', 'install']); // Older versions of npm require this to be a separate step from the one above
    await shell.shell(['npx', 'tsc', '--version']);

    await shell.shell(['npm', 'prune']);
    await shell.shell(['npm', 'ls']); // this will fail if we have unmet peer dependencies
    await shell.shell(['npm', 'run', 'build']);
    await shell.shell(['npm', 'run', 'test']);
  })));
});