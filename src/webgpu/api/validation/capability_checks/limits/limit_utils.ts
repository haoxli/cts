import { kUnitCaseParamsBuilder } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../common/util/data_tables.js';
import { getGPU } from '../../../../../common/util/navigator_gpu.js';
import { assert, range, reorder, ReorderOrder } from '../../../../../common/util/util.js';
import { kLimitInfo } from '../../../../capability_info.js';
import { GPUTestBase } from '../../../../gpu_test.js';

type GPUSupportedLimit = keyof GPUSupportedLimits;

const CreatePipelineTypes = {
  createRenderPipeline: true,
  createRenderPipelineWithFragmentStage: true,
  createComputePipeline: true,
};
export type CreatePipelineType = keyof typeof CreatePipelineTypes;
export const kCreatePipelineTypes = keysOf(CreatePipelineTypes);

const CreatePipelineAsyncTypes = {
  createRenderPipelineAsync: true,
  createRenderPipelineAsyncWithFragmentStage: true,
  createComputePipelineAsync: true,
};
export type CreatePipelineAsyncType = keyof typeof CreatePipelineAsyncTypes;
export const kCreatePipelineAsyncTypes = keysOf(CreatePipelineAsyncTypes);

const RenderEncoderTypes = {
  render: true,
  renderBundle: true,
};
export type RenderEncoderType = keyof typeof RenderEncoderTypes;
export const kRenderEncoderTypes = keysOf(RenderEncoderTypes);

const EncoderTypes = {
  compute: true,
  render: true,
  renderBundle: true,
};
export type EncoderType = keyof typeof EncoderTypes;
export const kEncoderTypes = keysOf(EncoderTypes);

const BindGroupTests = {
  sameGroup: true,
  differentGroups: true,
};
export type BindGroupTest = keyof typeof BindGroupTests;
export const kBindGroupTests = keysOf(BindGroupTests);

const BindingCombinations = {
  vertex: true,
  fragment: true,
  vertexAndFragmentWithPossibleVertexStageOverflow: true,
  vertexAndFragmentWithPossibleFragmentStageOverflow: true,
  compute: true,
};
export type BindingCombination = keyof typeof BindingCombinations;
export const kBindingCombinations = keysOf(BindingCombinations);

export function getPipelineTypeForBindingCombination(bindingCombination: BindingCombination) {
  switch (bindingCombination) {
    case 'vertex':
      return 'createRenderPipeline';
    case 'fragment':
    case 'vertexAndFragmentWithPossibleVertexStageOverflow':
    case 'vertexAndFragmentWithPossibleFragmentStageOverflow':
      return 'createRenderPipelineWithFragmentStage';
    case 'compute':
      return 'createComputePipeline';
  }
}

export function getPipelineAsyncTypeForBindingCombination(bindingCombination: BindingCombination) {
  switch (bindingCombination) {
    case 'vertex':
      return 'createRenderPipelineAsync';
    case 'fragment':
    case 'vertexAndFragmentWithPossibleVertexStageOverflow':
    case 'vertexAndFragmentWithPossibleFragmentStageOverflow':
      return 'createRenderPipelineAsyncWithFragmentStage';
    case 'compute':
      return 'createComputePipelineAsync';
  }
}

function getBindGroupIndex(bindGroupTest: BindGroupTest, i: number) {
  switch (bindGroupTest) {
    case 'sameGroup':
      return 0;
    case 'differentGroups':
      return i % 3;
  }
}

function getWGSLBindings(
  order: ReorderOrder,
  bindGroupTest: BindGroupTest,
  storageDefinitionWGSLSnippetFn: (i: number, j: number) => string,
  numBindings: number,
  id: number
) {
  return reorder(
    order,
    range(
      numBindings,
      i =>
        `@group(${getBindGroupIndex(
          bindGroupTest,
          i
        )}) @binding(${i}) ${storageDefinitionWGSLSnippetFn(i, id)};`
    )
  ).join('\n');
}

