/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'step' builtin function

S is abstract-float, f32, f16
T is S or vecN<S>
@const fn step(edge: T ,x: T ) -> T
Returns 1.0 if edge ≤ x, and 0.0 otherwise. Component-wise when T is a vector.
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../../gpu_test.js';
import { Type } from '../../../../../util/conversion.js';
import { allInputSources, onlyConstInputSource, run } from '../../expression.js';

import { abstractFloatBuiltin, builtin } from './builtin.js';
import { d } from './step.cache.js';

export const g = makeTestGroup(AllFeaturesMaxLimitsGPUTest);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`abstract float tests`).
params((u) =>
u.
combine('inputSource', onlyConstInputSource).
combine('vectorize', [undefined, 2, 3, 4])
).
fn(async (t) => {
  const cases = await d.get('abstract');
  await run(
    t,
    abstractFloatBuiltin('step'),
    [Type.abstractFloat, Type.abstractFloat],
    Type.abstractFloat,
    t.params,
    cases
  );
});

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`f32 tests`).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])
).
fn(async (t) => {
  const cases = await d.get('f32');
  await run(t, builtin('step'), [Type.f32, Type.f32], Type.f32, t.params, cases);
});

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`f16 tests`).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])
).
fn(async (t) => {
  t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  const cases = await d.get('f16');
  await run(t, builtin('step'), [Type.f16, Type.f16], Type.f16, t.params, cases);
});