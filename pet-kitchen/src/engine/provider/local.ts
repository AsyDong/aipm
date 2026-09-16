// ============ 本地实现 ============
//
// 把现有的程序化题库包装成契约形状。行为与抽取之前完全一致：
// 同步返回、零网络、零成本、答案 100% 确定。
// 它是默认实现，也是远端不可用时的兜底。

import type { Question } from '../../types'
import { MATH_LEVELS, buildLevelQuestions, variantsOf } from '../questions'
import { gradeLocally, needsModel } from '../grading'
import type {
  GenRequest, GenResult, GradeRequest, GradeResult, SyncQuestionProvider,
} from './contract'

export const localProvider: SyncQuestionProvider = {
  name: 'local',

  generate(req: GenRequest): GenResult {
    const level = MATH_LEVELS.find((l) => l.id === req.levelId) ?? MATH_LEVELS[0]
    const inject = (req.inject ?? []).slice(0, req.count)
    return { questions: buildLevelQuestions(level, inject, req.count), source: 'local' }
  },

  variants(seed: Question, count: number): GenResult {
    return { questions: variantsOf(seed.spec).slice(0, count), source: 'local' }
  },

  grade(req: GradeRequest): GradeResult {
    if (needsModel(req.question)) {
      // 本地判分器判不了开放题；交给 router 决定转不转远端
      return { correct: false, by: 'local', deferred: true }
    }
    return gradeLocally(req.question, req.input)
  },
}
