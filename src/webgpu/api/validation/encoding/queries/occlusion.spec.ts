export const description = `
Validation for encoding occlusion queries.
Excludes query begin/end balance and nesting (begin_end.spec.ts)
and querySet/queryIndex (general.spec.ts).

TODO:
- Test an occlusion query with no draw calls. (If that's valid, move the test to api/operation/.)
- ?
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);
