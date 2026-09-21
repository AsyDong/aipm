-- 萌宠打卡 v1.1 增量迁移（配套「补齐六张表同步 op」）
--
-- 只做两处**放宽**，都是为了让「op 队列」这个同步模型能够成立。不新增表、不改列类型。
--
-- ---------------------------------------------------------------------------
-- 1) 去掉 pets.child_id → children(id) 外键
--
--    同步走的是客户端本地 op 队列：可能重试、可能被批量上限截断、可能丢弃坏数据。
--    队列语义上**保证不了严格顺序**，而外键要求 pets op 必须晚于 children op。
--    一旦顺序不巧，整批 op 会被数据库直接拒绝 —— 一条约束会拖垮整条同步流水。
--
--    去掉之后关联关系依然存在：靠 pets.child_id 的值本身，靠查询时 JOIN children。
--    「一个孩子一只宠物」这条业务规则不受影响 —— child_id 仍然是主键。
--    （代价：可能出现 child_id 指向不存在的孩子的孤儿行，由应用层保证先写 children。）
--
-- ---------------------------------------------------------------------------
-- 2) redeems.status 允许 'delivered'
--
--    前端有「已兑现」状态（家长把奖品实际交到孩子手上），原 CHECK 只到 'approved'，
--    会把这个状态挤成 'approved'，丢掉「有没有真的给到手」这个信息。
--    同时前端把「超时自动退回」与「家长手动驳回」区分开：前者记 'timeout'，后者记 'rejected'。
--
-- ---------------------------------------------------------------------------
-- 幂等：本文件可重复执行（DROP CONSTRAINT IF EXISTS / 先查后删）。
-- 执行方式：CloudBase 控制台 → 数据库 → SQL 编辑器 → 粘贴全文 → 执行。
--          （与 20260915104000 建表迁移同一入口）
--
-- ⚠️ 请先执行本迁移，再发布带新 op 的前端。否则 'delivered' / 'timeout' 两条会被
--    CHECK 拒绝，对应 op 被记为失败丢弃。

-- ===========================================================================
-- 1) 删除 pets.child_id 上的外键（按 pg_constraint 查找，不依赖约束名字）
-- ===========================================================================
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  WHERE con.conrelid = 'pets'::regclass
    AND con.contype = 'f'
    AND con.conkey = ARRAY[
      (SELECT att.attnum FROM pg_attribute att
       WHERE att.attrelid = 'pets'::regclass AND att.attname = 'child_id')
    ]
  LIMIT 1;

  IF cname IS NULL THEN
    RAISE NOTICE 'pets.child_id 上没有外键，无需处理';
  ELSE
    EXECUTE format('ALTER TABLE pets DROP CONSTRAINT %I', cname);
    RAISE NOTICE '已删除外键 %（pets.child_id → children.id）', cname;
  END IF;
END $$;

-- ===========================================================================
-- 2) 放宽兑换状态：新增 'delivered'（已兑现）
-- ===========================================================================
ALTER TABLE redeems DROP CONSTRAINT IF EXISTS redeems_status_check;

ALTER TABLE redeems ADD CONSTRAINT redeems_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'timeout', 'delivered'));

-- ===========================================================================
-- 自检（可选，单独执行看结果）
-- ===========================================================================
-- 期望 0 行（pets 上不应再有外键）：
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'pets'::regclass AND contype = 'f';
--
-- 期望 CHECK 定义里含 delivered：
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'redeems_status_check';
