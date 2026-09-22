-- 孩子登录码：设备绑定用（claim 首次设置 / login 校验）
-- 存 scrypt 哈希（server/auth.ts），格式 s1:<salt hex>:<hash hex>

ALTER TABLE children ADD COLUMN IF NOT EXISTS pin_hash text;
