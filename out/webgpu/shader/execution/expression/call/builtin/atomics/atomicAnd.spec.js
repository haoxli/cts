/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Atomically read, and and store value.

* Load the original value pointed to by atomic_ptr.
* Obtains a new value by anding with the value v.
* Store the new value using atomic_ptr.

Returns the original value stored in the atomic object.
`;import { makeTestGroup } from '../../../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../../../common/util/data_tables.js';
import { GPUTest } from '../../../../../../gpu_test.js';

import { dispatchSizes, workgroupSizes, runTest, kMapId } from './harness.js';

export const g = makeTestGroup(GPUTest);

g.test('and').
specURL('https://www.w3.org/TR/WGSL/#atomic-rmw').
desc(
`
AS is storage or workgroup
T is i32 or u32

fn atomicAnd(atomic_ptr: ptr<AS, atomic<T>, read_write>, v: T) -> T
`).

params((u) =>
u.
combine('workgroupSize', workgroupSizes).
combine('dispatchSize', dispatchSizes).
combine('mapId', keysOf(kMapId))).

fn((t) => {
  const numInvocations = t.params.workgroupSize * t.params.dispatchSize;

  // Allocate an output buffer with bitsize of max invocations plus 1 for validation
  const bufferNumElements = Math.max(1, numInvocations / 32) + 1;

  // Start with all bits high, then using atomicAnd to set mapped global id bit off.
  // Note: Both WGSL and JS will shift left 1 by id modulo 32.
  const initValue = 0xffffffff;

  const mapId = kMapId[t.params.mapId];
  const extra = mapId.wgsl(numInvocations); // Defines map_id()
  const op = `
      let i = map_id(id);
      atomicAnd(&output[i / 32], ~(1u << i))
    `;

  const expected = new Uint32Array(bufferNumElements).fill(initValue);
  for (let id = 0; id < numInvocations; ++id) {
    const i = mapId.f(id, numInvocations);
    expected[Math.floor(i / 32)] &= ~(1 << i);
  }

  runTest({
    t,
    workgroupSize: t.params.workgroupSize,
    dispatchSize: t.params.dispatchSize,
    bufferNumElements,
    initValue,
    op,
    expected,
    extra
  });
});
//# sourceMappingURL=atomicAnd.spec.js.map