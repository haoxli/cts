export const description = `createView validation tests.`;

import { kUnitCaseParamsBuilder } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { unreachable } from '../../../common/util/util.js';
import {
  kTextureAspects,
  kTextureDimensions,
  kTextureFormatInfo,
  kTextureFormats,
  kTextureViewDimensions,
} from '../../capability_info.js';
import {
  getTextureDimensionFromView,
  reifyTextureViewDescriptor,
  viewDimensionsForTextureDimension,
} from '../../util/texture/base.js';
import { reifyExtent3D } from '../../util/unions.js';

import { kResourceStates, ValidationTest } from './validation_test.js';

export const g = makeTestGroup(ValidationTest);

const kLevels = 6;

g.test('format')
  .desc(
    `Views must have the same format as the base texture, for all {texture format}x{view format}.`
  )
  .params(u =>
    u
      .combine('textureFormat', kTextureFormats)
      .beginSubcases()
      // If undefined, should default to textureFormat.
      .combine('viewFormat', [undefined, ...kTextureFormats])
  )
  .fn(async t => {
    const { textureFormat, viewFormat } = t.params;
    await t.selectDeviceForTextureFormatOrSkipTestCase([textureFormat, viewFormat]);

    const texture = t.device.createTexture({
      format: textureFormat,
      size: [4, 4],
      usage: GPUTextureUsage.SAMPLED,
    });

    const success = viewFormat === undefined || viewFormat === textureFormat;
    t.expectValidationError(() => {
      texture.createView({ format: viewFormat });
    }, !success);
  });

g.test('dimension')
  .desc(
    `For all {texture dimension}, {view dimension}, test that they must be compatible:
  - 1d -> 1d
  - 2d -> 2d, 2d-array, cube, or cube-array
  - 3d -> 3d`
  )
  .params(u =>
    u
      .combine('textureDimension', kTextureDimensions)
      .combine('viewDimension', [...kTextureViewDimensions, undefined])
  )
  .fn(t => {
    const { textureDimension, viewDimension } = t.params;

    const size = textureDimension === '1d' ? [4] : [4, 4, 6];
    const textureDescriptor = {
      format: 'rgba8unorm' as const,
      dimension: textureDimension,
      size,
      usage: GPUTextureUsage.SAMPLED,
    };
    const texture = t.device.createTexture(textureDescriptor);

    const view = { dimension: viewDimension };
    const reified = reifyTextureViewDescriptor(textureDescriptor, view);

    const success = getTextureDimensionFromView(reified.dimension) === textureDimension;
    t.expectValidationError(() => {
      texture.createView(view);
    }, !success);
  });

g.test('aspect')
  .desc(
    `For every {format}x{aspect}, test that the view aspect must exist in the format:
  - "all" is allowed for any format
  - "depth-only" is allowed only for depth and depth-stencil formats
  - "stencil-only" is allowed only for stencil and depth-stencil formats`
  )
  .params(u =>
    u //
      .combine('format', kTextureFormats)
      .combine('aspect', kTextureAspects)
  )
  .fn(async t => {
    const { format, aspect } = t.params;
    await t.selectDeviceForTextureFormatOrSkipTestCase(format);
    const info = kTextureFormatInfo[format];

    const texture = t.device.createTexture({
      format,
      size: [4, 4, 1],
      usage: GPUTextureUsage.SAMPLED,
    });

    const success =
      aspect === 'all' ||
      (aspect === 'depth-only' && info.depth) ||
      (aspect === 'stencil-only' && info.stencil);
    t.expectValidationError(() => {
      texture.createView({ aspect });
    }, !success);
  });

const kTextureAndViewDimensions = kUnitCaseParamsBuilder
  .combine('textureDimension', kTextureDimensions)
  .expand('viewDimension', p => [
    undefined,
    ...viewDimensionsForTextureDimension(p.textureDimension),
  ]);

function validateCreateViewLayersLevels(tex: GPUTextureDescriptor, view: GPUTextureViewDescriptor) {
  const textureLevels = tex.mipLevelCount ?? 1;
  const textureLayers = tex.dimension === '2d' ? reifyExtent3D(tex.size).depthOrArrayLayers : 1;
  const reified = reifyTextureViewDescriptor(tex, view);

  let success =
    reified.mipLevelCount > 0 &&
    reified.baseMipLevel < textureLevels &&
    reified.baseMipLevel + reified.mipLevelCount <= textureLevels &&
    reified.arrayLayerCount > 0 &&
    reified.baseArrayLayer < textureLayers &&
    reified.baseArrayLayer + reified.arrayLayerCount <= textureLayers;
  if (reified.dimension === '1d' || reified.dimension === '2d' || reified.dimension === '3d') {
    success &&= reified.arrayLayerCount === 1;
  } else if (reified.dimension === 'cube') {
    success &&= reified.arrayLayerCount === 6;
  } else if (reified.dimension === 'cube-array') {
    success &&= reified.arrayLayerCount % 6 === 0;
  }
  return success;
}

