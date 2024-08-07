export const description = `
Execution tests for the 'textureLoad' builtin function

Reads a single texel from a texture without sampling or filtering.

Returns the unfiltered texel data.

An out of bounds access occurs if:
 * any element of coords is outside the range [0, textureDimensions(t, level)) for the corresponding element, or
 * array_index is outside the range [0, textureNumLayers(t)), or
 * level is outside the range [0, textureNumLevels(t))

If an out of bounds access occurs, the built-in function returns one of:
 * The data for some texel within bounds of the texture
 * A vector (0,0,0,0) or (0,0,0,1) of the appropriate type for non-depth textures
 * 0.0 for depth textures

TODO: Test textureLoad with depth textures as texture_2d, etc...
TODO: Test textureLoad with multisampled stencil8 format
TODO: Test un-encodable formats.
TODO: Test stencil8 format.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { unreachable, iterRange } from '../../../../../../common/util/util.js';
import {
  canUseAsRenderTarget,
  isCompressedFloatTextureFormat,
  isDepthTextureFormat,
  isEncodableTextureFormat,
  isMultisampledTextureFormat,
  isStencilTextureFormat,
  kCompressedTextureFormats,
  kDepthStencilFormats,
  kEncodableTextureFormats,
  kTextureFormatInfo,
  textureDimensionAndFormatCompatible,
} from '../../../../../format_info.js';
import { GPUTest } from '../../../../../gpu_test.js';
import {
  kFloat32Format,
  kFloat16Format,
  numberToFloatBits,
  pack4x8unorm,
  pack4x8snorm,
} from '../../../../../util/conversion.js';
import { maxMipLevelCount, virtualMipSize } from '../../../../../util/texture/base.js';
import { TexelFormats } from '../../../../types.js';

import {
  TextureCall,
  checkCallResults,
  chooseTextureSize,
  createTextureWithRandomDataAndGetTexels,
  doTextureCalls,
  appendComponentTypeForFormatToTextureType,
  vec1,
  vec2,
  vec3,
  kSamplePointMethods,
  generateTextureBuiltinInputs1D,
  generateTextureBuiltinInputs2D,
  generateTextureBuiltinInputs3D,
  Dimensionality,
} from './texture_utils.js';
import { generateCoordBoundaries } from './utils.js';

const kTestableColorFormats = [...kEncodableTextureFormats, ...kCompressedTextureFormats] as const;

export function normalizedCoordToTexelLoadTestCoord<T extends Dimensionality>(
  descriptor: GPUTextureDescriptor,
  mipLevel: number,
  coordType: 'i32' | 'u32',
  v: T
): T {
  const size = virtualMipSize(descriptor.dimension ?? '2d', descriptor.size, mipLevel);
  return v.map((v, i) => {
    const t = v * size[i];
    return coordType === 'u32' ? Math.abs(Math.round(t)) : Math.round(t);
  }) as T;
}

export const g = makeTestGroup(GPUTest);

g.test('sampled_1d')
  .specURL('https://www.w3.org/TR/WGSL/#textureload')
  .desc(
    `
C is i32 or u32

fn textureLoad(t: texture_1d<T>, coords: C, level: C) -> vec4<T>

