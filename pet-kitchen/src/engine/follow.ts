/*
 * 跟读评分的前端算法 —— 从 reading-score-demo/star-rating.html 移植（行为保持一致）。
 *
 * 抽成纯函数放这里，是为了两件事：
 *   ① 页面只管录音和渲染，判分/对齐逻辑不掺 UI；
 *   ② 能离线跑回归（零额度），改算法不用真调讯飞。
 *
 * 相关后端：POST /api/score（见 server/server.ts 的 /api/score 分支）。
 */

/** 后端 /api/score 返回的逐词结果（讯飞原始字段名） */
export interface ApiWord {
  word: string
  score: number | null
  /** 0 正常 / 16 漏读 / 32 增读 / 64 回读 / 128 替换 */
  dp_message: number | null
}

export interface ScoreResponse {
  ok: boolean
  provider?: string
  total?: number | null
  words?: ApiWord[]
  dimensions?: Record<string, number>
  is_rejected?: boolean
  except_info?: number
  except_msg?: string
  /** 同一份录音重复提交时后端直接复用上次结果，不再计费 */
  cached?: boolean
  error?: string
}

/** 对齐结果：与参考文本的词一一对应 */
export interface AlignedWord {
  score: number | null
  dp: number | null
  /** 引擎确实评到了这个词；false = 漏读（含 dp_message=16） */
  matched: boolean
}

/** 一个字词「读到位」的线；≥85 不上色，70–84 琥珀，<70 或漏读标红 */
export const PASS_SCORE = 85
export const WARN_SCORE = 70

/** 去掉大小写与标点，只留字母数字和撇号 —— 引擎返回的词会带标点，参考文本也会 */
export function normWord(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9']/g, '')
}