export function getPerStageWGSLForBindingCombinationImpl(
  bindingCombination: BindingCombination,
  order: ReorderOrder,
  bindGroupTest: BindGroupTest,
  storageDefinitionWGSLSnippetFn: (i: number, j: number) => string,
  bodyFn: (numBindings: number, set: number) => string,
  numBindings: number,
  extraWGSL = ''
) {
  switch (bindingCombination) {
    case 'vertex':
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          ${bodyFn(numBindings, 0)}
          return vec4f(0);
        }
      `;
    case 'fragment':
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          return vec4f(0);
        }
        @fragment fn mainFS() -> @location(0) vec4f {
          ${bodyFn(numBindings, 0)}
          return vec4f(0);
        }
      `;
    case 'vertexAndFragmentWithPossibleVertexStageOverflow': {
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings - 1, 1)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          ${bodyFn(numBindings, 0)}
          return vec4f(0);
        }
        @fragment fn mainFS() -> @location(0) vec4f {
          ${bodyFn(numBindings - 1, 1)}
          return vec4f(0);
        }
      `;
    }
    case 'vertexAndFragmentWithPossibleFragmentStageOverflow': {
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings - 1, 0)}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 1)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          ${bodyFn(numBindings - 1, 0)}
          return vec4f(0);
        }
        @fragment fn mainFS() -> @location(0) vec4f {
          ${bodyFn(numBindings, 1)}
          return vec4f(0);
        }
      `;
    }
    case 'compute':
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        @group(3) @binding(0) var<storage, read_write> d: f32;
        @compute @workgroup_size(1) fn main() {
          ${bodyFn(numBindings, 0)}
        }
      `;
      break;
  }
}

export function getPerStageWGSLForBindingCombination(
  bindingCombination: BindingCombination,
  order: ReorderOrder,
  bindGroupTest: BindGroupTest,
  storageDefinitionWGSLSnippetFn: (i: number, j: number) => string,
  usageWGSLSnippetFn: (i: number, j: number) => string,
  numBindings: number,
  extraWGSL = ''
) {
  return getPerStageWGSLForBindingCombinationImpl(
    bindingCombination,
    order,
    bindGroupTest,
    storageDefinitionWGSLSnippetFn,
    (numBindings: number, set: number) =>
      `${range(numBindings, i => usageWGSLSnippetFn(i, set)).join('\n')}`,
    numBindings,
    extraWGSL
  );
}

export function getPerStageWGSLForBindingCombinationStorageTextures(
  bindingCombination: BindingCombination,
  order: ReorderOrder,
  bindGroupTest: BindGroupTest,
  storageDefinitionWGSLSnippetFn: (i: number, j: number) => string,
  usageWGSLSnippetFn: (i: number, j: number) => string,
  numBindings: number,
  extraWGSL = ''
) {
  return getPerStageWGSLForBindingCombinationImpl(
    bindingCombination,
    order,
    bindGroupTest,
    storageDefinitionWGSLSnippetFn,
    (numBindings: number, set: number) => {
      return bindingCombination === 'compute'
        ? `${range(numBindings, i => usageWGSLSnippetFn(i, set)).join('\n')};`
        : `${range(numBindings, i => usageWGSLSnippetFn(i, set)).join('\n')};`;
    },
    numBindings,
    extraWGSL
  );
}

// MAINTENANCE_TODO: rename LimitsModes to MaximumLimitsModes and update its derivatives.
const LimitModes = {
  defaultLimit: true,
  maxLimit: true,
};
export type LimitMode = keyof typeof LimitModes;
export const kLimitModes = keysOf(LimitModes);
export type LimitsRequest = Record<string, LimitMode>;

// MAINTENANCE_TODO: rename TestValues to MaximumTestValues and update its derivatives.
export const TestValues = {
  atLimit: true,
  overLimit: true,
};
export type TestValue = keyof typeof TestValues;
export const kTestValueKeys = keysOf(TestValues);

export function getTestValue(limit: number, testValue: TestValue) {
  switch (testValue) {
    case 'atLimit':
      return limit;
    case 'overLimit':
      return limit + 1;
  }
}

export const MinimumTestValues = {
  atLimit: true,
  underLimit: true,
};
export type MinimumTestValue = keyof typeof MinimumTestValues;
export const kMinimumTestValueKeys = keysOf(MinimumTestValues);

// MAINTENANCE_TODO: rename LimitValueTests to MaximumLimitValueTests and update its derivatives.
export const LimitValueTests = {
  atDefault: true,
  underDefault: true,
  betweenDefaultAndMaximum: true,
  atMaximum: true,
  overMaximum: true,
};
export type LimitValueTest = keyof typeof LimitValueTests;
export const kLimitValueTestKeys = keysOf(LimitValueTests);

export function getLimitValue(
  defaultLimit: number,
  maximumLimit: number,
  limitValueTest: LimitValueTest
) {
  switch (limitValueTest) {
    case 'atDefault':
      return defaultLimit;
    case 'underDefault':
      return defaultLimit - 1;
    case 'betweenDefaultAndMaximum':
      return ((defaultLimit + maximumLimit) / 2) | 0;
    case 'atMaximum':
      return maximumLimit;
    case 'overMaximum':
      return maximumLimit + 1;
  }
}

export const MinimumLimitValueTests = {
  atDefault: true,
  overDefault: true,
  betweenDefaultAndMinimum: true,
  atMinimum: true,
  underMinimum: true,
};
export type MinimumLimitValueTest = keyof typeof MinimumLimitValueTests;
export const kMinimumLimitValueTestKeys = keysOf(MinimumLimitValueTests);

export function getDefaultLimit(limit: GPUSupportedLimit): number {
  return (kLimitInfo as Record<string, { default: number }>)[limit].default;
}

// MAINTENANCE_TODO: rename maximumLimit here and in LimitTestImpl to adapterLimit
export type DeviceAndLimits = {
  device: GPUDevice;
  defaultLimit: number;
  maximumLimit: number;
  requestedLimit: number;
  actualLimit: number;
};

export type SpecificLimitTestInputs = DeviceAndLimits & {
  testValue: number;
  shouldError: boolean;
};

export type LimitTestInputs = SpecificLimitTestInputs & {
  testValueName: TestValue;
};

const kMinimumLimits = new Set<GPUSupportedLimit>([
  'minUniformBufferOffsetAlignment',
  'minStorageBufferOffsetAlignment',
]);

/**
 * Adds the default parameters to a limit test
 */
export const kLimitBaseParams = kUnitCaseParamsBuilder
  .combine('limitTest', kLimitValueTestKeys)
  .beginSubcases()
  .combine('testValueName', kTestValueKeys);

export const kMinimumLimitBaseParams = kUnitCaseParamsBuilder
  .combine('limitTest', kMinimumLimitValueTestKeys)
  .beginSubcases()
  .combine('testValueName', kMinimumTestValueKeys);

export class LimitTestsImpl extends GPUTestBase {
  _adapter: GPUAdapter | null = null;
  _device: GPUDevice | undefined = undefined;
  limit: GPUSupportedLimit = '' as GPUSupportedLimit;
  defaultLimit = 0;
  maximumLimit = 0;

  async init() {
    await super.init();
    const gpu = getGPU();
    this._adapter = await gpu.requestAdapter();
    const limit = this.limit;
    this.defaultLimit = getDefaultLimit(limit);
    this.maximumLimit = this.adapter.limits[limit] as number;
    assert(!Number.isNaN(this.defaultLimit));
    assert(!Number.isNaN(this.maximumLimit));
  }

  get adapter(): GPUAdapter {
    assert(this._adapter !== undefined);
    return this._adapter!;
  }

  get device(): GPUDevice {
    assert(this._device !== undefined, 'device is only valid in _testThenDestroyDevice callback');
    return this._device;
  }

  async requestDeviceWithLimits(
    adapter: GPUAdapter,
    requiredLimits: Record<string, number>,
    shouldReject: boolean
  ) {
    if (shouldReject) {
      this.shouldReject('OperationError', adapter.requestDevice({ requiredLimits }));
      return undefined;
    } else {
      return await adapter.requestDevice({ requiredLimits });
    }
  }

  // MAINTENANCE_TODO: rename to getDefaultOrAdapterLimit
  getDefaultOrMaximumLimit(limit: GPUSupportedLimit, limitMode: LimitMode) {
    switch (limitMode) {
      case 'defaultLimit':
        return getDefaultLimit(limit);
      case 'maxLimit':
        return this.adapter.limits[limit];
    }
  }

  /**
   * Gets a device with the adapter a requested limit and checks that that limit
   * is correct or that the device failed to create if the requested limit is
   * beyond the maximum supported by the device.
   */
  async _getDeviceWithSpecificLimit(
    requestedLimit: number,
    extraLimits?: LimitsRequest
  ): Promise<DeviceAndLimits | undefined> {
    const { adapter, limit, maximumLimit, defaultLimit } = this;

    const requiredLimits: Record<string, number> = {};
    requiredLimits[limit] = requestedLimit;

    if (extraLimits) {
      for (const [extraLimitStr, limitMode] of Object.entries(extraLimits)) {
        const extraLimit = extraLimitStr as GPUSupportedLimit;
        requiredLimits[extraLimit] =
          limitMode === 'defaultLimit'
            ? getDefaultLimit(extraLimit)
            : (adapter.limits[extraLimit] as number);
      }
    }

    const shouldReject = kMinimumLimits.has(limit)
      ? requestedLimit < maximumLimit
      : requestedLimit > maximumLimit;

    const device = await this.requestDeviceWithLimits(adapter, requiredLimits, shouldReject);
    const actualLimit = (device ? device.limits[limit] : 0) as number;

    if (shouldReject) {
      this.expect(!device);
    } else {
      if (kMinimumLimits.has(limit)) {
        if (requestedLimit <= defaultLimit) {
          this.expect(actualLimit === requestedLimit);
        } else {
          this.expect(actualLimit === defaultLimit);
        }
      } else {
        if (requestedLimit <= defaultLimit) {
          this.expect(actualLimit === defaultLimit);
        } else {
          this.expect(actualLimit === requestedLimit);
        }
      }
    }

    return device ? { device, defaultLimit, maximumLimit, requestedLimit, actualLimit } : undefined;
  }

  /**
   * Gets a device with the adapter a requested limit and checks that that limit
   * is correct or that the device failed to create if the requested limit is
   * beyond the maximum supported by the device.
   */
  async _getDeviceWithRequestedLimit(
    limitValueTest: LimitValueTest,
    extraLimits?: LimitsRequest
  ): Promise<DeviceAndLimits | undefined> {
    const { defaultLimit, maximumLimit } = this;

    const requestedLimit = getLimitValue(defaultLimit, maximumLimit, limitValueTest);
    return this._getDeviceWithSpecificLimit(requestedLimit, extraLimits);
  }

  /**
   * Call the given function and check no WebGPU errors are leaked
   */
  async _testThenDestroyDevice(
    deviceAndLimits: DeviceAndLimits,
    testValue: number,
    fn: (inputs: SpecificLimitTestInputs) => void | Promise<void>
  ) {
    assert(!this._device);

    const { device, actualLimit } = deviceAndLimits;
    this._device = device;

    const shouldError = kMinimumLimits.has(this.limit)
      ? testValue < actualLimit
      : testValue > actualLimit;

    device.pushErrorScope('internal');
    device.pushErrorScope('out-of-memory');
    device.pushErrorScope('validation');

    await fn({ ...deviceAndLimits, testValue, shouldError });

    const validationError = await device.popErrorScope();
    const outOfMemoryError = await device.popErrorScope();
    const internalError = await device.popErrorScope();

    this.expect(!validationError, validationError?.message || '');
    this.expect(!outOfMemoryError, outOfMemoryError?.message || '');
    this.expect(!internalError, internalError?.message || '');

    device.destroy();
    this._device = undefined;
  }

  /**
   * Creates a device with a specific limit.
   * If the limit of over the maximum we expect an exception
   * If the device is created then we call a test function, checking
   * that the function does not leak any GPU errors.
   */
  async testDeviceWithSpecificLimits(
    deviceLimitValue: number,
    testValue: number,
    fn: (inputs: SpecificLimitTestInputs) => void | Promise<void>,
    extraLimits?: LimitsRequest
  ) {
    assert(!this._device);

    const deviceAndLimits = await this._getDeviceWithSpecificLimit(deviceLimitValue, extraLimits);
    // If we request over the limit requestDevice will throw
    if (!deviceAndLimits) {
      return;
    }

    await this._testThenDestroyDevice(deviceAndLimits, testValue, fn);
  }

  /**
   * Creates a device with the limit defined by LimitValueTest.
   * If the limit of over the maximum we expect an exception
   * If the device is created then we call a test function, checking
   * that the function does not leak any GPU errors.
   */
  async testDeviceWithRequestedLimits(
    limitTest: LimitValueTest,
    testValueName: TestValue,
    fn: (inputs: LimitTestInputs) => void | Promise<void>,
    extraLimits?: LimitsRequest
  ) {
    assert(!this._device);

    const deviceAndLimits = await this._getDeviceWithRequestedLimit(limitTest, extraLimits);
    // If we request over the limit requestDevice will throw
    if (!deviceAndLimits) {
      return;
    }

    const { actualLimit } = deviceAndLimits;
    const testValue = getTestValue(actualLimit, testValueName);

    await this._testThenDestroyDevice(
      deviceAndLimits,
      testValue,
      async (inputs: SpecificLimitTestInputs) => {
        await fn({ ...inputs, testValueName });
      }
    );
  }

  /**
   * Calls a function that expects a GPU error if shouldError is true
   */
  // MAINTENANCE_TODO: Remove this duplicated code with GPUTest if possible
  async expectGPUErrorAsync<R>(
    filter: GPUErrorFilter,
    fn: () => R,
    shouldError: boolean = true,
    msg = ''
  ): Promise<R> {
    const { device } = this;

    device.pushErrorScope(filter);
    const returnValue = fn();
    if (returnValue instanceof Promise) {
      await returnValue;
    }

    const error = await device.popErrorScope();
    this.expect(
      !!error === shouldError,
      `${error?.message || 'no error when one was expected'}: ${msg}`
    );

    return returnValue;
  }

  /** Expect that the provided promise rejects, with the provided exception name. */
  async shouldRejectConditionally(
    expectedName: string,
    p: Promise<unknown>,
    shouldReject: boolean,
    msg?: string
  ): Promise<void> {
    if (shouldReject) {
      this.shouldReject(expectedName, p, msg);
    } else {
      this.shouldResolve(p, msg);
    }

    // We need to explicitly wait for the promise because the device may be
    // destroyed immediately after returning from this function.
    try {
      await p;
    } catch (e) {
      //
    }
  }

  /**
   * Calls a function that expects a validation error if shouldError is true
   */
  async expectValidationError<R>(fn: () => R, shouldError: boolean = true, msg = ''): Promise<R> {
    return this.expectGPUErrorAsync('validation', fn, shouldError, msg);
  }

  /**
   * Calls a function that expects to not generate a validation error
   */
  async expectNoValidationError<R>(fn: () => R, msg = ''): Promise<R> {
    return this.expectGPUErrorAsync('validation', fn, false, msg);
  }

  /**
   * Calls a function that might expect a validation error.
   * if shouldError is true then expect a validation error,
   * if shouldError is false then ignore out-of-memory errors.
   */
  async testForValidationErrorWithPossibleOutOfMemoryError<R>(
    fn: () => R,
    shouldError: boolean = true,
    msg = ''
  ): Promise<R> {
    const { device } = this;

    if (!shouldError) {
      device.pushErrorScope('out-of-memory');
      const result = fn();
      await device.popErrorScope();
      return result;
    }

    // Validation should fail before out-of-memory so there is no need to check
    // for out-of-memory here.
    device.pushErrorScope('validation');
    const returnValue = fn();
    const validationError = await device.popErrorScope();

    this.expect(
      !!validationError,
      `${validationError?.message || 'no error when one was expected'}: ${msg}`
    );

    return returnValue;
  }

  getGroupIndexWGSLForPipelineType(
    pipelineType: CreatePipelineType | CreatePipelineAsyncType,
    groupIndex: number
  ) {
    switch (pipelineType) {
      case 'createRenderPipeline':
      case 'createRenderPipelineAsync':
        return `
          @group(${groupIndex}) @binding(0) var<uniform> v: f32;
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
        `;
      case 'createRenderPipelineWithFragmentStage':
      case 'createRenderPipelineAsyncWithFragmentStage':
        return `
          @group(${groupIndex}) @binding(0) var<uniform> v: f32;
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
          @fragment fn mainFS() -> @location(0) vec4f {
            return vec4f(1);
          }
        `;
      case 'createComputePipeline':
      case 'createComputePipelineAsync':
        return `
          @group(${groupIndex}) @binding(0) var<uniform> v: f32;
          @compute @workgroup_size(1) fn main() {
            _ = v;
          }
        `;
        break;
    }
  }

  getBindingIndexWGSLForPipelineType(
    pipelineType: CreatePipelineType | CreatePipelineAsyncType,
    bindingIndex: number
  ) {
    switch (pipelineType) {
      case 'createRenderPipeline':
      case 'createRenderPipelineAsync':
        return `
          @group(0) @binding(${bindingIndex}) var<uniform> v: f32;
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
        `;
      case 'createRenderPipelineWithFragmentStage':
      case 'createRenderPipelineAsyncWithFragmentStage':
        return `
          @group(0) @binding(${bindingIndex}) var<uniform> v: f32;
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
          @fragment fn mainFS() -> @location(0) vec4f {
            return vec4f(1);
          }
        `;
      case 'createComputePipeline':
      case 'createComputePipelineAsync':
        return `
          @group(0) @binding(${bindingIndex}) var<uniform> v: f32;
          @compute @workgroup_size(1) fn main() {
            _ = v;
          }
        `;
        break;
    }
  }

  createPipeline(createPipelineType: CreatePipelineType, module: GPUShaderModule) {
    const { device } = this;

    switch (createPipelineType) {
      case 'createRenderPipeline':
        return device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'mainVS',
          },
        });
        break;
      case 'createRenderPipelineWithFragmentStage':
        return device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'mainVS',
          },
          fragment: {
            module,
            entryPoint: 'mainFS',
            targets: [{ format: 'rgba8unorm' }],
          },
        });
        break;
      case 'createComputePipeline':
        return device.createComputePipeline({
          layout: 'auto',
          compute: {
            module,
            entryPoint: 'main',
          },
        });
        break;
    }
  }

  createPipelineAsync(createPipelineAsyncType: CreatePipelineAsyncType, module: GPUShaderModule) {
    const { device } = this;

    switch (createPipelineAsyncType) {
      case 'createRenderPipelineAsync':
        return device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'mainVS',
          },
        });
      case 'createRenderPipelineAsyncWithFragmentStage':
        return device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'mainVS',
          },
          fragment: {
            module,
            entryPoint: 'mainFS',
            targets: [{ format: 'rgba8unorm' }],
          },
        });
      case 'createComputePipelineAsync':
        return device.createComputePipelineAsync({
          layout: 'auto',
          compute: {
            module,
            entryPoint: 'main',
          },
        });
    }
  }

  /**
   * Creates an GPURenderCommandsMixin setup with some initial state.
   */
  _getGPURenderCommandsMixin(encoderType: RenderEncoderType) {
    const { device } = this;

    switch (encoderType) {
      case 'render': {
        const buffer = this.trackForCleanup(
          device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM,
          })
        );

        const texture = this.trackForCleanup(
          device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
          })
        );

        const layout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout,
          entries: [
            {
              binding: 0,
              resource: { buffer },
            },
          ],
        });

        const encoder = device.createCommandEncoder();
        const mixin = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: texture.createView(),
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        return {
          mixin,
          bindGroup,
          prep() {
            mixin.end();
          },
          test() {
            encoder.finish();
          },
        };
        break;
      }

      case 'renderBundle': {
        const buffer = this.trackForCleanup(
          device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM,
          })
        );

        const layout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout,
          entries: [
            {
              binding: 0,
              resource: { buffer },
            },
          ],
        });

        const mixin = device.createRenderBundleEncoder({
          colorFormats: ['rgba8unorm'],
        });

        return {
          mixin,
          bindGroup,
          prep() {},
          test() {
            mixin.finish();
          },
        };
        break;
      }
    }
  }

  /**
   * Tests a method on GPURenderCommandsMixin
   * The function will be called with the mixin.
   */
  async testGPURenderCommandsMixin(
    encoderType: RenderEncoderType,
    fn: ({ mixin }: { mixin: GPURenderCommandsMixin }) => void,
    shouldError: boolean,
    msg = ''
  ) {
    const { mixin, prep, test } = this._getGPURenderCommandsMixin(encoderType);
    fn({ mixin });
    prep();

    await this.expectValidationError(test, shouldError, msg);
  }

  /**
   * Creates GPUBindingCommandsMixin setup with some initial state.
   */
  _getGPUBindingCommandsMixin(encoderType: EncoderType) {
    const { device } = this;

    switch (encoderType) {
      case 'compute': {
        const buffer = this.trackForCleanup(
          device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM,
          })
        );

        const layout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              buffer: {},
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout,
          entries: [
            {
              binding: 0,
              resource: { buffer },
            },
          ],
        });

        const encoder = device.createCommandEncoder();
        const mixin = encoder.beginComputePass();
        return {
          mixin,
          bindGroup,
          prep() {
            mixin.end();
          },
          test() {
            encoder.finish();
          },
        };
        break;
      }
      case 'render':
        return this._getGPURenderCommandsMixin('render');
      case 'renderBundle':
        return this._getGPURenderCommandsMixin('renderBundle');
    }
  }

  /**
   * Tests a method on GPUBindingCommandsMixin
   * The function pass will be called with the mixin and a bindGroup
   */
  async testGPUBindingCommandsMixin(
    encoderType: EncoderType,
    fn: ({ bindGroup }: { mixin: GPUBindingCommandsMixin; bindGroup: GPUBindGroup }) => void,
    shouldError: boolean,
    msg = ''
  ) {
    const { mixin, bindGroup, prep, test } = this._getGPUBindingCommandsMixin(encoderType);
    fn({ mixin, bindGroup });
    prep();

    await this.expectValidationError(test, shouldError, msg);
  }
}

/**
 * Makes a new LimitTest class so that the tests have access to `limit`
 */
function makeLimitTestFixture(limit: GPUSupportedLimit): typeof LimitTestsImpl {
  class LimitTests extends LimitTestsImpl {
    limit = limit;
  }

  return LimitTests;
}

/**
 * This is to avoid repeating yourself (D.R.Y.) as I ran into that issue multiple times
 * writing these tests where I'd copy a test, need to rename a limit in 3-4 places,
 * forget one place, and then spend 20-30 minutes wondering why the test was failing.
 */
export function makeLimitTestGroup(limit: GPUSupportedLimit) {
  const description = `API Validation Tests for ${limit}.`;
  const g = makeTestGroup(makeLimitTestFixture(limit));
  return { g, description, limit };
}