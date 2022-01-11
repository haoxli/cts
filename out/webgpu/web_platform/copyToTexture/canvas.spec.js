/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
copyToTexture with HTMLCanvasElement and OffscreenCanvas sources.

TODO: consider whether external_texture and copyToTexture video tests should be in the same file
TODO: Add tests for flipY
`;import { makeTestGroup } from '../../../common/framework/test_group.js';
import { assert, memcpy } from '../../../common/util/util.js';
import {

kTextureFormatInfo,
kValidTextureFormatsForCopyE2T } from
'../../capability_info.js';
import { CopyToTextureUtils, isFp16Format } from '../../util/copy_to_texture.js';
import { allCanvasTypes, createCanvas } from '../../util/create_elements.js';
import { kTexelRepresentationInfo } from '../../util/texture/texel_data.js';

/**
                                                                              * If the destination format specifies a transfer function,
                                                                              * copyExternalImageToTexture (like B2T/T2T copies) should ignore it.
                                                                              */
function formatForExpectedPixels(format) {
  return format === 'rgba8unorm-srgb' ?
  'rgba8unorm' :
  format === 'bgra8unorm-srgb' ?
  'bgra8unorm' :
  format;
}

class F extends CopyToTextureUtils {
  // MAINTENANCE_TODO: Cache the generated canvas to avoid duplicated initialization.
  init2DCanvasContent({
    canvasType,
    width,
    height,
    paintOpaqueRects })








  {
    const canvas = createCanvas(this, canvasType, width, height);

    let canvasContext = null;
    canvasContext = canvas.getContext('2d');




    if (canvasContext === null) {
      this.skip(canvasType + ' canvas 2d context not available');
    }

    const rectWidth = Math.floor(width / 2);
    const rectHeight = Math.floor(height / 2);

    // The rgb10a2unorm dst texture will have tiny errors when we compare actual and expectation.
    // This is due to the convert from 8-bit to 10-bit combined with alpha value ops. So for
    // rgb10a2unorm dst textures, we'll set alphaValue to 1.0 to test.
    const alphaValue = paintOpaqueRects ? 1.0 : 0.6;
    const ctx = canvasContext;
    // Red
    ctx.fillStyle = `rgba(255, 0, 0, ${alphaValue})`;
    ctx.fillRect(0, 0, rectWidth, rectHeight);
    // Lime
    ctx.fillStyle = `rgba(0, 255, 0, ${alphaValue})`;
    ctx.fillRect(rectWidth, 0, width - rectWidth, rectHeight);
    // Blue
    ctx.fillStyle = `rgba(0, 0, 255, ${alphaValue})`;
    ctx.fillRect(0, rectHeight, rectWidth, height - rectHeight);
    // White
    ctx.fillStyle = `rgba(255, 255, 255, ${alphaValue})`;
    ctx.fillRect(rectWidth, rectHeight, width - rectWidth, height - rectHeight);

    return { canvas, canvasContext };
  }

  // MAINTENANCE_TODO: Cache the generated canvas to avoid duplicated initialization.
  initGLCanvasContent({
    canvasType,
    contextName,
    width,
    height,
    premultiplied,
    paintOpaqueRects })










  {
    const canvas = createCanvas(this, canvasType, width, height);

    const gl = canvas.getContext(contextName, { premultipliedAlpha: premultiplied });




    if (gl === null) {
      this.skip(canvasType + ' canvas ' + contextName + ' context not available');
    }
    this.trackForCleanup(gl);

    const rectWidth = Math.floor(width / 2);
    const rectHeight = Math.floor(height / 2);

    const alphaValue = paintOpaqueRects ? 1.0 : 0.6;
    const colorValue = premultiplied ? alphaValue : 1.0;

    // For webgl/webgl2 context canvas, if the context created with premultipliedAlpha attributes,
    // it means that the value in drawing buffer is premultiplied or not. So we should set
    // premultipliedAlpha value for premultipliedAlpha true gl context and unpremultipliedAlpha value
    // for the premulitpliedAlpha false gl context.
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, rectWidth, rectHeight);
    gl.clearColor(colorValue, 0.0, 0.0, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(rectWidth, 0, width - rectWidth, rectHeight);
    gl.clearColor(0.0, colorValue, 0.0, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(0, rectHeight, rectWidth, height - rectHeight);
    gl.clearColor(0.0, 0.0, colorValue, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(rectWidth, rectHeight, width - rectWidth, height - rectHeight);
    gl.clearColor(colorValue, colorValue, colorValue, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return { canvas, canvasContext: gl };
  }

  getInitGPUCanvasData(
  width,
  height,
  premultiplied,
  paintOpaqueRects)
  {
    const rectWidth = Math.floor(width / 2);
    const rectHeight = Math.floor(height / 2);

    const alphaValue = paintOpaqueRects ? 255 : 153;
    const colorValue = premultiplied ? alphaValue : 255;

    // BGRA8Unorm texture
    const initialData = new Uint8ClampedArray(4 * width * height);
    const maxRectHeightIndex = width * rectHeight;
    for (let pixelIndex = 0; pixelIndex < initialData.length / 4; ++pixelIndex) {
      const index = pixelIndex * 4;

      // Top-half two rectangles
      if (pixelIndex < maxRectHeightIndex) {
        // top-left side rectangle
        if (pixelIndex % width < rectWidth) {
          // top-left side rectangle
          initialData[index] = colorValue;
          initialData[index + 1] = 0;
          initialData[index + 2] = 0;
          initialData[index + 3] = alphaValue;
        } else {
          // top-right side rectangle
          initialData[index] = 0;
          initialData[index + 1] = colorValue;
          initialData[index + 2] = 0;
          initialData[index + 3] = alphaValue;
        }
      } else {
        // Bottom-half two rectangles
        // bottom-left side rectangle
        if (pixelIndex % width < rectWidth) {
          initialData[index] = 0;
          initialData[index + 1] = 0;
          initialData[index + 2] = colorValue;
          initialData[index + 3] = alphaValue;
        } else {
          // bottom-right side rectangle
          initialData[index] = colorValue;
          initialData[index + 1] = colorValue;
          initialData[index + 2] = colorValue;
          initialData[index + 3] = alphaValue;
        }
      }
    }
    return initialData;
  }

  initGPUCanvasContent({
    device,
    canvasType,
    width,
    height,
    premultiplied,
    paintOpaqueRects })









  {
    const canvas = createCanvas(this, canvasType, width, height);

    const gpuContext = canvas.getContext('webgpu');

    if (gpuContext === null) {
      this.skip(canvasType + ' canvas webgpu context not available');
    }

    const alphaMode = premultiplied ? 'premultiplied' : 'opaque';

    gpuContext.configure({
      device,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
      compositingAlphaMode: alphaMode });


    // BGRA8Unorm texture
    const initialData = this.getInitGPUCanvasData(width, height, premultiplied, paintOpaqueRects);
    const canvasTexture = gpuContext.getCurrentTexture();
    device.queue.writeTexture(
    { texture: canvasTexture },
    initialData,
    {
      bytesPerRow: width * 4,
      rowsPerImage: height },

    {
      width,
      height,
      depthOrArrayLayers: 1 });



    return { canvas };
  }

  getSourceCanvas2DContent(
  context,
  width,
  height)
  {
    return context.getImageData(0, 0, width, height).data;
  }

  getSourceCanvasGLContent(
  gl,
  width,
  height)
  {
    const bytesPerPixel = 4;

    const sourcePixels = new Uint8ClampedArray(width * height * bytesPerPixel);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, sourcePixels);

    const finalResult = new Uint8ClampedArray(width * height * bytesPerPixel);
    for (let i = 0; i < height; ++i) {
      for (let j = 0; j < width; ++j) {
        const pixelPos = i * width + j;
        // WebGL readPixel returns pixels from bottom-left origin. Using CopyExternalImageToTexture
        // to copy from WebGL Canvas keeps top-left origin. So the expectation from webgl.readPixel should
        // be flipped.
        const dstPixelPos = (height - i - 1) * width + j;

        memcpy(
        { src: sourcePixels, start: pixelPos * bytesPerPixel, length: bytesPerPixel },
        { dst: finalResult, start: dstPixelPos * bytesPerPixel });

      }
    }

    return finalResult;
  }

  calculateSourceContentOnCPU(
  width,
  height,
  premultipliedAlpha,
  paintOpaqueRects)
  {
    const bytesPerPixel = 4;

    const rgbaPixels = this.getInitGPUCanvasData(
    width,
    height,
    premultipliedAlpha,
    paintOpaqueRects);


    // The source canvas has bgra8unorm back resource. We
    // swizzle the channels to align with 2d/webgl canvas and
    // clear alpha to opaque when context compositingAlphaMode
    // is set to opaque (follow webgpu spec).
    for (let i = 0; i < height; ++i) {
      for (let j = 0; j < width; ++j) {
        const pixelPos = i * width + j;
        const r = rgbaPixels[pixelPos * bytesPerPixel + 2];
        if (!premultipliedAlpha) {
          rgbaPixels[pixelPos * bytesPerPixel + 3] = 255;
        }

        rgbaPixels[pixelPos * bytesPerPixel + 2] = rgbaPixels[pixelPos * bytesPerPixel];
        rgbaPixels[pixelPos * bytesPerPixel] = r;
      }
    }

    return rgbaPixels;
  }

  getExpectedPixels(
  sourcePixels,
  width,
  height,
  format,
  srcPremultiplied,
  dstPremultiplied)
  {
    const bytesPerPixel = kTextureFormatInfo[format].bytesPerBlock;

    const expectedPixels = new Uint8ClampedArray(bytesPerPixel * width * height);

    // Generate expectedPixels
    // Use getImageData and readPixels to get canvas contents.
    const rep = kTexelRepresentationInfo[format];
    const divide = 255.0;
    let rgba;
    for (let i = 0; i < height; ++i) {
      for (let j = 0; j < width; ++j) {
        const pixelPos = i * width + j;

        rgba = {
          R: sourcePixels[pixelPos * 4] / divide,
          G: sourcePixels[pixelPos * 4 + 1] / divide,
          B: sourcePixels[pixelPos * 4 + 2] / divide,
          A: sourcePixels[pixelPos * 4 + 3] / divide };


        if (!srcPremultiplied && dstPremultiplied) {
          rgba.R *= rgba.A;
          rgba.G *= rgba.A;
          rgba.B *= rgba.A;
        }

        if (srcPremultiplied && !dstPremultiplied) {
          assert(rgba.A !== 0.0);
          rgba.R /= rgba.A;
          rgba.G /= rgba.A;
          rgba.B /= rgba.A;
        }

        memcpy(
        { src: rep.pack(rep.encode(rgba)) },
        { dst: expectedPixels, start: pixelPos * bytesPerPixel });

      }
    }

    return expectedPixels;
  }}


export const g = makeTestGroup(F);

g.test('copy_contents_from_2d_context_canvas').
desc(
`
  Test HTMLCanvasElement and OffscreenCanvas with 2d context
  can be copied to WebGPU texture correctly.

  It creates HTMLCanvasElement/OffscreenCanvas with '2d'.
  Use fillRect(2d context) to render red rect for top-left,
  green rect for top-right, blue rect for bottom-left and white for bottom-right.

  Then call copyExternalImageToTexture() to do a full copy to the 0 mipLevel
  of dst texture, and read the contents out to compare with the canvas contents.

  The tests covers:
  - Valid canvas type
  - Valid 2d context type
  - Valid dstColorFormat of copyExternalImageToTexture()
  - Valid dest alphaMode
  - TODO: color space tests need to be added
  - TODO: Add error tolerance for rgb10a2unorm dst texture format

  And the expected results are all passed.
  `).

params((u) =>
u.
combine('canvasType', allCanvasTypes).
combine('dstColorFormat', kValidTextureFormatsForCopyE2T).
combine('dstPremultiplied', [true, false]).
beginSubcases().
combine('width', [1, 2, 4, 15, 255, 256]).
combine('height', [1, 2, 4, 15, 255, 256])).

fn(async t => {
  const { width, height, canvasType, dstColorFormat, dstPremultiplied } = t.params;

  // When dst texture format is rgb10a2unorm, the generated expected value of the result
  // may have tiny errors compared to the actual result when the channel value is
  // not 1.0 or 0.0.
  // For example, we init the pixel with r channel to 0.6. And the denormalized value for
  // 10-bit channel is 613.8, which needs to call "round" or other function to get an integer.
  // It is possible that gpu adopt different "round" as our cpu implementation(we use Math.round())
  // and it will generate tiny errors.
  // So the cases with rgb10a2unorm dst texture format are handled specially by painting opaque rects
  // to ensure they will have stable result after alphaOps(should keep the same value).
  const { canvas, canvasContext } = t.init2DCanvasContent({
    canvasType,
    width,
    height,
    paintOpaqueRects: dstColorFormat === 'rgb10a2unorm' });


  const dst = t.device.createTexture({
    size: {
      width,
      height,
      depthOrArrayLayers: 1 },

    format: dstColorFormat,
    usage:
    GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT });


  // Construct expected value for different dst color format
  const dstBytesPerPixel = kTextureFormatInfo[dstColorFormat].bytesPerBlock;
  const format = formatForExpectedPixels(dstColorFormat);

  // For 2d canvas, get expected pixels with getImageData(), which returns unpremultiplied
  // values.
  const sourcePixels = t.getSourceCanvas2DContent(canvasContext, width, height);
  const expectedPixels = t.getExpectedPixels(
  sourcePixels,
  width,
  height,
  format,
  false,
  dstPremultiplied);


  t.doTestAndCheckResult(
  { source: canvas, origin: { x: 0, y: 0 } },
  {
    texture: dst,
    origin: { x: 0, y: 0 },
    colorSpace: 'srgb',
    premultipliedAlpha: dstPremultiplied },

  { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
  dstBytesPerPixel,
  expectedPixels,
  isFp16Format(dstColorFormat));

});

g.test('copy_contents_from_gl_context_canvas').
desc(
`
  Test HTMLCanvasElement and OffscreenCanvas with webgl/webgl2 context
  can be copied to WebGPU texture correctly.

  It creates HTMLCanvasElement/OffscreenCanvas with webgl'/'webgl2'.
  Use scissor + clear to render red rect for top-left, green rect
  for top-right, blue rect for bottom-left and white for bottom-right.
  And do premultiply alpha in advance if the webgl/webgl2 context is created
  with premultipliedAlpha : true.

  Then call copyExternalImageToTexture() to do a full copy to the 0 mipLevel
  of dst texture, and read the contents out to compare with the canvas contents.

  The tests covers:
  - Valid canvas type
  - Valid webgl/webgl2 context type
  - Valid dstColorFormat of copyExternalImageToTexture()
  - Valid source image alphaMode
  - Valid dest alphaMode
  - TODO: color space tests need to be added
  - TODO: Add error tolerance for rgb10a2unorm dst texture format

  And the expected results are all passed.
  `).

params((u) =>
u.
combine('canvasType', allCanvasTypes).
combine('contextName', ['webgl', 'webgl2']).
combine('dstColorFormat', kValidTextureFormatsForCopyE2T).
combine('srcPremultiplied', [true, false]).
combine('dstPremultiplied', [true, false]).
beginSubcases().
combine('width', [1, 2, 4, 15, 255, 256]).
combine('height', [1, 2, 4, 15, 255, 256])).

fn(async t => {
  const {
    width,
    height,
    canvasType,
    contextName,
    dstColorFormat,
    srcPremultiplied,
    dstPremultiplied } =
  t.params;

  // When dst texture format is rgb10a2unorm, the generated expected value of the result
  // may have tiny errors compared to the actual result when the channel value is
  // not 1.0 or 0.0.
  // For example, we init the pixel with r channel to 0.6. And the denormalized value for
  // 10-bit channel is 613.8, which needs to call "round" or other function to get an integer.
  // It is possible that gpu adopt different "round" as our cpu implementation(we use Math.round())
  // and it will generate tiny errors.
  // So the cases with rgb10a2unorm dst texture format are handled specially by by painting opaque rects
  // to ensure they will have stable result after alphaOps(should keep the same value).
  const { canvas, canvasContext } = t.initGLCanvasContent({
    canvasType,
    contextName,
    width,
    height,
    premultiplied: srcPremultiplied,
    paintOpaqueRects: dstColorFormat === 'rgb10a2unorm' });


  const dst = t.device.createTexture({
    size: {
      width,
      height,
      depthOrArrayLayers: 1 },

    format: dstColorFormat,
    usage:
    GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT });


  // Construct expected value for different dst color format
  const dstBytesPerPixel = kTextureFormatInfo[dstColorFormat].bytesPerBlock;
  const format = formatForExpectedPixels(dstColorFormat);
  const sourcePixels = t.getSourceCanvasGLContent(canvasContext, width, height);
  const expectedPixels = t.getExpectedPixels(
  sourcePixels,
  width,
  height,
  format,
  srcPremultiplied,
  dstPremultiplied);


  t.doTestAndCheckResult(
  { source: canvas, origin: { x: 0, y: 0 } },
  {
    texture: dst,
    origin: { x: 0, y: 0 },
    colorSpace: 'srgb',
    premultipliedAlpha: dstPremultiplied },

  { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
  dstBytesPerPixel,
  expectedPixels,
  isFp16Format(dstColorFormat));

});

g.test('copy_contents_from_gpu_context_canvas').
desc(
`
  Test HTMLCanvasElement and OffscreenCanvas with webgpu context
  can be copied to WebGPU texture correctly.

  It creates HTMLCanvasElement/OffscreenCanvas with 'webgpu'.
  Use writeTexture to copy pixels to back buffer. The results are:
  red rect for top-left, green rect for top-right, blue rect for bottom-left
  and white for bottom-right.
  
  And do premultiply alpha in advance if the webgpu context is created
  with compositingAlphaMode="premultiplied".

  Then call copyExternalImageToTexture() to do a full copy to the 0 mipLevel
  of dst texture, and read the contents out to compare with the canvas contents.

  The tests covers:
  - Valid canvas type
  - Source WebGPU Canvas lives in the same GPUDevice or different GPUDevice as test
  - Valid dstColorFormat of copyExternalImageToTexture()
  - Valid source image alphaMode
  - Valid dest alphaMode
  - TODO: color space tests need to be added
  - TODO: Add error tolerance for rgb10a2unorm dst texture format

  And the expected results are all passed.
  `).

params((u) =>
u.
combine('canvasType', allCanvasTypes).
combine('srcAndDstInSameGPUDevice', [true, false]).
combine('dstColorFormat', kValidTextureFormatsForCopyE2T).
combine('srcPremultiplied', [true]).
combine('dstPremultiplied', [true, false]).
beginSubcases().
combine('width', [1, 2, 4, 15, 255, 256]).
combine('height', [1, 2, 4, 15, 255, 256])).

fn(async t => {
  const {
    width,
    height,
    canvasType,
    srcAndDstInSameGPUDevice,
    dstColorFormat,
    srcPremultiplied,
    dstPremultiplied } =
  t.params;

  let device;

  if (!srcAndDstInSameGPUDevice) {
    await t.selectMismatchedDeviceOrSkipTestCase(undefined);
    device = t.mismatchedDevice;
  } else {
    device = t.device;
  }

  // When dst texture format is rgb10a2unorm, the generated expected value of the result
  // may have tiny errors compared to the actual result when the channel value is
  // not 1.0 or 0.0.
  // For example, we init the pixel with r channel to 0.6. And the denormalized value for
  // 10-bit channel is 613.8, which needs to call "round" or other function to get an integer.
  // It is possible that gpu adopt different "round" as our cpu implementation(we use Math.round())
  // and it will generate tiny errors.
  // So the cases with rgb10a2unorm dst texture format are handled specially by by painting opaque rects
  // to ensure they will have stable result after alphaOps(should keep the same value).
  const { canvas } = t.initGPUCanvasContent({
    device,
    canvasType,
    width,
    height,
    premultiplied: srcPremultiplied,
    paintOpaqueRects: dstColorFormat === 'rgb10a2unorm' });


  const dst = t.device.createTexture({
    size: {
      width,
      height,
      depthOrArrayLayers: 1 },

    format: dstColorFormat,
    usage:
    GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT });


  // Construct expected value for different dst color format
  const dstBytesPerPixel = kTextureFormatInfo[dstColorFormat].bytesPerBlock;
  const format = formatForExpectedPixels(dstColorFormat);
  const sourcePixels = t.calculateSourceContentOnCPU(
  width,
  height,
  srcPremultiplied,
  dstColorFormat === 'rgb10a2unorm');

  const expectedPixels = t.getExpectedPixels(
  sourcePixels,
  width,
  height,
  format,
  srcPremultiplied,
  dstPremultiplied);


  t.doTestAndCheckResult(
  { source: canvas, origin: { x: 0, y: 0 } },
  {
    texture: dst,
    origin: { x: 0, y: 0 },
    colorSpace: 'srgb',
    premultipliedAlpha: dstPremultiplied },

  { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
  dstBytesPerPixel,
  expectedPixels,
  isFp16Format(dstColorFormat));

});
//# sourceMappingURL=canvas.spec.js.map