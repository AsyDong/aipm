/**
 * 答题队列循环（P08 闯关 / P10 错题练习共用）
 *
 * 规则：答对出队；答错或跳过**不公布答案**，题目回到队尾稍后重做，
 * 直到每道题都真正做对（队列清空）才算做完。
 * 因为做错的题最终都会被做对，所以「第一次就答对的题数」= 总题数 − 曾做错的题数。
 */
export function advanceQueue<T>(queue: T[], right: boolean): T[] {
  if (queue.length === 0) return queue
  return right ? queue.slice(1) : [...queue.slice(1), queue[0]]
}

/** 答错/跳过之后停留多久再跳到下一题（毫秒）——让孩子看清「这题先放下」的提示 */
export const PASS_DELAY = 900

/** 第一次就答对的题数 */
export function firstCorrectCount(total: number, missedCount: number): number {
  return Math.max(0, total - missedCount)
}
