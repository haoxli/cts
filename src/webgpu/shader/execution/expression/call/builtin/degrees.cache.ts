import { FP } from '../../../../../util/floating_point.js';
import { makeCaseCache } from '../../case_cache.js';

// Cases: [f32|f16|abstract]_[non_]const
// abstract_non_const is empty and not used
const cases = (['f32', 'f16', 'abstract'] as const)
  .flatMap(trait =>
    ([true, false] as const).map(nonConst => ({
      [`${trait}_${nonConst ? 'non_const' : 'const'}`]: () => {
        if (trait === 'abstract' && nonConst) {
          return [];
        }
        return FP[trait].generateScalarToIntervalCases(
          FP[trait].scalarRange(),
          nonConst ? 'unfiltered' : 'finite',
          FP[trait].degreesInterval
        );
      },
    }))
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('degrees', cases);
