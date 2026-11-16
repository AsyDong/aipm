# 儿童学习玩法目录

参考目录：<https://github.com/bobeff/open-source-games>（本次查阅其 Action、Adventure、Platformer、Puzzle、Racing、Roguelike、Sports、Tower Defense、Turn-based Strategy 等分类）。

该仓库主要是完整大型游戏、引擎和复刻项目，并不是可直接嵌入的课件小游戏集合。本项目只提取适合初学听力儿童的操作模式；没有复制其代码、素材，也没有引入远程插件或额外游戏引擎。

## 已加入 Game Arcade 的玩法

| 儿童端名称       | 参考玩法与目录示例                                       | 在本项目中的实际操作                                                                         | 主要输入                 |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| Picture Pairs    | 麻将/牌块配对，Whatajong                                 | 翻牌、记住位置，配成同一图片的两张牌后提交答案；不同图片仅翻回，不冒充一次词汇作答           | 轻点                     |
| Little Chef      | 合作烹饪与时间备料，Hurry Curry!                         | 食材在传送带上移动；拖入锅中，或轻点后用升降送达，错误食材可以重试                           | 拖动、轻点               |
| Word Racers      | 赛车与变道，SuperTuxKart、Dust Racing、Yorg              | 选择目标词所在车道，角色沿车道加速到终点；支持触摸和左右键                                   | 轻点、左右键             |
| Maze Explorer    | 迷宫探索与收集，Brogue、NetHack 等 roguelike             | 确定性生成连通迷宫；轻点目的地后进行网格寻路，角色绕过墙移动，只在最终格收集                 | 轻点、左右键             |
| Sky Jumper       | 平台移动与跳跃，Frogatto、VVVVVV、Commander Keen 系列    | 水平移动、重力、跳跃和平台落地；接触目标图片才提交                                           | 拖动、上滑、轻点、左右键 |
| Bubble Pop       | 瞄准与发射，Taisei、SDL Sopwith                          | 非暴力泡泡目标；发射星星抛射物，目标持续漂移，只有碰撞才提交                                 | 轻点瞄准                 |
| Word Golf        | 方向与力度，Open Golf、Pooltool                          | 滑动决定击球方向和力度，球有摩擦减速与边界反弹，进入目标区域后提交                           | 滑动、轻点辅助击球       |
| Little Builders  | 城市建造的正反馈循环（提取建造反馈，不引入完整经营模拟） | 选择目标材料，吊运到工地并下落；每轮答对增加一层建筑                                         | 轻点                     |
| Garden Guardians | 塔防，Server Survival                                    | 各 lane 的坏云持续逼近花园；选择对应守护者发射水滴，碰撞后提交，漏过的云回到起点而非惩罚儿童 | 轻点                     |
| Power Quest      | 回合制行动，Ancient Beast 等                             | 选择目标能力卡，角色执行冲刺行动后返回；错误回合可重试，没有战斗失败惩罚                     | 轻点                     |

另保留此前完成的 **Monkey’s Fruit Catch**：持续下落、碰撞、猴子行走和拖动/键盘接取，属于独立 `fruit-catch` 插件。

## 不适合当前阶段直接引入的类型

- 完整商业大亨、城市经营和大型 RTS：规则与界面负担远高于当前听力目标；只采用建造反馈和 lane 防守。
- FPS、写实战斗与复杂 roguelike 战斗：改作泡泡、花园和友好回合挑战，不加入暴力表现。
- 复杂棋类、牌组构筑和长文本策略：当前儿童以听音识图为主，不要求阅读规则或拼写。
- 大型外部引擎和远程可执行游戏：与本地插件、资源审查和 iPad 浏览器目标不符。

## 自动装载知识点

世界地图的 **Game arcade** 会选择当前进度中“已解锁且尚未完成”的第一个剧情关卡；全部已完成时选择最后一个已解锁关卡。普通关卡介绍页的 **Choose a game** 则明确沿用当前关卡。

`arcadeDefinition()` 只替换 `scene`、`mechanic` 和输入方式，并限制同屏候选数量。原关卡的以下内容保持不变：

- `content`：课程、单元与目标词；
- 图片、目标音频和干扰项，由 `ContentResolver` / `createTasks` 提供；
- `rules`：轮数、顺序、重试和提示；
- `reward` 与原有关卡星级；
- 同一学习事件收集器、离线 outbox 和同步流程。

儿童只选择玩法，不需要另选单词或配置知识点。数量打包关卡仍使用专用 `count-pack` 机制，不会被强行转换成单词图卡。

## 架构边界

- `ArcadeMechanic` 只把动作转换为 `IAnswerPort.submit()`，正确性仍由 `RuleEngine` / `TaskRunner` 判定。
- `ArcadeWorldScene` 只负责背景与生命周期；`PhaserArcadeObjects` 实现动作表现，不包含课程词汇。
- React 只选择本地 `GameDefinition`，不接触 Phaser 对象。
- 插件通过 `composerPlugins` 和 `pluginCatalog` 本地注册，配置有 JSON Schema。
- 所有模式沿用正确反馈后的自动下一轮、最终轮自动结算、暂停/恢复、重开、音频和退出流程。
