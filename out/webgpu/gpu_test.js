/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { Fixture } from '../common/framework/fixture.js';import { attemptGarbageCollection } from '../common/util/collect_garbage.js';import {
assert,


unreachable } from
'../common/util/util.js';

import {


kTextureFormatInfo,
kQueryTypeInfo } from
'./capability_info.js';
import { makeBufferWithContents } from './util/buffer.js';
import { checkElementsEqual, checkElementsBetween } from './util/check_contents.js';
import {
DevicePool,

TestOOMedShouldAttemptGC } from

'./util/device_pool.js';
import { align, roundDown } from './util/math.js';
import {
fillTextureDataWithTexelValue,
getTextureCopyLayout } from

'./util/texture/layout.js';
import { kTexelRepresentationInfo } from './util/texture/texel_data.js';

const devicePool = new DevicePool();

/**
                                      * Base fixture for WebGPU tests.
                                      */
export class GPUTest extends Fixture {

  /** Must not be replaced once acquired. */


  /** GPUDevice for the test to use. */
  get device() {
    assert(
    this.provider !== undefined,
    'No provider available right now; did you "await" selectDeviceOrSkipTestCase?');

    if (!this.acquiredDevice) {
      this.acquiredDevice = this.provider.acquire();
    }
    return this.acquiredDevice;
  }

  /** GPUQueue for the test to use. (Same as `t.device.queue`.) */
  get queue() {
    return this.device.queue;
  }

  async init() {
    await super.init();

    this.provider = await devicePool.reserve();
  }

  async finalize() {
    await super.finalize();

    if (this.provider) {
      let threw;
      {
        const provider = this.provider;
        this.provider = undefined;
        try {
          await devicePool.release(provider);
        } catch (ex) {
          threw = ex;
        }
      }
      // The GPUDevice and GPUQueue should now have no outstanding references.

      if (threw) {
        if (threw instanceof TestOOMedShouldAttemptGC) {
          // Try to clean up, in case there are stray GPU resources in need of collection.
          await attemptGarbageCollection();
        }
        throw threw;
      }
    }
  }

  /**
     * When a GPUTest test accesses `.device` for the first time, a "default" GPUDevice
     * (descriptor = `undefined`) is provided by default.
     * However, some tests or cases need particular nonGuaranteedFeatures to be enabled.
     * Call this function with a descriptor or feature name (or `undefined`) to select a
     * GPUDevice with matching capabilities.
     *
     * If the request descriptor can't be supported, throws an exception to skip the entire test case.
     */
  async selectDeviceOrSkipTestCase(
  descriptor)




  {
    if (descriptor === undefined) return;
    if (typeof descriptor === 'string') {
      descriptor = { requiredFeatures: [descriptor] };
    } else if (descriptor instanceof Array) {
      descriptor = {
        requiredFeatures: descriptor.filter(f => f !== undefined) };

    }

    assert(this.provider !== undefined);
    // Make sure the device isn't replaced after it's been retrieved once.
    assert(
    !this.acquiredDevice,
    "Can't selectDeviceOrSkipTestCase() after the device has been used");


    const oldProvider = this.provider;
    this.provider = undefined;
    await devicePool.release(oldProvider);

    this.provider = await devicePool.reserve(descriptor);
    this.acquiredDevice = this.provider.acquire();
  }

  /**
     * Create device with texture format(s) required feature(s).
     * If the device creation fails, then skip the test for that format(s).
     */
  async selectDeviceForTextureFormatOrSkipTestCase(
  formats)
  {
    if (!Array.isArray(formats)) {
      formats = [formats];
    }
    const features = new Set();
    for (const format of formats) {
      if (format !== undefined) {
        features.add(kTextureFormatInfo[format].feature);
      }
    }

    await this.selectDeviceOrSkipTestCase(Array.from(features));
  }

  /**
     * Create device with query type(s) required feature(s).
     * If the device creation fails, then skip the test for that type(s).
     */
  async selectDeviceForQueryTypeOrSkipTestCase(
  types)
  {
    if (!Array.isArray(types)) {
      types = [types];
    }
    const features = types.map(t => kQueryTypeInfo[t].feature);
    await this.selectDeviceOrSkipTestCase(features);
  }

