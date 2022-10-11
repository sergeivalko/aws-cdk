import PQueue from 'p-queue';
import { MemoryStream } from '../corking';

/**
 * Run a function in parallel with cached output
 */
export async function parallelShell<A>(
  inputs: A[],
  block: (x: A, output: NodeJS.WritableStream) => Promise<void>,
  swallowError?: (x: A, output: string) => boolean,
) {
  // Limit to 10 for now, too many instances of Maven exhaust the CodeBuild instance memory
  const q = new PQueue({ concurrency: Number(process.env.CONCURRENCY) || 10 });
  await q.addAll(inputs.map(input => async () => {
    const output = new MemoryStream();
    try {
      await block(input, output);
    } catch (e) {
      if (swallowError?.(input, output.toString())) {
        return;
      }

      // eslint-disable-next-line no-console
      console.error(output.toString());
      throw e;
    }
  }));

  await q.onEmpty();
}