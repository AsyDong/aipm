-- 萌宠打卡 v1 全量表结构（后端服务独占写入，浏览器不直连）

CREATE TABLE children (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  grade         text NOT NULL DEFAULT 'g1',
  textbook_ver  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pets (
  child_id    text PRIMARY KEY REFERENCES children(id),
  species     text NOT NULL,
  name        text,
  stage       int NOT NULL DEFAULT 1,
  exp         int NOT NULL DEFAULT 0,
  satiety     int NOT NULL DEFAULT 60,
  fed_today   int NOT NULL DEFAULT 0,
  body        text NOT NULL DEFAULT 'normal',
  attrs       jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_templates (
  id          text PRIMARY KEY,
  child_id    text NOT NULL,
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'subjective',
  subject     text NOT NULL DEFAULT 'math',
  food_value  int  NOT NULL DEFAULT 1 CHECK (food_value BETWEEN 1 AND 3),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_tasks (
  id           text PRIMARY KEY,
  child_id     text NOT NULL,
  day          date NOT NULL,
  template_id  text NOT NULL,
  status       text NOT NULL DEFAULT 'todo',
  media_key    text,
  note         text,
  at           timestamptz
);
CREATE INDEX idx_daily_tasks_child_day ON daily_tasks(child_id, day);

-- 积分/食物流水（事件流，余额 = 流水推导）
CREATE TABLE ledgers (
  id        bigserial PRIMARY KEY,
  op_id     text NOT NULL UNIQUE,
  child_id  text NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('food','point')),
  delta     int NOT NULL,
  balance   int,
  source    text NOT NULL,
  note      text,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledgers_child ON ledgers(child_id, at);

CREATE TABLE level_records (
  child_id    text NOT NULL,
  level_id    text NOT NULL,
  best_stars  int NOT NULL DEFAULT 0,
  cleared     boolean NOT NULL DEFAULT false,
  play_count  int NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, level_id)
);

-- 题库：大模型生成的题 verified=false 不下发
CREATE TABLE questions (
  id           bigserial PRIMARY KEY,
  subject      text NOT NULL,
  level_id     text,
  kind         text,
  spec         jsonb,
  text         text NOT NULL,
  answer       numeric,
  hint         text,
  explain      text,
  skill        text,
  answer_type  text NOT NULL DEFAULT 'exact' CHECK (answer_type IN ('exact','open')),
  source       text NOT NULL DEFAULT 'gen' CHECK (source IN ('gen','llm','parent')),
  verified     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_subject ON questions(subject, verified);

-- 答题流水（只增不改，op_id 幂等）
CREATE TABLE attempts (
  id             bigserial PRIMARY KEY,
  op_id          text NOT NULL UNIQUE,
  child_id       text NOT NULL,
  day            date NOT NULL,
  subject        text NOT NULL,
  level_id       text,
  question_text  text NOT NULL,
  input          text,
  correct        boolean NOT NULL,
  first_try      boolean NOT NULL DEFAULT true,
  duration_ms    int,
  hints_used     int NOT NULL DEFAULT 0,
  at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attempts_child_day ON attempts(child_id, day);

CREATE TABLE wrong_items (
  id               bigserial PRIMARY KEY,
  child_id         text NOT NULL,
  subject          text NOT NULL,
  question_text    text NOT NULL,
  spec             jsonb,
  wrong_count      int NOT NULL DEFAULT 1,
  right_streak     int NOT NULL DEFAULT 0,
  mastered         boolean NOT NULL DEFAULT false,
  next_review_day  date,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, question_text)
);

CREATE TABLE daily_snapshots (
  child_id       text NOT NULL,
  day            date NOT NULL,
  satiety        int NOT NULL DEFAULT 0,
  fed            int NOT NULL DEFAULT 0,
  is_full        boolean NOT NULL DEFAULT false,
  body           text NOT NULL DEFAULT 'normal',
  streak         int NOT NULL DEFAULT 0,
  tasks_done     int NOT NULL DEFAULT 0,
  tasks_total    int NOT NULL DEFAULT 0,
  battles        int NOT NULL DEFAULT 0,
  correct_rate   numeric(4,3) NOT NULL DEFAULT 0,
  points_earned  int NOT NULL DEFAULT 0,
  food_earned    int NOT NULL DEFAULT 0,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, day)
);

CREATE TABLE prizes (
  id          text PRIMARY KEY,
  child_id    text NOT NULL,
  name        text NOT NULL,
  points      int NOT NULL,
  note        text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE redeems (
  id          text PRIMARY KEY,
  child_id    text NOT NULL,
  prize_id    text NOT NULL,
  prize_name  text NOT NULL,
  points      int NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','timeout')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz
);

CREATE TABLE llm_calls (
  id          bigserial PRIMARY KEY,
  purpose     text NOT NULL,
  model       text,
  tokens_in   int NOT NULL DEFAULT 0,
  tokens_out  int NOT NULL DEFAULT 0,
  ok          boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sync_state (
  child_id       text PRIMARY KEY,
  last_sync_at   timestamptz NOT NULL DEFAULT now(),
  server_version bigint NOT NULL DEFAULT 0
);