  /** Snapshot a GPUBuffer's contents, returning a new GPUBuffer with the `MAP_READ` usage. */
  createCopyForMapRead(src, srcOffset, size) {
    assert(srcOffset % 4 === 0);
    assert(size % 4 === 0);

    const dst = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });


    const c = this.device.createCommandEncoder();
    c.copyBufferToBuffer(src, srcOffset, dst, 0, size);
    this.queue.submit([c.finish()]);

    return dst;
  }

  /**
     * Offset and size passed to createCopyForMapRead must be divisible by 4. For that
     * we might need to copy more bytes from the buffer than we want to map.
     * begin and end values represent the part of the copied buffer that stores the contents
     * we initially wanted to map.
     * The copy will not cause an OOB error because the buffer size must be 4-aligned.
     */
  createAlignedCopyForMapRead(
  src,
  size,
  offset)
  {
    const alignedOffset = roundDown(offset, 4);
    const subarrayByteStart = offset - alignedOffset;
    const alignedSize = align(size + subarrayByteStart, 4);
    const mappable = this.createCopyForMapRead(src, alignedOffset, alignedSize);
    return { mappable, subarrayByteStart };
  }

  /**
     * Snapshot the current contents of a range of a GPUBuffer, and return them as a TypedArray.
     * Also provides a cleanup() function to unmap and destroy the staging buffer.
     */
  async readGPUBufferRangeTyped(
  src,
  {
    srcByteOffset = 0,
    method = 'copy',
    type,
    typedLength })






  {
    assert(
    srcByteOffset % type.BYTES_PER_ELEMENT === 0,
    'srcByteOffset must be a multiple of BYTES_PER_ELEMENT');


    const byteLength = typedLength * type.BYTES_PER_ELEMENT;
    let mappable;
    let mapOffset, mapSize, subarrayByteStart;
    if (method === 'copy') {
      ({ mappable, subarrayByteStart } = this.createAlignedCopyForMapRead(
      src,
      byteLength,
      srcByteOffset));

    } else if (method === 'map') {
      mappable = src;
      mapOffset = roundDown(srcByteOffset, 8);
      mapSize = align(byteLength, 4);
      subarrayByteStart = srcByteOffset - mapOffset;
    } else {
      unreachable();
    }

    assert(subarrayByteStart % type.BYTES_PER_ELEMENT === 0);
    const subarrayStart = subarrayByteStart / type.BYTES_PER_ELEMENT;

    // 2. Map the staging buffer, and create the TypedArray from it.
    await mappable.mapAsync(GPUMapMode.READ, mapOffset, mapSize);
    const mapped = new type(mappable.getMappedRange(mapOffset, mapSize));
    const data = mapped.subarray(subarrayStart, typedLength);

    return {
      data,
      cleanup() {
        mappable.unmap();
        mappable.destroy();
      } };

  }

  /**
     * Expect a GPUBuffer's contents to pass the provided check.
     */
  expectGPUBufferValuesPassCheck(
  src,
  check,
  {
    srcByteOffset = 0,
    type,
    typedLength,
    method = 'copy',
    mode = 'fail' })







  {
    const readbackPromise = this.readGPUBufferRangeTyped(src, {
      srcByteOffset,
      type,
      typedLength,
      method });

    this.eventualAsyncExpectation(async niceStack => {
      const readback = await readbackPromise;
      this.expectOK(check(readback.data), { mode, niceStack });
      readback.cleanup();
    });
  }

  /**
     * Expect a GPUBuffer's contents to equal the values in the provided TypedArray.
     */
  expectGPUBufferValuesEqual(
  src,
  expected,
  srcByteOffset = 0,
  { method = 'copy', mode = 'fail' } = {})
  {
    this.expectGPUBufferValuesPassCheck(src, a => checkElementsEqual(a, expected), {
      srcByteOffset,
      type: expected.constructor,
      typedLength: expected.length,
      method,
      mode });

  }

  // TODO: add an expectContents for textures, which logs data: uris on failure

  /**
   * Expect a whole GPUTexture to have the single provided color.
   */
  expectSingleColor(
  src,
  format,
  {
    size,
    exp,
    dimension = '2d',
    slice = 0,
    layout })







  {
    const { byteLength, bytesPerRow, rowsPerImage, mipSize } = getTextureCopyLayout(
    format,
    dimension,
    size,
    layout);

    const rep = kTexelRepresentationInfo[format];
    const expectedTexelData = rep.pack(rep.encode(exp));

    const buffer = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });


    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
    { texture: src, mipLevel: layout?.mipLevel, origin: { x: 0, y: 0, z: slice } },
    { buffer, bytesPerRow, rowsPerImage },
    mipSize);

    this.queue.submit([commandEncoder.finish()]);
    const arrayBuffer = new ArrayBuffer(byteLength);
    fillTextureDataWithTexelValue(expectedTexelData, format, dimension, arrayBuffer, size, layout);
    this.expectGPUBufferValuesEqual(buffer, new Uint8Array(arrayBuffer));
  }

  /** Return a GPUBuffer that data are going to be written into. */
  readSinglePixelFrom2DTexture(
  src,
  format,
  { x, y },
  { slice = 0, layout })
  {
    const { byteLength, bytesPerRow, rowsPerImage, mipSize } = getTextureCopyLayout(
    format,
    '2d',
    [1, 1, 1],
    layout);

    const buffer = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });


    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
    { texture: src, mipLevel: layout?.mipLevel, origin: { x, y, z: slice } },
    { buffer, bytesPerRow, rowsPerImage },
    mipSize);

    this.queue.submit([commandEncoder.finish()]);

    return buffer;
  }

  /**
     * Expect a single pixel of a 2D texture to have a particular byte representation.
     *
     * TODO: Add check for values of depth/stencil, probably through sampling of shader
     * TODO: Can refactor this and expectSingleColor to use a similar base expect
     */
  expectSinglePixelIn2DTexture(
  src,
  format,
  { x, y },
  {
    exp,
    slice = 0,
    layout,
    generateWarningOnly = false })






  {
    const buffer = this.readSinglePixelFrom2DTexture(src, format, { x, y }, { slice, layout });
    this.expectGPUBufferValuesEqual(buffer, exp, 0, {
      mode: generateWarningOnly ? 'warn' : 'fail' });

  }

  /**
     * Take a single pixel of a 2D texture, interpret it using a TypedArray of the `expected` type,
     * and expect each value in that array to be between the corresponding "expected" values
     * (either `a[i] <= actual[i] <= b[i]` or `a[i] >= actual[i] => b[i]`).
     */
  expectSinglePixelBetweenTwoValuesIn2DTexture(
  src,
  format,
  { x, y },
  {
    exp,
    slice = 0,
    layout,
    generateWarningOnly = false })






  {
    assert(exp[0].constructor === exp[1].constructor);
    const constructor = exp[0].constructor;
    assert(exp[0].length === exp[1].length);
    const typedLength = exp[0].length;

    const buffer = this.readSinglePixelFrom2DTexture(src, format, { x, y }, { slice, layout });
    this.expectGPUBufferValuesPassCheck(buffer, a => checkElementsBetween(a, exp), {
      type: constructor,
      typedLength,
      mode: generateWarningOnly ? 'warn' : 'fail' });

  }

  /**
     * Expect the specified WebGPU error to be generated when running the provided function.
     */
  expectGPUError(filter, fn, shouldError = true) {
    // If no error is expected, we let the scope surrounding the test catch it.
    if (!shouldError) {
      return fn();
    }

    this.device.pushErrorScope(filter);
    const returnValue = fn();
    const promise = this.device.popErrorScope();

    this.eventualAsyncExpectation(async niceStack => {
      const error = await promise;

      let failed = false;
      switch (filter) {
        case 'out-of-memory':
          failed = !(error instanceof GPUOutOfMemoryError);
          break;
        case 'validation':
          failed = !(error instanceof GPUValidationError);
          break;}


      if (failed) {
        niceStack.message = `Expected ${filter} error`;
        this.rec.expectationFailed(niceStack);
      } else {
        niceStack.message = `Captured ${filter} error`;
        if (error instanceof GPUValidationError) {
          niceStack.message += ` - ${error.message}`;
        }
        this.rec.debug(niceStack);
      }
    });

    return returnValue;
  }

  /**
     * Create a GPUBuffer with the specified contents and usage.
     *
     * TODO: Several call sites would be simplified if this took ArrayBuffer as well.
     */
  makeBufferWithContents(dataArray, usage) {
    return makeBufferWithContents(this.device, dataArray, usage);
  }

  /**
     * Create a GPUTexture with multiple mip levels, each having the specified contents.
     */
  createTexture2DWithMipmaps(mipmapDataArray) {
    const format = 'rgba8unorm';
    const mipLevelCount = mipmapDataArray.length;
    const textureSizeMipmap0 = 1 << mipLevelCount - 1;
    const texture = this.device.createTexture({
      mipLevelCount,
      size: { width: textureSizeMipmap0, height: textureSizeMipmap0, depthOrArrayLayers: 1 },
      format,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED });


    const textureEncoder = this.device.createCommandEncoder();
    for (let i = 0; i < mipLevelCount; i++) {
      const { byteLength, bytesPerRow, rowsPerImage, mipSize } = getTextureCopyLayout(
      format,
      '2d',
      [textureSizeMipmap0, textureSizeMipmap0, 1],
      { mipLevel: i });


      const data = new Uint8Array(byteLength);
      const mipLevelData = mipmapDataArray[i];
      assert(rowsPerImage === mipSize[0]); // format is rgba8unorm and block size should be 1
      for (let r = 0; r < rowsPerImage; r++) {
        const o = r * bytesPerRow;
        for (let c = o, end = o + mipSize[1] * 4; c < end; c += 4) {
          data[c] = mipLevelData[0];
          data[c + 1] = mipLevelData[1];
          data[c + 2] = mipLevelData[2];
          data[c + 3] = mipLevelData[3];
        }
      }
      const buffer = this.makeBufferWithContents(
      data,
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);


      textureEncoder.copyBufferToTexture(
      { buffer, bytesPerRow, rowsPerImage },
      { texture, mipLevel: i, origin: [0, 0, 0] },
      mipSize);

    }
    this.device.queue.submit([textureEncoder.finish()]);

    return texture;
  }}
//# sourceMappingURL=gpu_test.js.map