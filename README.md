# AIPM

> 所有的战斗以一方失去战斗意志为结束，AIPM 只是个开始。

共享一些自己写的小东西。目前包含两个面向孩子的教育类 Web 应用：

## 🐾 pet-kitchen — 萌宠打卡

面向**深圳 1–2 年级**孩子的「打卡养宠 + 闯关练题」应用。

- 家长发布打卡任务 → 孩子完成后得**食物** → 投喂山海经萌宠、逐步进阶
- 闯关答题（数学 / 语文拼音 / 英语单元）得**积分** → 买装饰 / 兑换现实奖品
- 答错的题进错题集，按艾宾浩斯记忆曲线自动回炉

**技术栈**：Vite 5 + React 18 + TypeScript(strict) + Tailwind CSS 3 + zustand · 后端为 Node 22 零依赖单文件服务 + 腾讯云 CloudBase PostgreSQL

**设计核心**：本地优先、双降级链路 —— 不配后端即可完整离线游玩；数学速算永远本地判分，后端不可用时自动回落本地出题。

详见 **[pet-kitchen/README.md](./pet-kitchen/README.md)**（架构、数值规则、部署手册、安全须知）。

## 🗣️ pinyin-world — 拼音闯关世界

一年级拼音学习应用：字母表、课程跟读、拼读游戏、听音选词、看字读音、单元闯关、错题本、奖励兑换。

**技术栈**：Vue 3 + TypeScript + Vite 5，纯前端、离线可用（内置拼音音频资源）。

## 仓库约定

| 目录 | 内容 |
|---|---|
| `pet-kitchen/` | 萌宠打卡主应用（前端 + 后端 + 数据库迁移 + 文档） |
| `pet-kitchen/scripts/migrate.cjs` | CloudBase PostgreSQL 迁移执行器 |
| `pinyin-world/` | 拼音闯关世界（Vue 3 纯前端） |

**分支**：`dev` 日常开发，`main` 稳定发布。
