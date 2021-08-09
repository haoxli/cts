export const description = `
TODO:
- test creating a render bundle, and if it's valid, test that executing it is not an error
    - color formats {all possible formats} {zero, one, multiple}
    - depth/stencil format {unset, all possible formats}
- ?
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('render_bundles,device_mismatch')
  .desc(
    `
    Tests executeBundles cannot be called with render bundles created from another device
    - two bundles from same device
    - two bundles from different device
    `
  )
  .paramsSubcasesOnly(u => u.combine('mismatched', [true, false]))
  .unimplemented();