g.test('array_layers')
  .desc(
    `For each texture dimension {1d,2d,3d}, for each possible view dimension for that texture
    dimension (or undefined, which defaults to the texture dimension), test validation of layer
    counts:
  - 1d, 2d, and 3d must have exactly 1 layer
  - 2d-array must have 1 or more layers
  - cube must have 6 layers
  - cube-array must have a positive multiple of 6 layers
  - Defaulting of baseArrayLayer and arrayLayerCount
  - baseArrayLayer+arrayLayerCount must be within the texture`
  )
  .params(u =>
    kTextureAndViewDimensions
      .beginSubcases()
      .expand('textureLayers', ({ textureDimension: d }) => (d === '2d' ? [1, 6, 18] : [1]))
      .combine('textureLevels', [1, kLevels])
      .expand(
        'baseArrayLayer',
        ({ textureLayers: l }) => new Set([undefined, 0, 1, 5, 6, 7, l - 1, l, l + 1])
      )
      .expand('arrayLayerCount', function* ({ textureLayers: l, baseArrayLayer = 0 }) {
        yield undefined;
        for (const lastArrayLayer of new Set([0, 1, 5, 6, 7, l - 1, l, l + 1])) {
          if (baseArrayLayer <= lastArrayLayer) yield lastArrayLayer - baseArrayLayer;
        }
      })
  )
  .fn(t => {
    const {
      textureDimension,
      viewDimension,
      textureLayers,
      textureLevels,
      baseArrayLayer,
      arrayLayerCount,
    } = t.params;

    const kWidth = 1 << (kLevels - 1); // 32
    const textureDescriptor: GPUTextureDescriptor = {
      format: 'rgba8unorm',
      dimension: textureDimension,
      size:
        textureDimension === '1d'
          ? [kWidth]
          : textureDimension === '2d'
          ? [kWidth, kWidth, textureLayers]
          : textureDimension === '3d'
          ? [kWidth, kWidth, kWidth]
          : unreachable(),
      mipLevelCount: textureLevels,
      usage: GPUTextureUsage.SAMPLED,
    };

    const viewDescriptor = { dimension: viewDimension, baseArrayLayer, arrayLayerCount };
    const success = validateCreateViewLayersLevels(textureDescriptor, viewDescriptor);

    const texture = t.device.createTexture(textureDescriptor);
    t.expectValidationError(() => {
      texture.createView(viewDescriptor);
    }, !success);
  });

g.test('mip_levels')
  .desc(
    `Views must have at least one level, and must be within the level of the base texture.

  - mipLevelCount=0 at various baseMipLevel values
  - Cases where baseMipLevel+mipLevelCount goes past the end of the texture
  - Cases with baseMipLevel or mipLevelCount undefined (compares against reference defaulting impl)
  `
  )
  .params(u =>
    kTextureAndViewDimensions
      .beginSubcases()
      .combine('textureLevels', [1, kLevels - 2, kLevels])
      .expand(
        'baseMipLevel',
        ({ textureLevels: l }) => new Set([undefined, 0, 1, 5, 6, 7, l - 1, l, l + 1])
      )
      .expand('mipLevelCount', function* ({ textureLevels: l, baseMipLevel = 0 }) {
        yield undefined;
        for (const lastMipLevel of new Set([0, 1, 5, 6, 7, l - 1, l, l + 1])) {
          if (baseMipLevel <= lastMipLevel) yield lastMipLevel - baseMipLevel;
        }
      })
  )
  .fn(t => {
    const {
      textureDimension,
      viewDimension,
      textureLevels,
      baseMipLevel,
      mipLevelCount,
    } = t.params;

    const textureDescriptor: GPUTextureDescriptor = {
      format: 'rgba8unorm',
      dimension: textureDimension,
      size:
        textureDimension === '1d' ? [32] : textureDimension === '3d' ? [32, 32, 32] : [32, 32, 18],
      mipLevelCount: textureLevels,
      usage: GPUTextureUsage.SAMPLED,
    };

    const viewDescriptor = { dimension: viewDimension, baseMipLevel, mipLevelCount };
    const success = validateCreateViewLayersLevels(textureDescriptor, viewDescriptor);

    const texture = t.device.createTexture(textureDescriptor);
    t.debug(mipLevelCount + ' ' + success);
    t.expectValidationError(() => {
      texture.createView(viewDescriptor);
    }, !success);
  });

g.test('cube_faces_square')
  .desc(
    `Test that the X/Y dimensions of cube and cube array textures must be square.
  - {2d (control case), cube, cube-array}`
  )
  .params(u =>
    u //
      .combine('dimension', ['2d', 'cube', 'cube-array'] as const)
      .combine('size', [
        [4, 4, 6],
        [5, 5, 6],
        [4, 5, 6],
        [4, 8, 6],
        [8, 4, 6],
      ])
  )
  .fn(async t => {
    const { dimension, size } = t.params;

    const texture = t.device.createTexture({
      format: 'rgba8unorm',
      size,
      usage: GPUTextureUsage.SAMPLED,
    });

    const success = dimension === '2d' || size[0] === size[1];
    t.expectValidationError(() => {
      texture.createView({ dimension });
    }, !success);
  });

g.test('texture_state')
  .desc(`createView should fail if the texture is invalid (but succeed if it is destroyed)`)
  .paramsSubcasesOnly(u => u.combine('state', kResourceStates))
  .fn(async t => {
    const { state } = t.params;
    const texture = t.createTextureWithState(state);

    t.expectValidationError(() => {
      texture.createView();
    }, state === 'invalid');
  });
