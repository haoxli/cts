/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Test GPUAdapter.requestDevice.

Note tests explicitly destroy created devices so that tests don't have to wait for GC to clean up
potentially limited native resources.
`;import { Fixture } from '../../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getGPU } from '../../../../common/util/navigator_gpu.js';
import { assert, assertReject, raceWithRejectOnTimeout } from '../../../../common/util/util.js';
import {
  getDefaultLimitsForAdapter,
  kFeatureNames,
  kLimits,
  kLimitClasses } from
'../../../capability_info.js';
import { clamp, isPowerOfTwo } from '../../../util/math.js';

export const g = makeTestGroup(Fixture);

g.test('default').
desc(
  `
    Test requesting the device with a variation of default parameters.
    - No features listed in default device
    - Default limits`
).
paramsSubcasesOnly((u) =>
u.combine('args', [
[],
[undefined],
[{}],
[{ requiredFeatures: [], requiredLimits: {} }]]
)
).
fn(async (t) => {
  const { args } = t.params;
  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);
  const device = await t.requestDeviceTracked(adapter, ...args);
  assert(device !== null);

  // Default device should have no features.
  t.expect(device.features.size === 0, 'Default device should not have any features');
  // All limits should be defaults.
  const limitInfo = getDefaultLimitsForAdapter(adapter);
  for (const limit of kLimits) {
    t.expect(
      device.limits[limit] === limitInfo[limit].default,
      `Expected ${limit} == default: ${device.limits[limit]} != ${limitInfo[limit].default}`
    );
  }
});

g.test('invalid').
desc(
  `
    Test that requesting device on an invalid adapter resolves with lost device.
    - Induce invalid adapter via a device lost from a device.destroy()
    - Check the device is lost with reason 'destroyed'
    - Try creating another device on the now-stale adapter
    - Check that returns a device lost with 'unknown'
    `
).
fn(async (t) => {
  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  {
    // Request a device and destroy it immediately afterwards.
    const device = await t.requestDeviceTracked(adapter);
    assert(device !== null);
    device.destroy();
    const lostInfo = await device.lost;
    t.expect(lostInfo.reason === 'destroyed');
  }

  // The adapter should now be invalid since a device was lost. Requesting another device should
  // return an already lost device.
  const kTimeoutMS = 1000;
  const device = await t.requestDeviceTracked(adapter);
  const lost = await raceWithRejectOnTimeout(device.lost, kTimeoutMS, 'device was not lost');
  t.expect(lost.reason === 'unknown');
});

g.test('stale').
desc(
  `
    Test that adapter.requestDevice() can successfully return a device once, and once only.
    - Tests that we can successfully resolve after serial and concurrent rejections.
    - Tests that consecutive valid attempts only succeeds the first time, returning lost device otherwise.`
).
paramsSubcasesOnly((u) =>
u.
combine('initialError', [undefined, 'TypeError', 'OperationError']).
combine('awaitInitialError', [true, false]).
combine('awaitSuccess', [true, false]).
unless(
  ({ initialError, awaitInitialError }) => initialError === undefined && awaitInitialError
)
).
fn(async (t) => {
  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  const { initialError, awaitInitialError, awaitSuccess } = t.params;

  switch (initialError) {
    case undefined:
      break;
    case 'TypeError':
      // Cause a type error by requesting with an unknown feature.
      if (awaitInitialError) {
        await assertReject(
          'TypeError',
          t.requestDeviceTracked(adapter, {
            requiredFeatures: ['unknown-feature']
          })
        );
      } else {
        t.shouldReject(
          'TypeError',
          t.requestDeviceTracked(adapter, {
            requiredFeatures: ['unknown-feature']
          })
        );
      }
      break;
    case 'OperationError':
      // Cause an operation error by requesting with an alignment limit that is not a power of 2.
      if (awaitInitialError) {
        await assertReject(
          'OperationError',
          t.requestDeviceTracked(adapter, {
            requiredLimits: { minUniformBufferOffsetAlignment: 255 }
          })
        );
      } else {
        t.shouldReject(
          'OperationError',
          t.requestDeviceTracked(adapter, {
            requiredLimits: { minUniformBufferOffsetAlignment: 255 }
          })
        );
      }
      break;
  }

  let device = undefined;
  const promise = t.requestDeviceTracked(adapter);
  if (awaitSuccess) {
    device = await promise;
    assert(device !== null);
  } else {
    t.shouldResolve(
      (async () => {
        const device = await promise;
        device.destroy();
      })()
    );
  }

  const kTimeoutMS = 1000;
  const lostDevice = await t.requestDeviceTracked(adapter);
  const lost = await raceWithRejectOnTimeout(
    lostDevice.lost,
    kTimeoutMS,
    'adapter was not stale'
  );
  t.expect(lost.reason === 'unknown');

  // Make sure to destroy the valid device after trying to get a second one. Otherwise, the second
  // device may fail because the adapter is put into an invalid state from the destroy.
  if (device) {
    device.destroy();
  }
});

g.test('features,unknown').
desc(
  `
    Test requesting device with an unknown feature.`
).
fn(async (t) => {
  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  t.shouldReject(
    'TypeError',
    t.requestDeviceTracked(adapter, { requiredFeatures: ['unknown-feature'] })
  );
});

g.test('features,known').
desc(
  `
    Test requesting device with all features.
    - Succeeds with device supporting feature if adapter supports the feature.
    - Rejects if the adapter does not support the feature.`
).
params((u) => u.combine('feature', kFeatureNames)).
fn(async (t) => {
  const { feature } = t.params;

  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  const promise = t.requestDeviceTracked(adapter, { requiredFeatures: [feature] });
  if (adapter.features.has(feature)) {
    const device = await promise;
    t.expect(device.features.has(feature), 'Device should include the required feature');
  } else {
    t.shouldReject('TypeError', promise);
  }
});

g.test('limits,unknown').
desc(
  `
    Test that specifying limits that aren't part of the supported limit set causes
    requestDevice to reject unless the value is undefined.
    Also tests that the invalid requestDevice() call does not expire the adapter.`
).
fn(async (t) => {
  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  t.shouldReject(
    'OperationError',
    t.requestDeviceTracked(adapter, { requiredLimits: { unknownLimitName: 9000 } })
  );
  // Adapter is still alive because the requestDevice() call was invalid.

  const device = await t.requestDeviceTracked(adapter, {
    requiredLimits: { unknownLimitName: undefined }
  });
  assert(device !== null);
});

g.test('limits,supported').
desc(
  `
    Test that each supported limit can be specified with valid values.
    - Tests each limit with the default values given by the spec
    - Tests each limit with the supported values given by the adapter
    - Tests each limit with undefined`
).
params((u) =>
u.
combine('limit', kLimits).
beginSubcases().
combine('limitValue', ['default', 'adapter', 'undefined'])
).
fn(async (t) => {
  const { limit, limitValue } = t.params;

  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  const limitInfo = getDefaultLimitsForAdapter(adapter);
  let value = -1;
  let result = -1;
  switch (limitValue) {
    case 'default':
      value = limitInfo[limit].default;
      result = value;
      break;
    case 'adapter':
      value = adapter.limits[limit];
      result = value;
      break;
    case 'undefined':
      value = undefined;
      result = limitInfo[limit].default;
      break;
  }

  const requiredLimits = { [limit]: value };

  if (
  limit === 'maxStorageBuffersInFragmentStage' ||
  limit === 'maxStorageBuffersInVertexStage')
  {
    requiredLimits['maxStorageBuffersPerShaderStage'] = value;
  }

  if (
  limit === 'maxStorageTexturesInFragmentStage' ||
  limit === 'maxStorageTexturesInVertexStage')
  {
    requiredLimits['maxStorageTexturesPerShaderStage'] = value;
  }

  const device = await t.requestDeviceTracked(adapter, { requiredLimits });
  assert(device !== null);
  t.expect(
    device.limits[limit] === result,
    `Devices reported limit for ${limit}(${device.limits[limit]}) should match the required limit (${result})`
  );
});

g.test('limit,better_than_supported').
desc(
  `
    Test that specifying a better limit than what the adapter supports causes requestDevice to
    reject.
    - Tests each limit
    - Tests requesting better limits by various amounts`
).
params((u) =>
u.
combine('limit', kLimits).
beginSubcases().
expandWithParams((p) => {
  switch (kLimitClasses[p.limit]) {
    case 'maximum':
      return [
      { mul: 1, add: 1 },
      { mul: 1, add: 100 }];

    case 'alignment':
      return [
      { mul: 1, add: -1 },
      { mul: 1 / 2, add: 0 },
      { mul: 1 / 1024, add: 0 }];

  }
})
).
fn(async (t) => {
  const { limit, mul, add } = t.params;

  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  const limitInfo = getDefaultLimitsForAdapter(adapter);
  const value = adapter.limits[limit] * mul + add;
  const requiredLimits = {
    [limit]: clamp(value, { min: 0, max: limitInfo[limit].maximumValue })
  };

  t.shouldReject('OperationError', t.requestDeviceTracked(adapter, { requiredLimits }));
});

g.test('limit,out_of_range').
desc(
  `
    Test that specifying limits that are out of range (<0, >MAX_SAFE_INTEGER, >2**31-2 for 32-bit
    limits, =0 for alignment limits) produce the appropriate error (TypeError or OperationError).
    `
).
params((u) =>
u.
combine('limit', kLimits).
beginSubcases().
expand('value', function* () {
  yield -(2 ** 64);
  yield Number.MIN_SAFE_INTEGER - 3;
  yield Number.MIN_SAFE_INTEGER - 1;
  yield Number.MIN_SAFE_INTEGER;
  yield -(2 ** 32);
  yield -1;
  yield 0;
  yield 2 ** 32 - 2;
  yield 2 ** 32 - 1;
  yield 2 ** 32;
  yield 2 ** 32 + 1;
  yield 2 ** 32 + 2;
  yield Number.MAX_SAFE_INTEGER;
  yield Number.MAX_SAFE_INTEGER + 1;
  yield Number.MAX_SAFE_INTEGER + 3;
  yield 2 ** 64;
  yield Number.MAX_VALUE;
})
).
fn(async (t) => {
  const { limit, value } = t.params;

  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);
  const limitInfo = getDefaultLimitsForAdapter(adapter)[limit];

  const requiredLimits = {
    [limit]: value
  };

  const errorName =
  value < 0 || value > Number.MAX_SAFE_INTEGER ?
  'TypeError' :
  limitInfo.class === 'maximum' && value > adapter.limits[limit] ?
  'OperationError' :
  limitInfo.class === 'alignment' && (value > 2 ** 31 || !isPowerOfTwo(value)) ?
  'OperationError' :
  false;

  const devicePromise = t.requestDeviceTracked(adapter, { requiredLimits });
  if (errorName) {
    t.shouldReject(errorName, devicePromise);
  } else {
    await devicePromise;
  }
});

g.test('limit,worse_than_default').
desc(
  `
    Test that specifying a worse limit than the default values required by the spec cause the value
    to clamp.
    - Tests each limit
    - Tests requesting worse limits by various amounts`
).
params((u) =>
u.
combine('limit', kLimits).
beginSubcases().
expandWithParams((p) => {
  switch (kLimitClasses[p.limit]) {
    case 'maximum':
      return [
      { mul: 1, add: -1 },
      { mul: 1, add: -100 }];

    case 'alignment':
      return [
      { mul: 1, add: 1 },
      { mul: 2, add: 0 },
      { mul: 1024, add: 0 }];

  }
})
).
fn(async (t) => {
  const { limit, mul, add } = t.params;

  const gpu = getGPU(t.rec);
  const adapter = await gpu.requestAdapter();
  assert(adapter !== null);

  const limitInfo = getDefaultLimitsForAdapter(adapter);
  const value = limitInfo[limit].default * mul + add;
  const requiredLimits = {
    [limit]: clamp(value, { min: 0, max: limitInfo[limit].maximumValue })
  };

  let success;
  switch (limitInfo[limit].class) {
    case 'alignment':
      success = isPowerOfTwo(value);
      break;
    case 'maximum':
      success = true;
      break;
  }

  const devicePromise = t.requestDeviceTracked(adapter, { requiredLimits });
  if (success) {
    const device = await devicePromise;
    assert(device !== null);
    t.expect(
      device.limits[limit] === limitInfo[limit].default,
      'Devices reported limit should match the default limit'
    );
    device.destroy();
  } else {
    t.shouldReject('OperationError', devicePromise);
  }
});

g.test('always_returns_device').
desc(
  `
    Test that if requestAdapter returns an adapter then requestDevice must return a device.

    requestAdapter -> null = ok
    requestAdapter -> adapter, requestDevice -> device (lost or not) = ok
    requestAdapter -> adapter, requestDevice = null = Invalid: not spec compliant.

    Note: requestDevice can throw for invalid parameters like requesting features not
    in the adapter, reqesting limits not in the adapter, requesting limits larger than
    the maximum for the adapter. Otherwise it does not throw.

    Note: This is a regression test for a Chrome bug crbug.com/349062459
    Checking that a requestDevice always return a device is checked in other tests above
    but those tests have 'compatibilityMode: true' set for them by the API that getGPU
    returns when the test suite is run in compatibility mode.

    This test tries to force both compat and core separately so both code paths are
    tested in the same browser configuration.
  `
).
params((u) => u.combine('compatibilityMode', [false, true])).
fn(async (t) => {
  const { compatibilityMode } = t.params;
  const gpu = getGPU(t.rec);
  // MAINTENANCE_TODO: Remove this cast compatibilityMode is added.
  const adapter = await gpu.requestAdapter({ compatibilityMode });
  if (adapter) {
    if (!compatibilityMode) {
      // This check is to make sure something lower-level is not forcing compatibility mode
      // MAINTENANCE_TODO: Remove this cast compatibilityMode is added.
      t.expect(
        !adapter.isCompatibilityMode,
        'must not be compatibility mode'
      );
    }
    const device = await t.requestDeviceTracked(adapter);
    t.expect(device instanceof GPUDevice, 'requestDevice must return a device or throw');
    device.destroy();
  }
});
//# sourceMappingURL=requestDevice.spec.js.map