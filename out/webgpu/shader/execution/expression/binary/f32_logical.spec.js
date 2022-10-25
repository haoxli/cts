/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution Tests for the f32 logical binary expression operations
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { anyOf } from '../../../../util/compare.js';
import { bool, f32, TypeBool, TypeF32 } from '../../../../util/conversion.js';
import { flushSubnormalScalarF32, kVectorTestValues } from '../../../../util/math.js';
import { allInputSources, run } from '../expression.js';

import { binary } from './binary.js';

export const g = makeTestGroup(GPUTest);

/**
 * @returns a test case for the provided left hand & right hand values and truth function.
 * Handles quantization and subnormals.
 */
function makeCase(
lhs,
rhs,
truthFunc)
{
  const f32_lhs = f32(lhs);
  const f32_rhs = f32(rhs);
  const lhs_options = new Set([f32_lhs, flushSubnormalScalarF32(f32_lhs)]);
  const rhs_options = new Set([f32_rhs, flushSubnormalScalarF32(f32_rhs)]);
  const expected = [];
  lhs_options.forEach((l) => {
    rhs_options.forEach((r) => {
      const result = bool(truthFunc(l, r));
      if (!expected.includes(result)) {
        expected.push(result);
      }
    });
  });

  return { input: [f32_lhs, f32_rhs], expected: anyOf(...expected) };
}

g.test('equals').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x == y
Accuracy: Correct result
`).

params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const truthFunc = (lhs, rhs) => {
    return lhs.value === rhs.value;
  };

  const cases = kVectorTestValues[2].map((v) => {
    return makeCase(v[0], v[1], truthFunc);
  });

  await run(t, binary('=='), [TypeF32, TypeF32], TypeBool, t.params, cases);
});

g.test('not_equals').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x != y
Accuracy: Correct result
`).

params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const truthFunc = (lhs, rhs) => {
    return lhs.value !== rhs.value;
  };

  const cases = kVectorTestValues[2].map((v) => {
    return makeCase(v[0], v[1], truthFunc);
  });

  await run(t, binary('!='), [TypeF32, TypeF32], TypeBool, t.params, cases);
});

g.test('less_than').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x < y
Accuracy: Correct result
`).

params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const truthFunc = (lhs, rhs) => {
    return lhs.value < rhs.value;
  };

  const cases = kVectorTestValues[2].map((v) => {
    return makeCase(v[0], v[1], truthFunc);
  });

  await run(t, binary('<'), [TypeF32, TypeF32], TypeBool, t.params, cases);
});

g.test('less_equals').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x <= y
Accuracy: Correct result
`).

params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const truthFunc = (lhs, rhs) => {
    return lhs.value <= rhs.value;
  };

  const cases = kVectorTestValues[2].map((v) => {
    return makeCase(v[0], v[1], truthFunc);
  });

  await run(t, binary('<='), [TypeF32, TypeF32], TypeBool, t.params, cases);
});

g.test('greater_than').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x > y
Accuracy: Correct result
`).

params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const truthFunc = (lhs, rhs) => {
    return lhs.value > rhs.value;
  };

  const cases = kVectorTestValues[2].map((v) => {
    return makeCase(v[0], v[1], truthFunc);
  });

  await run(t, binary('>'), [TypeF32, TypeF32], TypeBool, t.params, cases);
});

g.test('greater_equals').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x >= y
Accuracy: Correct result
`).

params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const truthFunc = (lhs, rhs) => {
    return lhs.value >= rhs.value;
  };

  const cases = kVectorTestValues[2].map((v) => {
    return makeCase(v[0], v[1], truthFunc);
  });

  await run(t, binary('>='), [TypeF32, TypeF32], TypeBool, t.params, cases);
});
//# sourceMappingURL=f32_logical.spec.js.map