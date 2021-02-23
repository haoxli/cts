/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ import { assert } from '../../../common/framework/util/util.js';
import { kSizedTextureFormatInfo } from '../../capability_info.js';
import { align } from '../math.js';
import { standardizeExtent3D } from '../unions.js';

export const kImageCopyTypes = ['WriteTexture', 'CopyB2T', 'CopyT2B'];

export function bytesInACompleteRow(copyWidth, format) {
  const info = kSizedTextureFormatInfo[format];
  assert(copyWidth % info.blockWidth === 0);
  return (info.bytesPerBlock * copyWidth) / info.blockWidth;
}

/**
 * Validate a copy and compute the number of bytes it needs. If the copy is invalid, computes a
 * guess assuming `bytesPerRow` and `rowsPerImage` should be optimal.
 */
export function dataBytesForCopy(layout, format, copyExtentValue, { method }) {
  var _layout$offset;
  const copyExtent = standardizeExtent3D(copyExtentValue);

  const info = kSizedTextureFormatInfo[format];
  assert(copyExtent.width % info.blockWidth === 0);
  const widthInBlocks = copyExtent.width / info.blockWidth;
  assert(copyExtent.height % info.blockHeight === 0);
  const heightInBlocks = copyExtent.height / info.blockHeight;
  const bytesInLastRow = widthInBlocks * info.bytesPerBlock;

  let valid = true;
  const offset =
    (_layout$offset = layout.offset) !== null && _layout$offset !== void 0 ? _layout$offset : 0;
  if (method !== 'WriteTexture') {
    if (offset % info.bytesPerBlock !== 0) valid = false;
    if (layout.bytesPerRow && layout.bytesPerRow % 256 !== 0) valid = false;
  }
  if (layout.bytesPerRow !== undefined && bytesInLastRow > layout.bytesPerRow) valid = false;
  if (layout.rowsPerImage !== undefined && heightInBlocks > layout.rowsPerImage) valid = false;

  let requiredBytesInCopy = 0;
  {
    var _bytesPerRow, _rowsPerImage;
    let { bytesPerRow, rowsPerImage } = layout;

    // If heightInBlocks > 1, layout.bytesPerRow must be specified.
    if (heightInBlocks > 1 && bytesPerRow === undefined) valid = false;
    // If copyExtent.depth > 1, layout.bytesPerRow and layout.rowsPerImage must be specified.
    if (copyExtent.depth > 1 && rowsPerImage === undefined) valid = false;
    // If specified, layout.bytesPerRow must be greater than or equal to bytesInLastRow.
    if (bytesPerRow !== undefined && bytesPerRow < bytesInLastRow) valid = false;
    // If specified, layout.rowsPerImage must be greater than or equal to heightInBlocks.
    if (rowsPerImage !== undefined && rowsPerImage < heightInBlocks) valid = false;

    (_bytesPerRow = bytesPerRow) !== null && _bytesPerRow !== void 0
      ? _bytesPerRow
      : (bytesPerRow = align(info.bytesPerBlock * widthInBlocks, 256));
    (_rowsPerImage = rowsPerImage) !== null && _rowsPerImage !== void 0
      ? _rowsPerImage
      : (rowsPerImage = heightInBlocks);

    if (copyExtent.depth > 1) {
      const bytesPerImage = bytesPerRow * rowsPerImage;
      const bytesBeforeLastImage = bytesPerImage * (copyExtent.depth - 1);
      requiredBytesInCopy += bytesBeforeLastImage;
    }
    if (copyExtent.depth > 0) {
      if (heightInBlocks > 1) requiredBytesInCopy += bytesPerRow * (heightInBlocks - 1);
      if (heightInBlocks > 0) requiredBytesInCopy += bytesInLastRow;
    }
  }

  return { minDataSize: offset + requiredBytesInCopy, valid };
}
