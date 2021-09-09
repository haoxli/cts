export const description = `
Validation tests for resolveQuerySet.
`;
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../constants.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

export const kQueryCount = 2;

g.test('resolveQuerySet,invalid_queryset_and_destination_buffer')
  .desc(
    `
Tests that resolve query set with invalid object.
- invalid GPUQuerySet that failed during creation.
- invalid destination buffer that failed during creation.
  `
  )
  .paramsSubcasesOnly([
    { querySetState: 'valid', destinationState: 'valid' }, // control case
    { querySetState: 'invalid', destinationState: 'valid' },
    { querySetState: 'valid', destinationState: 'invalid' },
  ] as const)
  .fn(async t => {
    const { querySetState, destinationState } = t.params;

    const querySet = t.createQuerySetWithState(querySetState);

    const destination = t.createBufferWithState(destinationState, {
      size: kQueryCount * 8,
      usage: GPUBufferUsage.QUERY_RESOLVE,
    });

    const encoder = t.createEncoder('non-pass');
    encoder.encoder.resolveQuerySet(querySet, 0, 1, destination, 0);
    encoder.validateFinish(querySetState === 'valid' && destinationState === 'valid');
  });

g.test('resolveQuerySet,first_query_and_query_count')
  .desc(
    `
Tests that resolve query set with invalid firstQuery and queryCount:
- firstQuery and/or queryCount out of range
  `
  )
  .paramsSubcasesOnly([
    { firstQuery: 0, queryCount: kQueryCount }, // control case
    { firstQuery: 0, queryCount: kQueryCount + 1 },
    { firstQuery: 1, queryCount: kQueryCount },
    { firstQuery: kQueryCount, queryCount: 1 },
  ])
  .fn(async t => {
    const { firstQuery, queryCount } = t.params;

    const querySet = t.device.createQuerySet({ type: 'occlusion', count: kQueryCount });
    const destination = t.device.createBuffer({
      size: kQueryCount * 8,
      usage: GPUBufferUsage.QUERY_RESOLVE,
    });

    const encoder = t.createEncoder('non-pass');
    encoder.encoder.resolveQuerySet(querySet, firstQuery, queryCount, destination, 0);
    encoder.validateFinish(firstQuery + queryCount <= kQueryCount);
  });

g.test('resolveQuerySet,destination_buffer_usage')
  .desc(
    `
Tests that resolve query set with invalid destinationBuffer:
- Buffer usage {with, without} QUERY_RESOLVE
  `
  )
  .paramsSubcasesOnly(u =>
    u //
      .combine('bufferUsage', [
        GPUConst.BufferUsage.STORAGE,
        GPUConst.BufferUsage.QUERY_RESOLVE, // control case
      ] as const)
  )
  .fn(async t => {
    const querySet = t.device.createQuerySet({ type: 'occlusion', count: kQueryCount });
    const destination = t.device.createBuffer({
      size: kQueryCount * 8,
      usage: t.params.bufferUsage,
    });

    const encoder = t.createEncoder('non-pass');
    encoder.encoder.resolveQuerySet(querySet, 0, kQueryCount, destination, 0);
    encoder.validateFinish(t.params.bufferUsage === GPUConst.BufferUsage.QUERY_RESOLVE);
  });

g.test('resolveQuerySet,destination_offset')
  .desc(
    `
Tests that resolve query set with invalid destinationOffset:
- destinationOffset is not a multiple of 256
- The size of destinationBuffer - destinationOffset < queryCount * 8
- destinationOffset out of range
  `
  )
  .paramsSubcasesOnly(u => u.combine('destinationOffset', [0, 8, 256, 512, 768]))
  .fn(async t => {
    const { destinationOffset } = t.params;
    const querySet = t.device.createQuerySet({ type: 'occlusion', count: kQueryCount });
    const size = (kQueryCount - 1) * 8 + 512;
    const destination = t.device.createBuffer({
      size,
      usage: GPUBufferUsage.QUERY_RESOLVE,
    });

    const encoder = t.createEncoder('non-pass');
    encoder.encoder.resolveQuerySet(querySet, 0, kQueryCount, destination, destinationOffset);
    encoder.validateFinish(
      destinationOffset % 256 === 0 && destinationOffset + kQueryCount * 8 <= size
    );
  });

g.test('query_set_buffer,device_mismatch')
  .desc(
    'Tests resolveQuerySet cannot be called with a query set or destination buffer created from another device'
  )
  .paramsSubcasesOnly([
    { querySetMismatched: false, bufferMismatched: false }, // control case
    { querySetMismatched: true, bufferMismatched: false },
    { querySetMismatched: false, bufferMismatched: true },
  ] as const)
  .unimplemented();
