export const description = `
Validation for encoding begin/endable queries.

TODO:
- balance: {
    - begin 0, end 1
    - begin 1, end 0
    - begin 1, end 1
    - begin 2, end 2
    - }
    - x= {
        - render pass + pipeline statistics
        - compute pass + pipeline statistics
        - }
`;

import { pbool } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

import {
  beginRenderPassWithQuerySet,
  createQuerySetWithType,
  createRenderEncoderWithQuerySet,
} from './common.js';

export const g = makeTestGroup(ValidationTest);

g.test('occlusion_query,begin_end_balance')
  .desc(
    `
Tests that begin/end occlusion queries mismatch on render pass:
- begin n queries, then end m queries, for various n and m.
  `
  )
  .subcases(
    () =>
      [
        { begin: 0, end: 1 },
        { begin: 1, end: 0 },
        { begin: 1, end: 1 }, // control case
        { begin: 1, end: 2 },
        { begin: 2, end: 1 },
      ] as const
  )
  .fn(async t => {
    const { begin, end } = t.params;
    const querySet = createQuerySetWithType(t, 'occlusion', 2);

    const encoder = createRenderEncoderWithQuerySet(t, querySet);
    for (let i = 0; i < begin; i++) {
      encoder.encoder.beginOcclusionQuery(i);
    }
    for (let j = 0; j < end; j++) {
      encoder.encoder.endOcclusionQuery();
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, begin !== end);
  });

g.test('occlusion_query,begin_end_invalid_nesting')
  .desc(
    `
Tests the invalid nesting of begin/end occlusion queries:
- begin index 0, end, begin index 0, end (control case)
- begin index 0, begin index 0, end, end
- begin index 0, begin index 1, end, end
  `
  )
  .subcases(
    () =>
      [
        { calls: [0, 'end', 1, 'end'] }, // control case
        { calls: [0, 0, 'end', 'end'] },
        { calls: [0, 1, 'end', 'end'] },
      ] as const
  )
  .fn(async t => {
    const querySet = createQuerySetWithType(t, 'occlusion', 2);

    const encoder = createRenderEncoderWithQuerySet(t, querySet);

    t.params.calls.forEach(i => {
      if (i !== 'end') {
        encoder.encoder.beginOcclusionQuery(Number(i));
      } else {
        encoder.encoder.endOcclusionQuery();
      }
    });

    t.expectValidationError(() => {
      encoder.finish();
    }, t.params.calls[1] !== 'end');
  });

g.test('occlusion_query,disjoint_queries_with_same_query_index')
  .desc(
    `
Tests that two disjoint occlusion queries cannot be begun with same query index on same render pass:
- begin index 0, end, begin index 0, end
- call on {same (invalid), different (control case)} render pass
  `
  )
  .subcases(() => pbool('isOnSameRenderPass'))
  .fn(async t => {
    const querySet = createQuerySetWithType(t, 'occlusion', 1);

    const encoder = t.device.createCommandEncoder();
    const pass = beginRenderPassWithQuerySet(t, encoder, querySet);
    pass.beginOcclusionQuery(0);
    pass.endOcclusionQuery();

    if (t.params.isOnSameRenderPass) {
      pass.beginOcclusionQuery(0);
      pass.endOcclusionQuery();
      pass.endPass();
    } else {
      pass.endPass();
      const otherPass = beginRenderPassWithQuerySet(t, encoder, querySet);
      otherPass.beginOcclusionQuery(0);
      otherPass.endOcclusionQuery();
      otherPass.endPass();
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, t.params.isOnSameRenderPass);
  });

g.test('nesting')
  .desc(
    `
Tests that whether it's allowed to nest various types of queries:
- call {occlusion, pipeline-statistics, timestamp} query in same type or other type.
  `
  )
  .subcases(
    () =>
      [
        { begin: 'occlusion', nest: 'timestamp', end: 'occlusion', _valid: true },
        { begin: 'occlusion', nest: 'occlusion', end: 'occlusion', _valid: false },
        { begin: 'occlusion', nest: 'pipeline-statistics', end: 'occlusion', _valid: true },
        {
          begin: 'occlusion',
          nest: 'pipeline-statistics',
          end: 'pipeline-statistics',
          _valid: true,
        },
        {
          begin: 'pipeline-statistics',
          nest: 'timestamp',
          end: 'pipeline-statistics',
          _valid: true,
        },
        {
          begin: 'pipeline-statistics',
          nest: 'pipeline-statistics',
          end: 'pipeline-statistics',
          _valid: false,
        },
        {
          begin: 'pipeline-statistics',
          nest: 'occlusion',
          end: 'pipeline-statistics',
          _valid: true,
        },
        { begin: 'pipeline-statistics', nest: 'occlusion', end: 'occlusion', _valid: true },
        { begin: 'timestamp', nest: 'occlusion', end: 'occlusion', _valid: true },
        {
          begin: 'timestamp',
          nest: 'pipeline-statistics',
          end: 'pipeline-statistics',
          _valid: true,
        },
      ] as const
  )
  .unimplemented();
