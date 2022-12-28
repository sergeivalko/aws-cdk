import { ResourcePool } from '../lib/resource-pool';

const POOL_NAME = 'resource-pool.test';

test('take and dispose', async () => {
  const pool = ResourcePool.withResources(POOL_NAME, ['a']);

  const take1 = pool.take();
  const take2 = pool.take();

  let released = false;

  const lease1 = await take1;
  // awaiting 'take2' would now block but we add an async
  // handler to it to flip a boolean to see when it gets activated.
  void(take2.then(() => released = true));

  expect(lease1.value).toEqual('a');
  await waitTick();
  expect(released).toEqual(false);

  await lease1.dispose();
  await waitTick(); // This works because setImmediate is scheduled in LIFO order
  expect(released).toEqual(true);
});

test('double dispose throws', async () => {
  const pool = ResourcePool.withResources(POOL_NAME, ['a']);
  const lease = await pool.take();

  await lease.dispose();
  expect(() => lease.dispose()).toThrow();
});

test('more consumers than values', async () => {
  const pool = ResourcePool.withResources(POOL_NAME, ['a', 'b']);

  const values = await Promise.all([
    pool.using(x => x),
    pool.using(x => x),
    pool.using(x => x),
  ]);

  expect(values).toEqual(['a', 'b', 'a']);
});

function waitTick() {
  return new Promise(setImmediate);
}