Parameters:
 * t: The sampled texture to read from
 * coords: The 0-based texel coordinate
 * level: The mip level, with level 0 containing a full size version of the texture
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => textureDimensionAndFormatCompatible('1d', t.format))
      // 1d textures can't have a height !== 1
      .filter(t => kTextureFormatInfo[t.format].blockHeight === 1)
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('C', ['i32', 'u32'] as const)
      .combine('L', ['i32', 'u32'] as const)
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.skipIfTextureFormatNotSupported(format);
    t.selectDeviceForTextureFormatOrSkipTestCase(t.params.format);
  })
  .fn(async t => {
    const { format, C, L, samplePoints } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const [width] = chooseTextureSize({ minSize: 8, minBlocks: 4, format });
    const size = [width, 1];

    const descriptor: GPUTextureDescriptor = {
      format,
      dimension: '1d',
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);

    const calls: TextureCall<vec1>[] = generateTextureBuiltinInputs1D(50, {
      method: samplePoints,
      descriptor,
      mipLevel: { num: texture.mipLevelCount, type: L },
      hashInputs: [format, samplePoints, C, L],
    }).map(({ coords, mipLevel }, i) => {
      return {
        builtin: 'textureLoad',
        coordType: C === 'i32' ? 'i' : 'u',
        levelType: L === 'i32' ? 'i' : 'u',
        mipLevel,
        coords: normalizedCoordToTexelLoadTestCoord(descriptor, mipLevel, C, coords),
      };
    });

    const textureType = appendComponentTypeForFormatToTextureType('texture_1d', texture.format);
    const viewDescriptor = {};
    const sampler = undefined;
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('sampled_2d')
  .specURL('https://www.w3.org/TR/WGSL/#textureload')
  .desc(
    `
C is i32 or u32
L is i32 or u32

fn textureLoad(t: texture_2d<T>, coords: vec2<C>, level: L) -> vec4<T>

Parameters:
 * t: The sampled texture to read from
 * coords: The 0-based texel coordinate
 * level: The mip level, with level 0 containing a full size version of the texture
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      // MAINTENANCE_TODO: Update createTextureFromTexelViews to support stencil8 and remove this filter.
      .filter(t => t.format !== 'stencil8' && !isCompressedFloatTextureFormat(t.format))
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('C', ['i32', 'u32'] as const)
      .combine('L', ['i32', 'u32'] as const)
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.skipIfTextureFormatNotSupported(format);
    t.selectDeviceForTextureFormatOrSkipTestCase(t.params.format);
  })
  .fn(async t => {
    const { format, samplePoints, C, L } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({ minSize: 8, minBlocks: 4, format });

    const descriptor: GPUTextureDescriptor = {
      format,
      size,
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        (canUseAsRenderTarget(format) ? GPUTextureUsage.RENDER_ATTACHMENT : 0),
      mipLevelCount: maxMipLevelCount({ size }),
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      method: samplePoints,
      descriptor,
      hashInputs: [format, samplePoints, C, L],
    }).map(({ coords, mipLevel }) => {
      return {
        builtin: 'textureLoad',
        coordType: C === 'i32' ? 'i' : 'u',
        levelType: L === 'i32' ? 'i' : 'u',
        mipLevel,
        coords: normalizedCoordToTexelLoadTestCoord(descriptor, mipLevel, C, coords),
      };
    });

    const textureType = appendComponentTypeForFormatToTextureType('texture_2d', texture.format);
    const viewDescriptor = {};
    const sampler = undefined;
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('sampled_3d')
  .specURL('https://www.w3.org/TR/WGSL/#textureload')
  .desc(
    `
C is i32 or u32

fn textureLoad(t: texture_3d<T>, coords: vec3<C>, level: C) -> vec4<T>

Parameters:
 * t: The sampled texture to read from
 * coords: The 0-based texel coordinate
 * level: The mip level, with level 0 containing a full size version of the texture
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => textureDimensionAndFormatCompatible('3d', t.format))
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('C', ['i32', 'u32'] as const)
      .combine('L', ['i32', 'u32'] as const)
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.skipIfTextureFormatNotSupported(format);
    t.selectDeviceForTextureFormatOrSkipTestCase(t.params.format);
  })
  .fn(async t => {
    const { format, samplePoints, C, L } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({ minSize: 8, minBlocks: 4, format, viewDimension: '3d' });

    const descriptor: GPUTextureDescriptor = {
      format,
      dimension: '3d',
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      mipLevelCount: maxMipLevelCount({ size }),
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);

    const calls: TextureCall<vec3>[] = generateTextureBuiltinInputs3D(50, {
      method: samplePoints,
      descriptor,
      mipLevel: { num: texture.mipLevelCount, type: L },
      hashInputs: [format, samplePoints, C, L],
    }).map(({ coords, mipLevel }) => {
      return {
        builtin: 'textureLoad',
        coordType: C === 'i32' ? 'i' : 'u',
        levelType: L === 'i32' ? 'i' : 'u',
        mipLevel,
        coords: normalizedCoordToTexelLoadTestCoord(descriptor, mipLevel, C, coords),
      };
    });

    const textureType = appendComponentTypeForFormatToTextureType('texture_3d', texture.format);
    const viewDescriptor = {};
    const sampler = undefined;
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('multisampled')
  .specURL('https://www.w3.org/TR/WGSL/#textureload')
  .desc(
    `
C is i32 or u32
S is i32 or u32

fn textureLoad(t: texture_multisampled_2d<T>, coords: vec2<C>, sample_index: S)-> vec4<T>
fn textureLoad(t: texture_depth_multisampled_2d, coords: vec2<C>, sample_index: S)-> f32

Parameters:
 * t: The sampled texture to read from
 * coords: The 0-based texel coordinate
 * sample_index: The 0-based sample index of the multisampled texture
`
  )
  .params(u =>
    u
      .combine('texture_type', [
        'texture_multisampled_2d',
        'texture_depth_multisampled_2d',
      ] as const)
      .combine('format', kTestableColorFormats)
      .filter(t => isMultisampledTextureFormat(t.format))
      .filter(t => !isStencilTextureFormat(t.format))
      // Filter out texture_depth_multisampled_2d with non-depth formats
      .filter(
        t =>
          !(t.texture_type === 'texture_depth_multisampled_2d' && !isDepthTextureFormat(t.format))
      )
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('C', ['i32', 'u32'] as const)
      .combine('S', ['i32', 'u32'] as const)
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.skipIfTextureFormatNotSupported(format);
    t.skipIfTextureLoadNotSupportedForTextureType(t.params.texture_type);
    t.selectDeviceForTextureFormatOrSkipTestCase(t.params.format);
  })
  .fn(async t => {
    const { texture_type, format, samplePoints, C, S } = t.params;

    const sampleCount = 4;
    const descriptor: GPUTextureDescriptor = {
      format,
      size: [8, 8],
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount,
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      method: samplePoints,
      descriptor,
      sampleIndex: { num: texture.sampleCount, type: S },
      hashInputs: [format, samplePoints, C, S],
    }).map(({ coords, sampleIndex }) => {
      return {
        builtin: 'textureLoad',
        coordType: C === 'i32' ? 'i' : 'u',
        sampleIndexType: S === 'i32' ? 'i' : 'u',
        sampleIndex,
        coords: normalizedCoordToTexelLoadTestCoord(descriptor, 0, C, coords),
      };
    });

    const textureType = appendComponentTypeForFormatToTextureType(texture_type, texture.format);
    const viewDescriptor = {};
    const sampler = undefined;
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('depth')
  .specURL('https://www.w3.org/TR/WGSL/#textureload')
  .desc(
    `
C is i32 or u32

fn textureLoad(t: texture_depth_2d, coords: vec2<C>, level: L) -> f32

Parameters:
 * t: The sampled texture to read from
 * coords: The 0-based texel coordinate
 * level: The mip level, with level 0 containing a full size version of the texture
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('C', ['i32', 'u32'] as const)
      .combine('L', ['i32', 'u32'] as const)
  )
  .beforeAllSubcases(t => {
    t.skipIfTextureLoadNotSupportedForTextureType('texture_depth_2d');
  })
  .fn(async t => {
    const { format, samplePoints, C, L } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({ minSize: 8, minBlocks: 4, format });

    const descriptor: GPUTextureDescriptor = {
      format,
      size,
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount: maxMipLevelCount({ size }),
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      method: samplePoints,
      descriptor,
      mipLevel: { num: texture.mipLevelCount, type: L },
      hashInputs: [format, samplePoints, C, L],
    }).map(({ coords, mipLevel }) => {
      return {
        builtin: 'textureLoad',
        coordType: C === 'i32' ? 'i' : 'u',
        levelType: L === 'i32' ? 'i' : 'u',
        mipLevel,
        coords: normalizedCoordToTexelLoadTestCoord(descriptor, mipLevel, C, coords),
      };
    });
    const textureType = 'texture_depth_2d';
    const viewDescriptor = {};
    const sampler = undefined;
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('external')
  .specURL('https://www.w3.org/TR/WGSL/#textureload')
  .desc(
    `
C is i32 or u32

fn textureLoad(t: texture_external, coords: vec2<C>) -> vec4<f32>

Parameters:
 * t: The sampled texture to read from
 * coords: The 0-based texel coordinate
`
  )
  .paramsSubcasesOnly(u =>
    u.combine('C', ['i32', 'u32'] as const).combine('coords', generateCoordBoundaries(2))
  )
  .unimplemented();

g.test('arrayed')
  .specURL('https://www.w3.org/TR/WGSL/#textureload')
  .desc(
    `
C is i32 or u32

fn textureLoad(t: texture_2d_array<T>, coords: vec2<C>, array_index: A, level: L) -> vec4<T>
fn textureLoad(t: texture_depth_2d_array, coords: vec2<C>, array_index: A, level: L) -> f32

Parameters:
 * t: The sampled texture to read from
 * coords: The 0-based texel coordinate
 * array_index: The 0-based texture array index
 * level: The mip level, with level 0 containing a full size version of the texture
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      // MAINTENANCE_TODO: Update createTextureFromTexelViews to support stencil8 and remove this filter.
      .filter(t => t.format !== 'stencil8' && !isCompressedFloatTextureFormat(t.format))
      .combine('texture_type', ['texture_2d_array', 'texture_depth_2d_array'] as const)
      .filter(
        t => !(t.texture_type === 'texture_depth_2d_array' && !isDepthTextureFormat(t.format))
      )
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combineWithParams([
        { C: 'i32', A: 'u32', L: 'u32' },
        { C: 'u32', A: 'u32', L: 'u32' },
        { C: 'u32', A: 'i32', L: 'u32' },
        { C: 'u32', A: 'u32', L: 'i32' },
      ] as const)
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.skipIfTextureFormatNotSupported(format);
    t.skipIfTextureLoadNotSupportedForTextureType(t.params.texture_type);
    t.selectDeviceForTextureFormatOrSkipTestCase(t.params.format);
  })
  .fn(async t => {
    const { texture_type, format, samplePoints, C, A, L } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({ minSize: 8, minBlocks: 4, format, viewDimension: '3d' });

    const descriptor: GPUTextureDescriptor = {
      format,
      size,
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        (canUseAsRenderTarget(format) ? GPUTextureUsage.RENDER_ATTACHMENT : 0),
      mipLevelCount: maxMipLevelCount({ size }),
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      method: samplePoints,
      descriptor,
      mipLevel: { num: texture.mipLevelCount, type: L },
      arrayIndex: { num: texture.depthOrArrayLayers, type: A },
      hashInputs: [format, samplePoints, C, L, A],
    }).map(({ coords, mipLevel, arrayIndex }) => {
      return {
        builtin: 'textureLoad',
        coordType: C === 'i32' ? 'i' : 'u',
        levelType: L === 'i32' ? 'i' : 'u',
        arrayIndexType: A === 'i32' ? 'i' : 'u',
        arrayIndex,
        mipLevel,
        coords: normalizedCoordToTexelLoadTestCoord(descriptor, mipLevel, C, coords),
      };
    });
    const textureType = appendComponentTypeForFormatToTextureType(texture_type, texture.format);
    const viewDescriptor = {};
    const sampler = undefined;
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

// Returns texel values to use as inputs for textureLoad.
// Values are kept simple to avoid rounding issues.
function shaderValues(format: string, type: string) {
  switch (type) {
    case 'f32': {
      switch (format) {
        case 'rbga8snorm':
          // prettier-ignore
          return [
            { r:  0.0, g:  0.0, b:  0.0, a:  0.0, },
            { r:  0.2, g:  0.4, b:  0.6, a:  0.8, },
            { r: -0.2, g: -0.4, b: -0.6, a: -0.8, },
            { r:  0.2, g: -0.4, b:  0.6, a: -0.8, },
            { r: -0.2, g:  0.4, b: -0.6, a:  0.8, },
            { r:  0.2, g:  0.2, b:  0.2, a:  0.2, },
            { r: -0.2, g: -0.2, b: -0.2, a: -0.2, },
            { r:  0.4, g:  0.4, b:  0.4, a:  0.4, },
            { r: -0.4, g: -0.4, b: -0.4, a: -0.4, },
            { r:  0.6, g:  0.6, b:  0.6, a:  0.6, },
            { r: -0.6, g: -0.6, b: -0.6, a: -0.6, },
            { r:  0.8, g:  0.8, b:  0.8, a:  0.8, },
            { r: -0.8, g: -0.8, b: -0.8, a: -0.8, },
          ];
        case 'rgba8unorm':
        case 'bgra8unorm':
          // prettier-ignore
          return [
            { r: 0.0, g: 0.0, b: 0.0, a: 0.0, },
            { r: 0.2, g: 0.4, b: 0.6, a: 0.8, },
            { r: 0.9, g: 0.4, b: 0.6, a: 0.8, },
            { r: 0.2, g: 0.9, b: 0.6, a: 0.8, },
            { r: 0.2, g: 0.4, b: 0.9, a: 0.8, },
            { r: 0.2, g: 0.4, b: 0.6, a: 0.9, },
            { r: 0.2, g: 0.2, b: 0.2, a: 0.2, },
            { r: 0.4, g: 0.4, b: 0.4, a: 0.4, },
            { r: 0.6, g: 0.6, b: 0.6, a: 0.6, },
            { r: 0.8, g: 0.8, b: 0.8, a: 0.8, },
          ];
        default:
          // Stick within 16-bit ranges.
          // prettier-ignore
          return [
            { r:  100, g:  128, b:  100, a:  128, },
            { r:   64, g:   32, b:   32, a:   64, },
            { r:    8, g:    0, b:    8, a:    0, },
            { r:    0, g:    0, b:    0, a:    0, },
            { r: -100, g:  128, b:  100, a:  128, },
            { r:  -64, g:   32, b:   32, a:   64, },
            { r:   -8, g:    0, b:    8, a:    0, },
            { r:  100, g: -128, b:  100, a:  128, },
            { r:   64, g:  -32, b:   32, a:   64, },
            { r:    8, g:    0, b:    8, a:    0, },
            { r:  100, g:  128, b: -100, a:  128, },
            { r:   64, g:   32, b:  -32, a:   64, },
            { r:    8, g:    0, b:   -8, a:    0, },
            { r:  100, g:  128, b:  100, a: -128, },
            { r:   64, g:   32, b:   32, a:  -64, },
            { r:    8, g:    0, b:    8, a:    0, },
          ];
      }
      break;
    }
    case 'u32':
      // Keep all ranges within u8.
      // prettier-ignore
      return [
        { r:   0, g:   0, b:   0, a:   0, },
        { r:   0, g:   8, b:  16, a: 128, },
        { r:   8, g:  16, b:  32, a:  64, },
        { r:  16, g:  32, b:  64, a: 128, },
        { r: 255, g: 254, b: 253, a: 252, },
        { r: 255, g: 255, b: 255, a: 255, },
        { r: 128, g:  64, b:  32, a:  16, },
        { r:  64, g:  32, b:  16, a:   8, },
        { r:  32, g:  16, b:   8, a:   0, },
      ];
    case 'i32':
      // Keep all ranges i8
      // prettier-ignore
      return [
        { r:    0, g:    0, b:    0, a:    0, },
        { r:    0, g:   -8, b:   16, a:  127, },
        { r:    8, g:   16, b:  -32, a:   64, },
        { r:  -16, g:   32, b:   64, a: -128, },
        { r:  127, g:  126, b:  125, a:  124, },
        { r: -128, g: -127, b: -126, a: -125, },
        { r:  127, g:  127, b:  127, a:  127, },
        { r: -128, g: -128, b: -128, a: -128, },
      ];
    default:
      unreachable(`unhandled shader type ${type}`);
      break;
  }
  return [];
}

g.test('storage_texel_formats')
  .desc('Test loading of texel formats')
  .params(u => u.combineWithParams([...TexelFormats, { format: 'bgra8unorm', _shaderType: 'f32' }]))
  .beforeAllSubcases(t => {
    t.skipIf(!t.hasLanguageFeature('readonly_and_readwrite_storage_textures'));
    if (t.params.format === 'bgra8unorm') {
      t.selectDeviceOrSkipTestCase('bgra8unorm-storage');
    } else {
      t.skipIfTextureFormatNotUsableAsStorageTexture(t.params.format as GPUTextureFormat);
    }
  })
  .fn(t => {
    const { format, _shaderType } = t.params;
    const values = shaderValues(format, _shaderType);

    // To avoid rounding issues, unorm and snorm values are repacked in the shader.
    let useType = _shaderType;
    let assignValue = `v`;
    if (format === 'bgra8unorm' || format === 'rgba8unorm') {
      useType = 'u32';
      assignValue = `vec4u(pack4x8unorm(v),0,0,0)`;
    } else if (format === 'rgba8snorm') {
      useType = 'u32';
      assignValue = `vec4u(pack4x8snorm(v),0,0,0)`;
    }
    const wgsl = `
requires readonly_and_readwrite_storage_textures;

@group(0) @binding(0)
var tex : texture_storage_1d<${format}, read>;

@group(0) @binding(1)
var<storage, read_write> out : array<vec4<${useType}>>;

@compute @workgroup_size(${values.length})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let v = textureLoad(tex, gid.x);
  out[gid.x] = ${assignValue};
}`;

    const bytesPerRow = 256;
    let bytesPerTexel = 4;
    switch (format) {
      case 'rgba16uint':
      case 'rgba16sint':
      case 'rgba16float':
      case 'rg32uint':
      case 'rg32sint':
      case 'rg32float':
        bytesPerTexel = 8;
        break;
      case 'rgba32uint':
      case 'rgba32sint':
      case 'rgba32float':
        bytesPerTexel = 16;
        break;
      default:
        break;
    }

    const textureSize: GPUExtent3D = {
      width: bytesPerRow / bytesPerTexel,
      height: 1,
      depthOrArrayLayers: 1,
    };
    const texture = t.createTextureTracked({
      format: format as GPUTextureFormat,
      dimension: '1d',
      size: textureSize,
      mipLevelCount: 1,
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const outputBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(values.length * 4, x => 0)]),
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );
    t.trackForCleanup(outputBuffer);

    const transformed = values.flatMap(x => {
      switch (format) {
        case 'rgba8unorm':
          return pack4x8unorm(x.r, x.g, x.b, x.a);
        case 'bgra8unorm':
          return pack4x8unorm(x.b, x.g, x.r, x.a);
        case 'rgba8snorm':
          return pack4x8snorm(x.r, x.g, x.b, x.a);
        case 'r32uint':
        case 'r32sint':
          return x.r;
        case 'rg32uint':
        case 'rg32sint':
          return [x.r, x.g];
        case 'rgba32uint':
        case 'rgba32sint':
          return [x.r, x.g, x.b, x.a];
        case 'rgba8uint':
        case 'rgba8sint':
          return (x.r & 0xff) | ((x.g & 0xff) << 8) | ((x.b & 0xff) << 16) | ((x.a & 0xff) << 24);
        case 'rgba16uint':
        case 'rgba16sint':
          return [(x.r & 0xffff) | ((x.g & 0xffff) << 16), (x.b & 0xffff) | ((x.a & 0xffff) << 16)];
        case 'r32float':
          return numberToFloatBits(x.r, kFloat32Format);
        case 'rg32float':
          return [numberToFloatBits(x.r, kFloat32Format), numberToFloatBits(x.g, kFloat32Format)];
        case 'rgba32float':
          return [
            numberToFloatBits(x.r, kFloat32Format),
            numberToFloatBits(x.g, kFloat32Format),
            numberToFloatBits(x.b, kFloat32Format),
            numberToFloatBits(x.a, kFloat32Format),
          ];
        case 'rgba16float':
          return [
            (numberToFloatBits(x.r, kFloat16Format) & 0xffff) |
              ((numberToFloatBits(x.g, kFloat16Format) & 0xffff) << 16),
            (numberToFloatBits(x.b, kFloat16Format) & 0xffff) |
              ((numberToFloatBits(x.a, kFloat16Format) & 0xffff) << 16),
          ];
        default:
          unreachable(`unhandled format ${format}`);
          break;
      }
      return 0;
    });

    const texelBuffer = t.makeBufferWithContents(
      new Uint32Array([
        ...iterRange(bytesPerRow, x => {
          if (x < transformed.length) {
            return transformed[x];
          } else {
            return 0;
          }
        }),
      ]),
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );
    t.trackForCleanup(texelBuffer);

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });
    const bg = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({
            format: format as GPUTextureFormat,
            dimension: '1d',
          }),
        },
        {
          binding: 1,
          resource: {
            buffer: outputBuffer,
          },
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToTexture(
      {
        buffer: texelBuffer,
        offset: 0,
        bytesPerRow,
        rowsPerImage: 1,
      },
      { texture },
      textureSize
    );

    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1, 1, 1);
    pass.end();
    t.queue.submit([encoder.finish()]);

    const expected = new Uint32Array(
      values.flatMap(x => {
        switch (format) {
          case 'r32uint':
          case 'r32sint':
            return [x.r, 0, 0, 1];
          case 'rg32uint':
          case 'rg32sint':
            return [x.r, x.g, 0, 1];
          case 'r32float':
            return [
              numberToFloatBits(x.r, kFloat32Format),
              0,
              0,
              numberToFloatBits(1, kFloat32Format),
            ];
          case 'rg32float':
            return [
              numberToFloatBits(x.r, kFloat32Format),
              numberToFloatBits(x.g, kFloat32Format),
              0,
              numberToFloatBits(1, kFloat32Format),
            ];
          case 'rgba32float':
          case 'rgba16float':
            return [
              numberToFloatBits(x.r, kFloat32Format),
              numberToFloatBits(x.g, kFloat32Format),
              numberToFloatBits(x.b, kFloat32Format),
              numberToFloatBits(x.a, kFloat32Format),
            ];
          case 'rgba8unorm':
          case 'bgra8unorm':
            return [pack4x8unorm(x.r, x.g, x.b, x.a), 0, 0, 0];
          case 'rgba8snorm':
            return [pack4x8snorm(x.r, x.g, x.b, x.a), 0, 0, 0];
          default:
            break;
        }
        return [x.r, x.g, x.b, x.a];
      })
    );
    t.expectGPUBufferValuesEqual(outputBuffer, expected);
  });
