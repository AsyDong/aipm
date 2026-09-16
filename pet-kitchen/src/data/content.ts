import type { PetSpecies, ShopItem, TaskTemplate } from '../types'
import { uid } from '../utils/id'

export interface SpeciesDef {
  id: PetSpecies
  name: string
  tagline: string
  /** 主色，用于 SVG 渐变 */
  c1: string
  c2: string
  accent: string
  open: boolean
}

/** 山海经主题（Q14）。MVP 只开放白泽，另两种置灰「敬请期待」 */
export const SPECIES: SpeciesDef[] = [
  { id: 'baize', name: '白泽', tagline: '知万物，通人情', c1: '#FFFFFF', c2: '#DCEEFF', accent: '#7FC7F5', open: true },
  { id: 'taotie', name: '饕餮', tagline: '贪吃但有福气', c1: '#FFF3D6', c2: '#FFD79A', accent: '#F08A3C', open: false },
  { id: 'qilin', name: '麒麟', tagline: '踏云而来，送好运', c1: '#FFF0F5', c2: '#FFD3E2', accent: '#F2689A', open: false },
]

export const NAME_POOL = [
  '小火火', '云朵朵', '团团', '阿福', '小满', '青禾', '糯米', '糖豆',
  '小七', '布丁', '元宝', '咕噜', '桃桃', '毛球', '星仔', '奶昔',
  '芝麻', '嘟嘟', '小满月', '阿呜',
]

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'hut', name: '小木屋', points: 80, emoji: '🏠', x: 22, y: 62 },
  { id: 'tree', name: '摇摇树', points: 50, emoji: '🌳', x: 70, y: 60 },
  { id: 'lamp', name: '云朵灯', points: 120, emoji: '🏮', x: 46, y: 30 },
  { id: 'pond', name: '小池塘', points: 200, emoji: '⛲', x: 78, y: 74 },
  { id: 'bridge', name: '彩虹桥', points: 260, emoji: '🌈', x: 50, y: 16 },
  { id: 'carpet', name: '星辰毯', points: 150, emoji: '🟪', x: 30, y: 80 },
  { id: 'lantern', name: '石灯笼', points: 90, emoji: '🕯️', x: 14, y: 46 },
  { id: 'swing', name: '秋千', points: 180, emoji: '🎠', x: 62, y: 78 },
]

export const TASK_ICONS = ['📚', '🎹', '🏃', '🧹', '✍️', '🎨', '🦷', '🛏️', '🥗', '📖', '🧮', '🎤']

export function defaultTemplates(): TaskTemplate[] {
  const base: Array<[string, string, TaskTemplate['type']]> = [
    ['练琴 30 分钟', '🎹', 'photo'],
    ['朗读课文', '📖', 'audio'],
    ['口算 20 题', '🧮', 'subjective'],
    ['整理书包', '🎒', 'photo'],
    ['跳绳 100 个', '🏃', 'subjective'],
  ]
  return base.map(([name, icon, type]) => ({
    id: uid('t'),
    name,
    icon,
    type,
    foodValue: 1,
    enabled: true,
    createdAt: Date.now(),
  }))
}

export const DEFAULT_PRIZES = [
  { id: uid('p'), name: '去一次游乐园', points: 800, note: '周末兑现' },
  { id: uid('p'), name: '买一本绘本', points: 300, note: '' },
  { id: uid('p'), name: '看一集动画片', points: 120, note: '20 分钟' },
]

/** 宠物台词（点击宠物时随机播放） */
export const PET_LINES = [
  '今天也要加油呀！',
  '我肚子有点饿了～',
  '你真棒，我以你为荣！',
  '陪我玩一会儿好不好？',
  '吃饱了才有力气闯关！',
  '要不要去闯一关试试？',
]