/** 只去标点，用于提示栏里显示原始词形 */
export function bareWord(s: string): string {
  return String(s ?? '').replace(/[.,?!;:"]/g, '')
}

/**
 * 把引擎返回的词分对齐到参考文本的每个词。
 *
 * 三条规则，每条都对应一个真实踩过的坑（改之前先看注释，别把坑踩回去）：
 *
 *   1. **增读词（dp=32）先剔除**。引擎是按「时间顺序」返回词的，孩子多读一个词，
 *      引擎就插一个增读项，位置不固定。留在池子里会顶掉后面本该匹配上的词，
 *      表现为「孩子读对了却被标红」。
 *   2. **命中过的词必须从池子里删掉**。句子里自带重复词时（`... do you have?` 里有两个 you），
 *      同一个词会被匹配两次，后面的词整串错位。
 *   3. **先试同下标，再全局按词形找**（顺序不乱时同下标是准的，错位时才回退全局）。
 *
 * 另外：**「没读出来」有两种形态** —— 引擎标了漏读（dp=16，注意实测它带的是 0 分不是空值），
 * 或者引擎压根没给分。只判断「分数为空」会把漏读说成「得分 0.0」，对家长是误导。
 */
export function alignScores(tokens: string[], apiWords: ApiWord[]): AlignedWord[] {
  const pool: Array<{ norm: string; score: number | null; dp: number | null }> = []
  for (const w of apiWords ?? []) {
    const nm = normWord(w?.word ?? '')
    if (!nm) continue
    const dp = w.dp_message == null ? null : Number(w.dp_message)
    if (dp === 32) continue // 规则 1
    pool.push({ norm: nm, score: w.score == null ? null : Number(w.score), dp })
  }

  return tokens.map((tok, i) => {
    const want = normWord(tok)
    if (!want) return { score: null, dp: null, matched: false }

    let hit = -1
    if (pool[i] && pool[i].norm === want) hit = i // 规则 3a
    if (hit < 0) {
      for (let j = 0; j < pool.length; j++) {
        if (pool[j].norm === want) {
          hit = j // 规则 3b
          break
        }
      }
    }
    if (hit < 0) return { score: null, dp: 16, matched: false } // 没对上 = 漏读

    const it = pool[hit]
    pool.splice(hit, 1) // 规则 2

    if (it.dp === 16 || it.score == null) {
      return { score: it.score, dp: it.dp == null ? 16 : it.dp, matched: false }
    }
    return { score: it.score, dp: it.dp, matched: true }
  })
}

/**
 * 星级：总分定档，再用「最差的词」压顶。
 *
 * 为什么必须压顶 —— 总分是平均值，会掩盖离群值。实测过一句：
 *   88 / 100 / 99 /【do 漏读 0】/ 100 / 100  →  总分 85.28
 * 只看总分就是 3 星，可 `do` 根本没读出来，孩子拿了满星却有一处硬伤。
 * 这就是「星级」和「标红」自相矛盾的根源。
 *
 * 现在：有漏读、或有词 <70，最高只能 2 星 —— **3 星 = 每个词都过关**。
 */
export function starsFor(total: number | null, rows: AlignedWord[]): number {
  const base = total == null ? 1 : total >= PASS_SCORE ? 3 : total >= WARN_SCORE ? 2 : 1

  const rated = (rows ?? []).filter((r) => r && r.matched && r.score != null)
  if (!rated.length) return base // 引擎没给词分 → 只能信总分

  const missed = (rows ?? []).filter((r) => r && !r.matched).length
  const worst = rated.reduce((m, r) => Math.min(m, r.score as number), 100)

  if (missed > 0 || worst < WARN_SCORE) return Math.min(base, 2)
  return base
}

/** 单个词的颜色：'' 合格 / 'warn' 偏低 / 'bad' 漏读或很差 */
export function wordTone(r: AlignedWord | undefined): '' | 'warn' | 'bad' {
  if (!r) return ''
  if (r.score == null) return r.matched ? '' : 'bad'
  if (r.score >= PASS_SCORE) return ''
  return r.score >= WARN_SCORE ? 'warn' : 'bad'
}

export interface LowWord {
  word: string
  score: number | null
  missed: boolean
}

/**
 * 提示栏要列的词：漏读的排最前，然后按分数从低到高，最多 3 个。
 *
 * 之前漏读的词是红字却不出现在提示栏里（因为它按「分数为空」过滤）——
 * 孩子看得见红字，却不知道错在哪。所以这里按 `matched` 判断，不按分数。
 */
export function lowWords(tokens: string[], rows: AlignedWord[], limit = 3): LowWord[] {
  const lows: LowWord[] = []
  rows.forEach((r, i) => {
    if (!r.matched || r.score == null || r.score < PASS_SCORE) {
      lows.push({ word: bareWord(tokens[i]), score: r.score, missed: !r.matched || r.score == null })
    }
  })
  lows.sort((a, b) => {
    if (a.missed !== b.missed) return a.missed ? -1 : 1
    return (a.score ?? 999) - (b.score ?? 999)
  })
  return lows.slice(0, limit)
}

/** 一条跟读题的判定结果，页面据此出星、标色、给提示 */
export interface ReadOutcome {
  total: number | null
  stars: number
  rows: AlignedWord[]
  lows: LowWord[]
  /** 引擎判定乱读 / 音质异常，分数不可信，不出星 */
  rejected: boolean
  rejectMsg: string
}

/** 除讯飞异常码 → 给孩子/家长看的提示（与 server.py 的 EXCEPT_MSG 对齐） */
export const EXCEPT_MSG: Record<number, string> = {
  0: '',
  28673: '没听到声音，检查一下麦克风，凑近一点再读',
  28676: '这次读的和句子对不上，再读一遍试试',
  28680: '周围太吵了，换个安静的地方再读',
  28689: '这次没听清，再读一次试试',
  28690: '声音太大了（爆音），离麦克风远一点点',
  28709: '周围太吵了，换个安静的地方再读',
}

/** 把一次 /api/score 的返回整理成页面要用的结果 */
export function outcomeOf(tokens: string[], res: ScoreResponse): ReadOutcome {
  const rows = alignScores(tokens, res.words ?? [])
  const total = res.total == null ? null : Math.round(res.total)

  // 乱读 / 音质异常时分数完全不可信 —— 官方原话「引擎报出乱说，就可以认为评分已经不可信」
  const rejected = !!res.is_rejected || (!!res.except_info && res.except_info !== 0)
  if (rejected) {
    return {
      total,
      stars: 0,
      rows,
      lows: [],
      rejected: true,
      rejectMsg: res.except_msg || EXCEPT_MSG[res.except_info ?? 0] || '这次没听清，再读一次试试',
    }
  }

  return { total, stars: starsFor(total, rows), rows, lows: lowWords(tokens, rows), rejected: false, rejectMsg: '' }
}
