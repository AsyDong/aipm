-- ============ 跨设备拉取同步（/api/state）所需的列 ============
--
-- 此前同步只有「推」：客户端 op → 服务端。要让另一台设备把增删改拉回来，
-- 服务端必须存得下客户端模板的全部字段 —— 老表只有 name/type/subject/food_value/active，
-- 图标、说明、排期（kind/weekdays/once_day）、停用（enabled）推上来就丢了，
-- 拉回去的模板会退化成「无图标 · 每天出现」。
--
-- active 语义不变（软删）；enabled 单独一列区分「已删除」和「被家长停用」——
-- 停用的模板要在家长的任务列表里保留，可以重新打开。

ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'regular';
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS weekdays jsonb;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS once_day date;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
