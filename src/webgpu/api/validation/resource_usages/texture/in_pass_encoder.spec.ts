export const description = `
Texture Usages Validation Tests in Render Pass and Compute Pass.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { pp } from '../../../../../common/util/preprocessor.js';
import { assert } from '../../../../../common/util/util.js';
import {
  kDepthStencilFormats,
  kDepthStencilFormatResolvedAspect,
  kTextureFormatInfo,
  kShaderStages,
} from '../../../../capability_info.js';
import { GPUConst } from '../../../../constants.js';
import { ValidationTest } from '../../validation_test.js';

type TextureBindingType = 'sampled-texture' | 'multisampled-texture' | 'writeonly-storage-texture';
const kTextureBindingTypes = [
  'sampled-texture',
  'multisampled-texture',
  'writeonly-storage-texture',
] as const;

const SIZE = 32;
class TextureUsageTracking extends ValidationTest {
  createTexture(
    options: {
      width?: number;
      height?: number;
      arrayLayerCount?: number;
      mipLevelCount?: number;
      sampleCount?: number;
      format?: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
    } = {}
  ): GPUTexture {
    const {
      width = SIZE,
      height = SIZE,
      arrayLayerCount = 1,
      mipLevelCount = 1,
      sampleCount = 1,
      format = 'rgba8unorm',
      usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    } = options;

    return this.device.createTexture({
      size: { width, height, depthOrArrayLayers: arrayLayerCount },
      mipLevelCount,
      sampleCount,
      dimension: '2d',
      format,
      usage,
    });
  }

  createBindGroupLayout(
    binding: number,
    bindingType: TextureBindingType,
    viewDimension: GPUTextureViewDimension,
    options: {
      format?: GPUTextureFormat;
      sampleType?: GPUTextureSampleType;
    } = {}
  ): GPUBindGroupLayout {
    const { sampleType, format } = options;
    let entry: Omit<GPUBindGroupLayoutEntry, 'binding' | 'visibility'>;
    switch (bindingType) {
      case 'sampled-texture':
        entry = { texture: { viewDimension, sampleType } };
        break;
      case 'multisampled-texture':
        entry = { texture: { viewDimension, multisampled: true, sampleType } };
        break;
      case 'writeonly-storage-texture':
        assert(format !== undefined);
        entry = { storageTexture: { access: 'write-only', format, viewDimension } };
        break;
    }

    return this.device.createBindGroupLayout({
      entries: [
        { binding, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, ...entry },
      ],
    });
  }

  createBindGroup(
    binding: number,
    resource: GPUTextureView,
    bindingType: TextureBindingType,
    viewDimension: GPUTextureViewDimension,
    options: {
      format?: GPUTextureFormat;
      sampleType?: GPUTextureSampleType;
    } = {}
  ): GPUBindGroup {
    return this.device.createBindGroup({
      entries: [{ binding, resource }],
      layout: this.createBindGroupLayout(binding, bindingType, viewDimension, options),
    });
  }

  createAndExecuteBundle(
    binding: number,
    bindGroup: GPUBindGroup,
    pass: GPURenderPassEncoder,
    depthStencilFormat?: GPUTextureFormat
  ) {
    const bundleEncoder = this.device.createRenderBundleEncoder({
      colorFormats: ['rgba8unorm'],
      depthStencilFormat,
    });
    bundleEncoder.setBindGroup(binding, bindGroup);
    const bundle = bundleEncoder.finish();
    pass.executeBundles([bundle]);
  }

  beginSimpleRenderPass(encoder: GPUCommandEncoder, view: GPUTextureView): GPURenderPassEncoder {
    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
  }

  testValidationScope(
    compute: boolean
  ): {
    bindGroup0: GPUBindGroup;
    bindGroup1: GPUBindGroup;
    encoder: GPUCommandEncoder;
    pass: GPURenderPassEncoder | GPUComputePassEncoder;
    pipeline: GPURenderPipeline | GPUComputePipeline;
  } {
    // Create two bind groups. Resource usages conflict between these two bind groups. But resource
    // usage inside each bind group doesn't conflict.
    const view = this.createTexture({
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    }).createView();
    const bindGroupLayouts = [
      this.createBindGroupLayout(0, 'sampled-texture', '2d'),
      this.createBindGroupLayout(0, 'writeonly-storage-texture', '2d', { format: 'rgba8unorm' }),
    ];
    const bindGroup0 = this.device.createBindGroup({
      layout: bindGroupLayouts[0],
      entries: [{ binding: 0, resource: view }],
    });
    const bindGroup1 = this.device.createBindGroup({
      layout: bindGroupLayouts[1],
      entries: [{ binding: 0, resource: view }],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = compute
      ? encoder.beginComputePass()
      : this.beginSimpleRenderPass(encoder, this.createTexture().createView());

    // Create pipeline. Note that bindings unused in pipeline should be validated too.
    const pipeline = compute
      ? this.createNoOpComputePipeline(
          this.device.createPipelineLayout({
            bindGroupLayouts,
          })
        )
      : this.createNoOpRenderPipeline();
    return {
      bindGroup0,
      bindGroup1,
      encoder,
      pass,
      pipeline,
    };
  }

  setPipeline(
    pass: GPURenderPassEncoder | GPUComputePassEncoder,
    pipeline: GPURenderPipeline | GPUComputePipeline
  ) {
    if (pass instanceof GPUComputePassEncoder) {
      pass.setPipeline(pipeline as GPUComputePipeline);
    } else {
      pass.setPipeline(pipeline as GPURenderPipeline);
    }
  }

  issueDrawOrDispatch(pass: GPURenderPassEncoder | GPUComputePassEncoder) {
    if (pass instanceof GPUComputePassEncoder) {
      pass.dispatchWorkgroups(1);
    } else {
      pass.draw(3, 1, 0, 0);
    }
  }

  setComputePipelineAndCallDispatch(pass: GPUComputePassEncoder, layout?: GPUPipelineLayout) {
    const pipeline = this.createNoOpComputePipeline(layout);
    pass.setPipeline(pipeline);
    pass.dispatchWorkgroups(1);
  }
}

export const g = makeTestGroup(TextureUsageTracking);

const BASE_LEVEL = 1;
const TOTAL_LEVELS = 6;
const BASE_LAYER = 1;
const TOTAL_LAYERS = 6;
const SLICE_COUNT = 2;

g.test('subresources_and_binding_types_combination_for_color')
  .desc(
    `
    Test the resource usage rules by using two views of the same GPUTexture in a usage scope. Tests
    various combinations of {sampled, storage, render target} usages, mip-level ranges, and
    array-layer ranges, in {compute pass, render pass, render pass via bundle}.
      - Error if a subresource (level/layer) is used as read+write or write+write in the scope,
        except when both usages are writeonly-storage-texture which is allowed.
  `
  )
  .params(u =>
    u
      .combine('compute', [false, true])
      .combineWithParams([
        { _usageOK: true, type0: 'sampled-texture', type1: 'sampled-texture' },
        { _usageOK: false, type0: 'sampled-texture', type1: 'writeonly-storage-texture' },
        { _usageOK: false, type0: 'sampled-texture', type1: 'render-target' },
        // Race condition upon multiple writable storage texture is valid.
        { _usageOK: true, type0: 'writeonly-storage-texture', type1: 'writeonly-storage-texture' },
        { _usageOK: false, type0: 'writeonly-storage-texture', type1: 'render-target' },
        { _usageOK: false, type0: 'render-target', type1: 'render-target' },
      ] as const)
      .beginSubcases()
      .combine('binding0InBundle', [false, true])
      .combine('binding1InBundle', [false, true])
      .unless(
        p =>
          // We can't set 'render-target' in bundle, so we need to exclude it from bundle.
          (p.binding0InBundle && p.type0 === 'render-target') ||
          (p.binding1InBundle && p.type1 === 'render-target') ||
          // We can't set 'render-target' or bundle in compute.
          (p.compute &&
            (p.binding0InBundle ||
              p.binding1InBundle ||
              p.type0 === 'render-target' ||
              p.type1 === 'render-target'))
      )
      .combineWithParams([
        // Two texture usages are binding to the same texture subresource.
        {
          levelCount0: 1,
          layerCount0: 1,
          baseLevel1: BASE_LEVEL,
          levelCount1: 1,
          baseLayer1: BASE_LAYER,
          layerCount1: 1,
          _resourceSuccess: false,
        },

        // Two texture usages are binding to different mip levels of the same texture.
        {
          levelCount0: 1,
          layerCount0: 1,
          baseLevel1: BASE_LEVEL + 1,
          levelCount1: 1,
          baseLayer1: BASE_LAYER,
          layerCount1: 1,
          _resourceSuccess: true,
        },

        // Two texture usages are binding to different array layers of the same texture.
        {
          levelCount0: 1,
          layerCount0: 1,
          baseLevel1: BASE_LEVEL,
          levelCount1: 1,
          baseLayer1: BASE_LAYER + 1,
          layerCount1: 1,
          _resourceSuccess: true,
        },

        // The second texture usage contains the whole mip chain where the first texture usage is
        // using.
        {
          levelCount0: 1,
          layerCount0: 1,
          baseLevel1: 0,
          levelCount1: TOTAL_LEVELS,
          baseLayer1: BASE_LAYER,
          layerCount1: 1,
          _resourceSuccess: false,
        },

        // The second texture usage contains all layers where the first texture usage is using.
        {
          levelCount0: 1,
          layerCount0: 1,
          baseLevel1: BASE_LEVEL,
          levelCount1: 1,
          baseLayer1: 0,
          layerCount1: TOTAL_LAYERS,
          _resourceSuccess: false,
        },

        // The second texture usage contains all subresources where the first texture usage is
        // using.
        {
          levelCount0: 1,
          layerCount0: 1,
          baseLevel1: 0,
          levelCount1: TOTAL_LEVELS,
          baseLayer1: 0,
          layerCount1: TOTAL_LAYERS,
          _resourceSuccess: false,
        },

        // Both of the two usages access a few mip levels on the same layer but they don't overlap.
        {
          levelCount0: SLICE_COUNT,
          layerCount0: 1,
          baseLevel1: BASE_LEVEL + SLICE_COUNT,
          levelCount1: 3,
          baseLayer1: BASE_LAYER,
          layerCount1: 1,
          _resourceSuccess: true,
        },

        // Both of the two usages access a few mip levels on the same layer and they overlap.
        {
          levelCount0: SLICE_COUNT,
          layerCount0: 1,
          baseLevel1: BASE_LEVEL + SLICE_COUNT - 1,
          levelCount1: 3,
          baseLayer1: BASE_LAYER,
          layerCount1: 1,
          _resourceSuccess: false,
        },

        // Both of the two usages access a few array layers on the same level but they don't
        // overlap.
        {
          levelCount0: 1,
          layerCount0: SLICE_COUNT,
          baseLevel1: BASE_LEVEL,
          levelCount1: 1,
          baseLayer1: BASE_LAYER + SLICE_COUNT,
          layerCount1: 3,
          _resourceSuccess: true,
        },

        // Both of the two usages access a few array layers on the same level and they overlap.
        {
          levelCount0: 1,
          layerCount0: SLICE_COUNT,
          baseLevel1: BASE_LEVEL,
          levelCount1: 1,
          baseLayer1: BASE_LAYER + SLICE_COUNT - 1,
          layerCount1: 3,
          _resourceSuccess: false,
        },

        // Both of the two usages access a few array layers and mip levels but they don't overlap.
        {
          levelCount0: SLICE_COUNT,
          layerCount0: SLICE_COUNT,
          baseLevel1: BASE_LEVEL + SLICE_COUNT,
          levelCount1: 3,
          baseLayer1: BASE_LAYER + SLICE_COUNT,
          layerCount1: 3,
          _resourceSuccess: true,
        },

        // Both of the two usages access a few array layers and mip levels and they overlap.
        {
          levelCount0: SLICE_COUNT,
          layerCount0: SLICE_COUNT,
          baseLevel1: BASE_LEVEL + SLICE_COUNT - 1,
          levelCount1: 3,
          baseLayer1: BASE_LAYER + SLICE_COUNT - 1,
          layerCount1: 3,
          _resourceSuccess: false,
        },
      ])
      .unless(
        p =>
          // Every color attachment or storage texture can use only one single subresource.
          (p.type0 !== 'sampled-texture' && (p.levelCount0 !== 1 || p.layerCount0 !== 1)) ||
          (p.type1 !== 'sampled-texture' && (p.levelCount1 !== 1 || p.layerCount1 !== 1)) ||
          // All color attachments' size should be the same.
          (p.type0 === 'render-target' &&
            p.type1 === 'render-target' &&
            p.baseLevel1 !== BASE_LEVEL)
      )
  )
  .fn(t => {
    const {
      compute,
      binding0InBundle,
      binding1InBundle,
      levelCount0,
      layerCount0,
      baseLevel1,
      baseLayer1,
      levelCount1,
      layerCount1,
      type0,
      type1,
      _usageOK,
      _resourceSuccess,
    } = t.params;

    const texture = t.createTexture({
      arrayLayerCount: TOTAL_LAYERS,
      mipLevelCount: TOTAL_LEVELS,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const dimension0 = layerCount0 !== 1 ? '2d-array' : '2d';
    const view0 = texture.createView({
      dimension: dimension0,
      baseMipLevel: BASE_LEVEL,
      mipLevelCount: levelCount0,
      baseArrayLayer: BASE_LAYER,
      arrayLayerCount: layerCount0,
    });

    const dimension1 = layerCount1 !== 1 ? '2d-array' : '2d';
    const view1 = texture.createView({
      dimension: dimension1,
      baseMipLevel: baseLevel1,
      mipLevelCount: levelCount1,
      baseArrayLayer: baseLayer1,
      arrayLayerCount: layerCount1,
    });

    const encoder = t.device.createCommandEncoder();
    if (type0 === 'render-target') {
      // Note that type1 is 'render-target' too. So we don't need to create bindings.
      assert(type1 === 'render-target');
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: view0,
            clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
          {
            view: view1,
            clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.end();
    } else {
      const pass = compute
        ? encoder.beginComputePass()
        : t.beginSimpleRenderPass(
            encoder,
            type1 === 'render-target' ? view1 : t.createTexture().createView()
          );

      const bgls: GPUBindGroupLayout[] = [];
      // Create bind groups. Set bind groups in pass directly or set bind groups in bundle.
      const storageTextureFormat0 = type0 === 'sampled-texture' ? undefined : 'rgba8unorm';

      const bgl0 = t.createBindGroupLayout(0, type0, dimension0, { format: storageTextureFormat0 });
      const bindGroup0 = t.device.createBindGroup({
        layout: bgl0,
        entries: [{ binding: 0, resource: view0 }],
      });
      bgls.push(bgl0);

      if (binding0InBundle) {
        assert(pass instanceof GPURenderPassEncoder);
        t.createAndExecuteBundle(0, bindGroup0, pass);
      } else {
        pass.setBindGroup(0, bindGroup0);
      }
      if (type1 !== 'render-target') {
        const storageTextureFormat1 = type1 === 'sampled-texture' ? undefined : 'rgba8unorm';

        const bgl1 = t.createBindGroupLayout(1, type1, dimension1, {
          format: storageTextureFormat1,
        });
        const bindGroup1 = t.device.createBindGroup({
          layout: bgl1,
          entries: [{ binding: 1, resource: view1 }],
        });
        bgls.push(bgl1);

        if (binding1InBundle) {
          assert(pass instanceof GPURenderPassEncoder);
          t.createAndExecuteBundle(1, bindGroup1, pass);
        } else {
          pass.setBindGroup(1, bindGroup1);
        }
      }
      if (compute) {
        t.setComputePipelineAndCallDispatch(
          pass as GPUComputePassEncoder,
          t.device.createPipelineLayout({ bindGroupLayouts: bgls })
        );
      }
      pass.end();
    }

    const success = _resourceSuccess || _usageOK;
    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('subresources_and_binding_types_combination_for_aspect')
  .desc(
    `
    Test the resource usage rules by using two views of the same GPUTexture in a usage scope. Tests
    various combinations of {sampled, render target} usages, {all, depth-only, stencil-only} aspects
    that overlap a given subresources in {compute pass, render pass, render pass via bundle}.
      - Error if a subresource (level/layer/aspect) is used as read+write or write+write in the
        scope.
  `
  )
  .params(u =>
    u
      .combine('compute', [false, true])
      .combine('binding0InBundle', [false, true])
      .combine('binding1InBundle', [false, true])
      .combine('format', kDepthStencilFormats)
      .beginSubcases()
      .combineWithParams([
        {
          baseLevel: BASE_LEVEL,
          baseLayer: BASE_LAYER,
          _resourceSuccess: false,
        },
        {
          baseLevel: BASE_LEVEL + 1,
          baseLayer: BASE_LAYER,
          _resourceSuccess: true,
        },
        {
          baseLevel: BASE_LEVEL,
          baseLayer: BASE_LAYER + 1,
          _resourceSuccess: true,
        },
      ])
      .combine('aspect0', ['all', 'depth-only', 'stencil-only'] as const)
      .combine('aspect1', ['all', 'depth-only', 'stencil-only'] as const)
      .unless(
        p =>
          (p.aspect0 === 'stencil-only' && !kTextureFormatInfo[p.format].stencil) ||
          (p.aspect1 === 'stencil-only' && !kTextureFormatInfo[p.format].stencil)
      )
      .unless(
        p =>
          (p.aspect0 === 'depth-only' && !kTextureFormatInfo[p.format].depth) ||
          (p.aspect1 === 'depth-only' && !kTextureFormatInfo[p.format].depth)
      )
      .combineWithParams([
        {
          type0: 'sampled-texture',
          type1: 'sampled-texture',
          _usageSuccess: true,
        },
        {
          type0: 'sampled-texture',
          type1: 'render-target',
          _usageSuccess: false,
        },
      ] as const)
      .unless(
        // Can't sample a multiplanar texture without selecting an aspect.
        p =>
          kTextureFormatInfo[p.format].depth &&
          kTextureFormatInfo[p.format].stencil &&
          ((p.aspect0 === 'all' && p.type0 === 'sampled-texture') ||
            (p.aspect1 === 'all' && p.type1 === 'sampled-texture'))
      )
      .unless(
        p =>
          // We can't set 'render-target' in bundle, so we need to exclude it from bundle.
          p.binding1InBundle && p.type1 === 'render-target'
      )
      .unless(
        p =>
          // We can't set 'render-target' or bundle in compute. Note that type0 is definitely not
          // 'render-target'
          p.compute && (p.binding0InBundle || p.binding1InBundle || p.type1 === 'render-target')
      )
      .unless(
        p =>
          // Depth-stencil attachment views must encompass all aspects of the texture. Invalid
          // cases are for depth-stencil textures when the aspect is not 'all'.
          p.type1 === 'render-target' &&
          kTextureFormatInfo[p.format].depth &&
          kTextureFormatInfo[p.format].stencil &&
          p.aspect1 !== 'all'
      )
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.selectDeviceOrSkipTestCase(kTextureFormatInfo[format].feature);
  })
  .fn(t => {
    const {
      compute,
      binding0InBundle,
      binding1InBundle,
      format,
      baseLevel,
      baseLayer,
      aspect0,
      aspect1,
      type0,
      type1,
      _resourceSuccess,
      _usageSuccess,
    } = t.params;

    const texture = t.createTexture({
      arrayLayerCount: TOTAL_LAYERS,
      mipLevelCount: TOTAL_LEVELS,
      format,
    });

    const view0 = texture.createView({
      dimension: '2d',
      baseMipLevel: BASE_LEVEL,
      mipLevelCount: 1,
      baseArrayLayer: BASE_LAYER,
      arrayLayerCount: 1,
      aspect: aspect0,
    });

    const view1 = texture.createView({
      dimension: '2d',
      baseMipLevel: baseLevel,
      mipLevelCount: 1,
      baseArrayLayer: baseLayer,
      arrayLayerCount: 1,
      aspect: aspect1,
    });
    const view1ResolvedFormat = kDepthStencilFormatResolvedAspect[format][aspect1]!;
    const view1HasDepth = kTextureFormatInfo[view1ResolvedFormat].depth;
    const view1HasStencil = kTextureFormatInfo[view1ResolvedFormat].stencil;

    const encoder = t.device.createCommandEncoder();
    // Color attachment's size should match depth/stencil attachment's size. Note that if
    // type1 !== 'render-target' then there's no depthStencilAttachment to match anyway.
    const depthStencilFormat = type1 === 'render-target' ? view1ResolvedFormat : undefined;

    const size = SIZE >> baseLevel;
    const pass = compute
      ? encoder.beginComputePass()
      : encoder.beginRenderPass({
          colorAttachments: [
            {
              view: t.createTexture({ width: size, height: size }).createView(),
              clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
          depthStencilAttachment: depthStencilFormat
            ? {
                view: view1,
                depthStoreOp: view1HasDepth ? 'discard' : undefined,
                depthLoadOp: view1HasDepth ? 'load' : undefined,
                stencilStoreOp: view1HasStencil ? 'discard' : undefined,
                stencilLoadOp: view1HasStencil ? 'load' : undefined,
              }
            : undefined,
        });

    const aspectSampleType = (format: GPUTextureFormat, aspect: typeof aspect0) => {
      switch (aspect) {
        case 'depth-only':
          return 'depth';
        case 'stencil-only':
          return 'uint';
        case 'all':
          assert(kTextureFormatInfo[format].depth !== kTextureFormatInfo[format].stencil);
          if (kTextureFormatInfo[format].stencil) {
            return 'uint';
          }
          return 'depth';
      }
    };

    // Create bind groups. Set bind groups in pass directly or set bind groups in bundle.
    const bindGroup0 = t.createBindGroup(0, view0, type0, '2d', {
      sampleType: type0 === 'sampled-texture' ? aspectSampleType(format, aspect0) : undefined,
    });
    if (binding0InBundle) {
      assert(pass instanceof GPURenderPassEncoder);
      t.createAndExecuteBundle(0, bindGroup0, pass, depthStencilFormat);
    } else {
      pass.setBindGroup(0, bindGroup0);
    }
    if (type1 !== 'render-target') {
      const bindGroup1 = t.createBindGroup(1, view1, type1, '2d', {
        sampleType: type1 === 'sampled-texture' ? aspectSampleType(format, aspect1) : undefined,
      });
      if (binding1InBundle) {
        assert(pass instanceof GPURenderPassEncoder);
        t.createAndExecuteBundle(1, bindGroup1, pass, depthStencilFormat);
      } else {
        pass.setBindGroup(1, bindGroup1);
      }
    }
    if (compute) t.setComputePipelineAndCallDispatch(pass as GPUComputePassEncoder);
    pass.end();

    const disjointAspects =
      (aspect0 === 'depth-only' && aspect1 === 'stencil-only') ||
      (aspect0 === 'stencil-only' && aspect1 === 'depth-only');

    // If subresources' mip/array slices has no overlap, or their binding types don't conflict,
    // it will definitely success no matter what aspects they are binding to.
    const success = disjointAspects || _resourceSuccess || _usageSuccess;

    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('shader_stages_and_visibility')
  .desc(
    `
    Test that stage visibility doesn't affect resource usage validation.
      - Test the writeonly-storage-texture binding type is not supported in vertex stage.
      - Test invisible shader stages include shader stage with visibility none, compute shader
        stage in render pass, and vertex/fragment shader stage in compute pass.

    TODO: Try to add a control case to keep this test from breaking.
    Ensure description is up to date with the code.
  `
  )
  .params(u =>
    u
      .combine('compute', [false, true])
      .combine('readVisibility', [0, ...kShaderStages])
      .combine('writeVisibility', [0, ...kShaderStages])
      .unless(
        p =>
          // Writeonly-storage-texture binding type is not supported in vertex stage. But it is the
          // only way to write into texture in compute. So there is no means to successfully create
          // a binding which attempt to write into stage(s) with vertex stage in compute pass.
          p.compute && Boolean(p.writeVisibility & GPUConst.ShaderStage.VERTEX)
      )
  )
  .fn(t => {
    const { compute, readVisibility, writeVisibility } = t.params;

    // writeonly-storage-texture binding type is not supported in vertex stage. So, this test
    // uses writeonly-storage-texture binding as writable binding upon the same subresource if
    // vertex stage is not included. Otherwise, it uses output attachment instead.
    const writeHasVertexStage = Boolean(writeVisibility & GPUShaderStage.VERTEX);
    const texUsage = writeHasVertexStage
      ? GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
      : GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING;

    const texture = t.createTexture({ usage: texUsage });
    const view = texture.createView();
    const bglEntries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: readVisibility, texture: {} },
    ];
    const bgEntries: GPUBindGroupEntry[] = [{ binding: 0, resource: view }];
    if (!writeHasVertexStage) {
      bglEntries.push({
        binding: 1,
        visibility: writeVisibility,
        storageTexture: { access: 'write-only', format: 'rgba8unorm' },
      });
      bgEntries.push({ binding: 1, resource: view });
    }
    const bgl = t.device.createBindGroupLayout({ entries: bglEntries });
    const bindGroup = t.device.createBindGroup({
      entries: bgEntries,
      layout: bgl,
    });

    const encoder = t.device.createCommandEncoder();
    const pass = compute
      ? encoder.beginComputePass()
      : t.beginSimpleRenderPass(
          encoder,
          writeHasVertexStage ? view : t.createTexture().createView()
        );
    pass.setBindGroup(0, bindGroup);
    if (compute) {
      t.setComputePipelineAndCallDispatch(
        pass as GPUComputePassEncoder,
        t.device.createPipelineLayout({
          bindGroupLayouts: [bgl],
        })
      );
    }
    pass.end();

    // Texture usages in bindings with invisible shader stages should be validated. Invisible shader
    // stages include shader stage with visibility none, compute shader stage in render pass, and
    // vertex/fragment shader stage in compute pass.
    t.expectValidationError(() => {
      encoder.finish();
    });
  });

g.test('replaced_binding')
  .desc(
    `
    Test whether a binding that's been replaced by another setBindGroup call can still
    cause validation to fail (with a write/write conflict).
      - In render pass, all setBindGroup calls contribute to the validation even if they're
        shadowed.
      - In compute pass, only the bindings visible at dispatchWorkgroups() contribute to validation.
  `
  )
  .params(u =>
    u
      .combine('compute', [false, true])
      .combine('callDrawOrDispatch', [false, true])
      .combine('entry', [
        { texture: {} },
        { storageTexture: { access: 'write-only', format: 'rgba8unorm' } },
      ] as const)
  )
  .fn(t => {
    const { compute, callDrawOrDispatch, entry } = t.params;

    const sampledView = t.createTexture().createView();
    const sampledStorageView = t
      .createTexture({ usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING })
      .createView();

    // Create bindGroup0. It has two bindings. These two bindings use different views/subresources.
    const bglEntries0: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        ...entry,
      },
    ];
    const bgEntries0: GPUBindGroupEntry[] = [
      { binding: 0, resource: sampledView },
      { binding: 1, resource: sampledStorageView },
    ];
    const bindGroup0 = t.device.createBindGroup({
      entries: bgEntries0,
      layout: t.device.createBindGroupLayout({ entries: bglEntries0 }),
    });

    // Create bindGroup1. It has one binding, which use the same view/subresource of a binding in
    // bindGroup0. So it may or may not conflicts with that binding in bindGroup0.
    const bindGroup1 = t.createBindGroup(0, sampledStorageView, 'sampled-texture', '2d', undefined);

    const encoder = t.device.createCommandEncoder();
    const pass = compute
      ? encoder.beginComputePass()
      : t.beginSimpleRenderPass(encoder, t.createTexture().createView());

    // Set bindGroup0 and bindGroup1. bindGroup0 is replaced by bindGroup1 in the current pass.
    // But bindings in bindGroup0 should be validated too.
    pass.setBindGroup(0, bindGroup0);
    if (callDrawOrDispatch) {
      const pipeline = compute ? t.createNoOpComputePipeline() : t.createNoOpRenderPipeline();
      t.setPipeline(pass, pipeline);
      t.issueDrawOrDispatch(pass);
    }
    pass.setBindGroup(0, bindGroup1);
    pass.end();

    // MAINTENANCE_TODO: If the Compatible Usage List
    // (https://gpuweb.github.io/gpuweb/#compatible-usage-list) gets programmatically defined in
    // capability_info, use it here, instead of this logic, for clarity.
    let success = entry.storageTexture?.access !== 'write-only';
    // Replaced bindings should not be validated in compute pass, because validation only occurs
    // inside dispatchWorkgroups() which only looks at the current resource usages.
    success ||= compute;

    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('bindings_in_bundle')
  .desc(
    `
    Test the texture usages in bundles by using two bindings of the same texture with various
    combination of {sampled, storage, render target} usages.
  `
  )
  .params(u =>
    u
      .combine('type0', ['render-target', ...kTextureBindingTypes] as const)
      .combine('type1', ['render-target', ...kTextureBindingTypes] as const)
      .beginSubcases()
      .combine('binding0InBundle', [false, true])
      .combine('binding1InBundle', [false, true])
      .expandWithParams(function* ({ type0, type1 }) {
        const usageForType = (type: typeof type0 | typeof type1) => {
          switch (type) {
            case 'multisampled-texture':
            case 'sampled-texture':
              return 'TEXTURE_BINDING' as const;
            case 'writeonly-storage-texture':
              return 'STORAGE_BINDING' as const;
            case 'render-target':
              return 'RENDER_ATTACHMENT' as const;
          }
        };

        yield {
          _usage0: usageForType(type0),
          _usage1: usageForType(type1),
          _sampleCount:
            type0 === 'multisampled-texture' || type1 === 'multisampled-texture'
              ? (4 as const)
              : undefined,
        };
      })
      .unless(
        p =>
          // We can't set 'render-target' in bundle, so we need to exclude it from bundle.
          // In addition, if both bindings are non-bundle, there is no need to test it because
          // we have far more comprehensive test cases for that situation in this file.
          (p.binding0InBundle && p.type0 === 'render-target') ||
          (p.binding1InBundle && p.type1 === 'render-target') ||
          (!p.binding0InBundle && !p.binding1InBundle) ||
          // Storage textures can't be multisampled.
          (p._sampleCount !== undefined &&
            p._sampleCount > 1 &&
            (p._usage0 === 'STORAGE_BINDING' || p._usage1 === 'STORAGE_BINDING')) ||
          // If both are sampled, we create two views of the same texture, so both must be
          // multisampled.
          (p.type0 === 'multisampled-texture' && p.type1 === 'sampled-texture') ||
          (p.type0 === 'sampled-texture' && p.type1 === 'multisampled-texture')
      )
  )
  .fn(t => {
    const {
      binding0InBundle,
      binding1InBundle,
      type0,
      type1,
      _usage0,
      _usage1,
      _sampleCount,
    } = t.params;

    // Two bindings are attached to the same texture view.
    const usage =
      _sampleCount === 4
        ? GPUTextureUsage[_usage0] | GPUTextureUsage[_usage1] | GPUTextureUsage.RENDER_ATTACHMENT
        : GPUTextureUsage[_usage0] | GPUTextureUsage[_usage1];
    const view = t
      .createTexture({
        usage,
        sampleCount: _sampleCount,
      })
      .createView();

    const bindGroups: GPUBindGroup[] = [];
    if (type0 !== 'render-target') {
      const binding0TexFormat = type0 === 'sampled-texture' ? undefined : 'rgba8unorm';
      bindGroups[0] = t.createBindGroup(0, view, type0, '2d', { format: binding0TexFormat });
    }
    if (type1 !== 'render-target') {
      const binding1TexFormat = type1 === 'sampled-texture' ? undefined : 'rgba8unorm';
      bindGroups[1] = t.createBindGroup(1, view, type1, '2d', { format: binding1TexFormat });
    }

    const encoder = t.device.createCommandEncoder();
    // At least one binding is in bundle, which means that its type is not 'render-target'.
    // As a result, only one binding's type is 'render-target' at most.
    const pass = t.beginSimpleRenderPass(
      encoder,
      type0 === 'render-target' || type1 === 'render-target' ? view : t.createTexture().createView()
    );

    const bindingsInBundle: boolean[] = [binding0InBundle, binding1InBundle];
    for (let i = 0; i < 2; i++) {
      // Create a bundle for each bind group if its bindings is required to be in bundle on purpose.
      // Otherwise, call setBindGroup directly in pass if needed (when its binding is not
      // 'render-target').
      if (bindingsInBundle[i]) {
        const bundleEncoder = t.device.createRenderBundleEncoder({
          colorFormats: ['rgba8unorm'],
        });
        bundleEncoder.setBindGroup(i, bindGroups[i]);
        const bundleInPass = bundleEncoder.finish();
        pass.executeBundles([bundleInPass]);
      } else if (bindGroups[i] !== undefined) {
        pass.setBindGroup(i, bindGroups[i]);
      }
    }

    pass.end();

    const isReadOnly = (t: typeof type0 | typeof type1) => {
      switch (t) {
        case 'sampled-texture':
        case 'multisampled-texture':
          return true;
        default:
          return false;
      }
    };

    let success = false;
    if (isReadOnly(type0) && isReadOnly(type1)) {
      success = true;
    }

    if (type0 === 'writeonly-storage-texture' && type1 === 'writeonly-storage-texture') {
      success = true;
    }

    // Resource usages in bundle should be validated.
    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('unused_bindings_in_pipeline')
  .desc(
    `
    Test that for compute pipelines with 'auto' layout, only bindings used by the pipeline count
    toward the usage scope. For render passes, test the pipeline doesn't matter because only the
    calls to setBindGroup count toward the usage scope.
  `
  )
  .params(u =>
    u
      .combine('compute', [false, true])
      .combine('useBindGroup0', [false, true])
      .combine('useBindGroup1', [false, true])
      .combine('setBindGroupsOrder', ['common', 'reversed'] as const)
      .combine('setPipeline', ['before', 'middle', 'after', 'none'] as const)
      .combine('callDrawOrDispatch', [false, true])
  )
  .fn(t => {
    const {
      compute,
      useBindGroup0,
      useBindGroup1,
      setBindGroupsOrder,
      setPipeline,
      callDrawOrDispatch,
    } = t.params;
    const view = t
      .createTexture({ usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING })
      .createView();
    const bindGroup0 = t.createBindGroup(0, view, 'sampled-texture', '2d', {
      format: 'rgba8unorm',
    });
    const bindGroup1 = t.createBindGroup(0, view, 'writeonly-storage-texture', '2d', {
      format: 'rgba8unorm',
    });

    const wgslVertex = `@vertex fn main() -> @builtin(position) vec4<f32> {
  return vec4<f32>();
}`;
    const wgslFragment = pp`
      ${pp._if(useBindGroup0)}
      @group(0) @binding(0) var image0 : texture_storage_2d<rgba8unorm, write>;
      ${pp._endif}
      ${pp._if(useBindGroup1)}
      @group(1) @binding(0) var image1 : texture_storage_2d<rgba8unorm, write>;
      ${pp._endif}
      @fragment fn main() {}
    `;

    const wgslCompute = pp`
      ${pp._if(useBindGroup0)}
      @group(0) @binding(0) var image0 : texture_storage_2d<rgba8unorm, write>;
      ${pp._endif}
      ${pp._if(useBindGroup1)}
      @group(1) @binding(0) var image1 : texture_storage_2d<rgba8unorm, write>;
      ${pp._endif}
      @compute @workgroup_size(1) fn main() {}
    `;

    const pipeline = compute
      ? t.device.createComputePipeline({
          layout: 'auto',
          compute: {
            module: t.device.createShaderModule({
              code: wgslCompute,
            }),
            entryPoint: 'main',
          },
        })
      : t.device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: t.device.createShaderModule({
              code: wgslVertex,
            }),
            entryPoint: 'main',
          },
          fragment: {
            module: t.device.createShaderModule({
              code: wgslFragment,
            }),
            entryPoint: 'main',
            targets: [{ format: 'rgba8unorm', writeMask: 0 }],
          },
          primitive: { topology: 'triangle-list' },
        });

    const encoder = t.device.createCommandEncoder();
    const pass = compute
      ? encoder.beginComputePass()
      : encoder.beginRenderPass({
          colorAttachments: [
            {
              view: t.createTexture().createView(),
              clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
    const index0 = setBindGroupsOrder === 'common' ? 0 : 1;
    const index1 = setBindGroupsOrder === 'common' ? 1 : 0;
    if (setPipeline === 'before') t.setPipeline(pass, pipeline);
    pass.setBindGroup(index0, bindGroup0);
    if (setPipeline === 'middle') t.setPipeline(pass, pipeline);
    pass.setBindGroup(index1, bindGroup1);
    if (setPipeline === 'after') t.setPipeline(pass, pipeline);
    if (callDrawOrDispatch) t.issueDrawOrDispatch(pass);
    pass.end();

    // Resource usage validation scope is defined by the whole render pass or by dispatch calls.
    // Regardless of whether or not dispatch is called, in a compute pass, we always succeed
    // because in this test, none of the bindings are used by the pipeline.
    // In a render pass, we always fail because usage is based on any bindings used in the
    // render pass, regardless of whether the pipeline uses them.
    let success = compute;

    // Also fails if we try to draw/dispatch without a pipeline.
    if (callDrawOrDispatch && setPipeline === 'none') {
      success = false;
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('validation_scope,no_draw_or_dispatch')
  .desc(
    `
    Test usage scope validation with two conflicting bind groups but no draw/dispatch call.
      - In compute pass, no validation error should be generated.
  `
  )
  .params(u => u.combine('compute', [false, true]))
  .fn(t => {
    const { compute } = t.params;

    const { bindGroup0, bindGroup1, encoder, pass, pipeline } = t.testValidationScope(compute);
    t.setPipeline(pass, pipeline);
    pass.setBindGroup(0, bindGroup0);
    pass.setBindGroup(1, bindGroup1);
    pass.end();

    // Resource usage validation scope is defined by dispatch calls. If dispatch is not called,
    // we don't need to do resource usage validation and no validation error to be reported.
    t.expectValidationError(() => {
      encoder.finish();
    }, !compute);
  });

g.test('validation_scope,same_draw_or_dispatch')
  .desc(
    `
    Test usage scope validation with two conflicting bind groups both used in the same
    draw/dispatch.
  `
  )
  .params(u => u.combine('compute', [false, true]))
  .fn(t => {
    const { compute } = t.params;

    const { bindGroup0, bindGroup1, encoder, pass, pipeline } = t.testValidationScope(compute);
    t.setPipeline(pass, pipeline);
    pass.setBindGroup(0, bindGroup0);
    pass.setBindGroup(1, bindGroup1);
    t.issueDrawOrDispatch(pass);
    pass.end();

    t.expectValidationError(() => {
      encoder.finish();
    });
  });

g.test('validation_scope,different_draws_or_dispatches')
  .desc(
    `
    Test usage scope validation with two conflicting bind groups used in two different draw/dispatch
    calls.

    TODO: This test is failing validation due to a different thing that it intends to test.
  `
  )
  .params(u => u.combine('compute', [false, true]))
  .fn(t => {
    const { compute } = t.params;
    const { bindGroup0, bindGroup1, encoder, pass, pipeline } = t.testValidationScope(compute);
    t.setPipeline(pass, pipeline);

    pass.setBindGroup(0, bindGroup0);
    t.issueDrawOrDispatch(pass);

    pass.setBindGroup(1, bindGroup1);
    t.issueDrawOrDispatch(pass);

    pass.end();

    // Note that bindGroup0 will be inherited in the second draw/dispatch.
    t.expectValidationError(() => {
      encoder.finish();
    });
  });

g.test('validation_scope,different_passes')
  .desc(
    `
    Test usage scope validation with two conflicting bind groups used in two entirely different
    passes. No validation error should be generated.
  `
  )
  .params(u => u.combine('compute', [false, true]))
  .fn(t => {
    const { compute } = t.params;
    const { bindGroup0, bindGroup1, encoder, pass, pipeline } = t.testValidationScope(compute);
    t.setPipeline(pass, pipeline);
    pass.setBindGroup(0, bindGroup0);
    if (compute) t.setComputePipelineAndCallDispatch(pass as GPUComputePassEncoder);
    pass.end();

    const pass1 = compute
      ? encoder.beginComputePass()
      : t.beginSimpleRenderPass(encoder, t.createTexture().createView());
    t.setPipeline(pass1, pipeline);
    pass1.setBindGroup(1, bindGroup1);
    if (compute) t.setComputePipelineAndCallDispatch(pass1 as GPUComputePassEncoder);
    pass1.end();

    // No validation error.
    encoder.finish();
  });
