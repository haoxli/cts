/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution Tests for non-matrix f16 remainder expression
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';
import { Type } from '../../../../util/conversion.js';
import { allInputSources, run } from '../expression.js';

import { binary, compoundBinary } from './binary.js';
import { d } from './f16_remainder.cache.js';

export const g = makeTestGroup(AllFeaturesMaxLimitsGPUTest);

g.test('scalar').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
  `
Expression: x % y, where x and y are scalars
Accuracy: Derived from x - y * trunc(x/y)
`
).
params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  const cases = await d.get(
    t.params.inputSource === 'const' ? 'scalar_const' : 'scalar_non_const'
  );
  await run(t, binary('%'), [Type.f16, Type.f16], Type.f16, t.params, cases);
});

g.test('vector').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
  `
Expression: x % y, where x and y are vectors
Accuracy: Derived from x - y * trunc(x/y)
`
).
params((u) => u.combine('inputSource', allInputSources).combine('vectorize', [2, 3, 4])).
fn(async (t) => {
  t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  const cases = await d.get(
    t.params.inputSource === 'const' ? 'scalar_const' : 'scalar_non_const'
  );
  await run(t, binary('%'), [Type.f16, Type.f16], Type.f16, t.params, cases);
});

g.test('scalar_compound').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
  `
Expression: x %= y
Accuracy: Derived from x - y * trunc(x/y)
`
).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])
).
fn(async (t) => {
  t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  const cases = await d.get(
    t.params.inputSource === 'const' ? 'scalar_const' : 'scalar_non_const'
  );
  await run(t, compoundBinary('%='), [Type.f16, Type.f16], Type.f16, t.params, cases);
});

g.test('vector_scalar').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
  `
Expression: x % y, where x is a vector and y is a scalar
Accuracy: Correctly rounded
`
).
params((u) => u.combine('inputSource', allInputSources).combine('dim', [2, 3, 4])).
fn(async (t) => {
  t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  const dim = t.params.dim;
  const cases = await d.get(
    t.params.inputSource === 'const' ? `vec${dim}_scalar_const` : `vec${dim}_scalar_non_const`
  );
  await run(
    t,
    binary('%'),
    [Type.vec(dim, Type.f16), Type.f16],
    Type.vec(dim, Type.f16),
    t.params,
    cases
  );
});

g.test('vector_scalar_compound').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
  `
Expression: x %= y, where x is a vector and y is a scalar
Accuracy: Correctly rounded
`
).
params((u) => u.combine('inputSource', allInputSources).combine('dim', [2, 3, 4])).
fn(async (t) => {
  t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  const dim = t.params.dim;
  const cases = await d.get(
    t.params.inputSource === 'const' ? `vec${dim}_scalar_const` : `vec${dim}_scalar_non_const`
  );
  await run(
    t,
    compoundBinary('%='),
    [Type.vec(dim, Type.f16), Type.f16],
    Type.vec(dim, Type.f16),
    t.params,
    cases
  );
});

g.test('scalar_vector').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
  `
Expression: x % y, where x is a scalar and y is a vector
Accuracy: Correctly rounded
`
).
params((u) => u.combine('inputSource', allInputSources).combine('dim', [2, 3, 4])).
fn(async (t) => {
  t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  const dim = t.params.dim;
  const cases = await d.get(
    t.params.inputSource === 'const' ? `scalar_vec${dim}_const` : `scalar_vec${dim}_non_const`
  );
  await run(
    t,
    binary('%'),
    [Type.f16, Type.vec(dim, Type.f16)],
    Type.vec(dim, Type.f16),
    t.params,
    cases
  );
});
//# sourceMappingURL=f16_remainder.spec.js.map