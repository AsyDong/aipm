/** 昵称校验：6 字内、不含数字/联系方式/脏话（合规：不使用真名） */
const BAD = ['傻', '笨蛋', '猪头', '垃圾', '滚', '死', '杀', '蠢']
const SURNAMES = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '罗']

export function checkName(name: string): { ok: boolean; msg: string } {
  const n = name.trim()
  if (!n) return { ok: false, msg: '还没有写名字哦' }
  if (n.length > 6) return { ok: false, msg: '最多 6 个字' }
  if (/\d/.test(n)) return { ok: false, msg: '名字里不要写数字' }
  if (/[a-zA-Z@#_\-]/.test(n)) return { ok: false, msg: '用中文名字更好哦' }
  if (BAD.some((w) => n.includes(w))) return { ok: false, msg: '换个更好听的名字吧' }
  if (SURNAMES.some((s) => n.startsWith(s)) && n.length >= 3) return { ok: false, msg: '不要用真实姓名哦' }
  return { ok: true, msg: '' }
}
