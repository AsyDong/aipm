# Game Engine 技术详细设计文档

**项目名称：** 儿童英语互动学习 App  
**文档版本：** V1.0  
**状态：** 技术设计基线  
**目标教材：** Cambridge Power Up 0  
**前端技术：** React + TypeScript + Phaser 3  
**后端技术：** Spring Boot + PostgreSQL  
**核心目标：** 构建一个场景、玩法、教材内容、输入设备和学习规则相互解耦的可扩展游戏引擎。

---

# 1. 项目目标与设计原则

## 1.1 项目目标

建设一个面向儿童英语学习的游戏引擎，通过组合场景、玩法、内容、规则和奖励，快速创建不同类型的互动英语游戏。

系统需要支持：

- 多种游戏场景。
- 多种可复用玩法。
- 多种交互输入方式。
- 多种教材和知识点。
- 多种游戏难度。
- 游戏过程数据采集。
- 后续可视化关卡编排。
- 多端运行与设备适配。

第一版通过 Fruit World 场景验证以下三种玩法：

| 玩法 | 英文名称 | 核心交互 |
|---|---|---|
| 听音找物 | Listen & Find | 听指令、点击目标 |
| 语音匹配 | Voice Match | 听单词、跟读、语音匹配 |
| 水果切割 | Fruit Slice | 听指令、滑动切割目标 |

## 1.2 核心设计原则

### 原则一：引擎与玩法解耦

Game Core 不允许依赖具体游戏玩法。

### 原则二：玩法与教材解耦

玩法只负责交互和游戏机制，不允许写死具体英语单词、句子或教材内容。

### 原则三：场景与玩法解耦

同一场景允许运行不同玩法，同一玩法允许运行不同场景。

### 原则四：统一输入协议

所有输入设备必须转换为统一 InputEvent。

### 原则五：配置驱动

关卡必须通过 GameDefinition 描述，不能依靠硬编码创建关卡。

### 原则六：插件化扩展

新增玩法应通过注册插件完成，尽量不修改核心引擎。

### 原则七：学习目标优先

游戏表现不能取代学习效果评估。允许重试、重复播放和渐进式提示，不使用高压惩罚机制。

### 原则八：控制抽象复杂度

第一版只实现真实需要的抽象。预留扩展点，但不提前实现完整编辑器、多人对战或摄像头识别。

---

# 2. 总体架构

## 2.1 逻辑架构

```text
React Application
│
├── Learning Center
│   ├── Curriculum
│   ├── Unit
│   ├── Learning Progress
│   └── Game Selection
│
├── Game Container
│   └── Phaser Game Runtime
│       │
│       ├── Game Core
│       │   ├── Game Lifecycle
│       │   ├── Game Context
│       │   ├── Event Bus
│       │   ├── Plugin Manager
│       │   ├── Scene Manager
│       │   ├── Asset Manager
│       │   ├── Input Manager
│       │   ├── Audio Manager
│       │   ├── Rule Engine
│       │   └── Reward Manager
│       │
│       ├── Scene Plugins
│       │   ├── Fruit World
│       │   ├── Forest
│       │   └── Ocean
│       │
│       ├── Game Mechanics
│       │   ├── Tap
│       │   ├── Drag & Drop
│       │   ├── Voice Match
│       │   ├── Slice
│       │   └── Runner
│       │
│       └── Learning Runtime
│           ├── Content Resolver
│           ├── Task Manager
│           └── Learning Event Collector
│
└── Backend API
    ├── Curriculum API
    ├── Content API
    ├── Game Definition API
    ├── Learning Record API
    ├── Speech API
    └── Asset API
```

## 2.2 依赖方向

必须遵循以下依赖方向：

```text
Game Container
      ↓
Game Runtime
      ↓
Game Core ← Game Contracts
      ↑
Mechanics / Scenes
      ↑
Learning Content Adapter
```

具体约束：

1. Game Core 只依赖 Game Contracts 和基础工具。
2. Mechanics 依赖 Game Contracts，不直接依赖具体 Scene。
3. Scene 依赖 Game Contracts，不依赖具体 Mechanics。
4. Learning Core 不依赖 Phaser。
5. React 不直接操作 Phaser 内部游戏对象。
6. 插件之间不允许直接调用对方的内部方法。
7. 插件间通信优先使用 EventBus。
8. 游戏运行时不得直接访问数据库。

## 2.3 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 主应用 | React + TypeScript | 页面和业务交互 |
| 游戏渲染 | Phaser 3 | 场景、对象、动画、碰撞 |
| 状态管理 | Zustand | React 应用状态 |
| 配置校验 | Zod + JSON Schema | 配置校验 |
| 音频 | Web Audio API | 音频播放与管理 |
| 录音 | MediaRecorder | 语音采集 |
| ASR | Provider Adapter | 语音识别 |
| TTS | Provider Adapter | 语音合成 |
| 手势 | MediaPipe | 后续扩展 |
| 后端 | Spring Boot | 业务 API |
| 数据库 | PostgreSQL | 业务数据 |
| 测试 | Vitest + Playwright | 单元和端到端测试 |

技术选型补充：

- 第一版建议使用 pnpm workspace 管理 Monorepo。
- Phaser 负责所有游戏画布内部的对象、坐标和动画。
- React 与 Phaser 通过 GameBridge 通信。
- 后端 ASR/TTS 接口必须采用 Provider 抽象，避免业务绑定具体模型服务。
- 不需要在第一版引入微服务、消息队列或复杂分布式架构。

---

# 3. Monorepo 工程结构

```text
english-adventure/
│
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       ├── pages/
│   │       ├── components/
│   │       ├── game-container/
│   │       └── stores/
│   │
│   └── admin/
│       └── src/
│
├── packages/
│   ├── game-contracts/
│   ├── game-core/
│   ├── game-runtime/
│   ├── game-scenes/
│   ├── game-mechanics/
│   ├── game-composer/
│   ├── learning-core/
│   ├── speech-core/
│   ├── asset-manager/
│   └── ui-components/
│
├── services/
│   └── backend/
│
├── assets/
│   ├── images/
│   ├── audio/
│   ├── animations/
│   └── fonts/
│
├── schemas/
│   ├── game-definition.schema.json
│   ├── scene-config.schema.json
│   └── mechanic-config.schema.json
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MODULE_SPEC.md
│   ├── EVENT_PROTOCOL.md
│   ├── PLUGIN_SPEC.md
│   ├── GAME_CONFIG_SCHEMA.md
│   ├── TEST_SPEC.md
│   └── DEVELOPMENT_TASKS.md
│
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## 3.1 包职责

| Package | 职责 | 是否依赖 Phaser |
|---|---|---|
| game-contracts | 类型、接口、协议 | 否 |
| game-core | 生命周期、事件、插件管理 | 否 |
| game-runtime | Phaser 运行时适配 | 是 |
| game-scenes | 场景插件 | 是 |
| game-mechanics | 玩法插件 | 是 |
| game-composer | 关卡编排和配置校验 | 否 |
| learning-core | 教材和学习内容模型 | 否 |
| speech-core | ASR/TTS 抽象 | 否 |
| asset-manager | 资源清单和加载协议 | 由 runtime 适配 |
| ui-components | React 公共组件 | 否 |

注意：game-core 与 game-runtime 必须分离。核心生命周期和插件管理不应该依赖 Phaser 的具体实现。

---

# 4. 核心数据模型

## 4.1 GameDefinition

GameDefinition 是一份完整关卡定义。

```typescript
interface GameDefinition {
  id: string;
  version: string;
  schemaVersion: string;

  name: string;
  description?: string;

  scene: SceneDefinition;
  mechanic: MechanicDefinition;

  content: ContentDefinition;

  input: InputDefinition;

  rules: RuleDefinition;

  reward: RewardDefinition;

  difficulty?: DifficultyDefinition;

  metadata?: Record<string, unknown>;
}
```

## 4.2 SceneDefinition

```typescript
interface SceneDefinition {
  id: string;
  version: string;

  config: Record<string, unknown>;
}
```

## 4.3 MechanicDefinition

```typescript
interface MechanicDefinition {
  id: string;
  version: string;

  config: Record<string, unknown>;
}
```

## 4.4 ContentDefinition

```typescript
interface ContentDefinition {
  curriculumId: string;
  unitId: string;

  items: LearningContentReference[];
}

interface LearningContentReference {
  contentId: string;
  assetOverrides?: Record<string, string>;
}
```

内容引用与内容本身分离。关卡尽量只引用内容 ID，不复制教材全部数据。

## 4.5 InputDefinition

```typescript
type InputSource =
  | "TOUCH"
  | "MOUSE"
  | "VOICE"
  | "CAMERA";

interface InputDefinition {
  allowed: InputSource[];

  settings?: {
    swipeThreshold?: number;
    voiceTimeoutMs?: number;
    gestureEnabled?: boolean;
  };
}
```

## 4.6 RuleDefinition

```typescript
interface RuleDefinition {
  rounds?: number;

  allowRetry: boolean;

  maxAttempts?: number;

  timeLimitMs?: number | null;

  hintPolicy?: {
    enabled: boolean;
    afterAttempts?: number;
    hintLevel?: number;
  };

  progression?: {
    mode: "SEQUENTIAL" | "RANDOM" | "ADAPTIVE";
  };
}
```

## 4.7 RewardDefinition

```typescript
interface RewardDefinition {
  type: "STAR" | "COLLECTIBLE" | "BADGE";

  successReward: number;

  incorrectPenalty?: number;

  completionBonus?: number;
}
```

儿童学习模式默认不配置错误惩罚。

---

# 5. Game Core 模块详细设计

## 5.1 GameEngine

职责：

- 创建游戏实例。
- 初始化运行环境。
- 加载 GameDefinition。
- 构建 GameContext。
- 管理场景和玩法生命周期。
- 统一处理暂停、恢复、重启和销毁。

接口：

```typescript
interface IGameEngine {
  initialize(
    definition: GameDefinition
  ): Promise<void>;

  start(): Promise<void>;

  pause(): void;

  resume(): void;

  restart(): Promise<void>;

  destroy(): Promise<void>;

  getState(): GameLifecycleState;
}
```

生命周期：

```text
CREATED
   ↓
INITIALIZING
   ↓
READY
   ↓
RUNNING
   ↓
PAUSED
   ↓
RUNNING
   ↓
COMPLETED
   ↓
DESTROYED
```

异常情况下进入 ERROR 状态。

约束：

- initialize 只能在 CREATED 状态调用。
- start 只能在 READY 状态调用。
- pause 只能在 RUNNING 状态调用。
- resume 只能在 PAUSED 状态调用。
- destroy 必须允许重复调用且不产生副作用。
- 初始化失败必须释放已创建资源。

## 5.2 GameContext

职责：提供插件运行时需要的公共能力。

```typescript
interface GameContext {
  readonly gameId: string;

  readonly sessionId: string;

  readonly eventBus: IEventBus;

  readonly input: IInputManager;

  readonly assets: IAssetManager;

  readonly audio: IAudioManager;

  readonly scene: ISceneManager;

  readonly rules: IRuleEngine;

  readonly rewards: IRewardManager;

  readonly content: IContentResolver;

  readonly state: IReadonlyGameState;

  readonly logger: ILogger;
}
```

约束：

- Context 由 Engine 创建。
- 插件只能获得必要接口。
- 插件不能直接修改核心状态对象。
- 状态变更通过 Game API 或事件实现。

## 5.3 EventBus

职责：

- 事件注册。
- 事件发布。
- 事件取消订阅。
- 事件调试和追踪。

接口：

```typescript
interface IEventBus {
  on<T>(
    type: GameEventType,
    handler: (event: GameEvent<T>) => void
  ): Unsubscribe;

  once<T>(
    type: GameEventType,
    handler: (event: GameEvent<T>) => void
  ): Unsubscribe;

  emit<T>(
    type: GameEventType,
    payload: T,
    source?: string
  ): void;

  clear(): void;
}
```

要求：

- 事件必须支持 TypeScript 类型约束。
- 订阅返回 unsubscribe。
- 插件销毁时必须取消所有订阅。
- 单个监听器异常不得阻断其他监听器。
- 事件默认同步派发。
- 不允许通过 EventBus 传输大型二进制资源。
- 事件需要携带 sessionId、timestamp 和 eventId。

## 5.4 PluginManager

职责：

- 插件注册。
- 插件查找。
- 插件实例创建。
- 版本校验。
- 能力校验。
- 插件生命周期管理。

接口：

```typescript
interface IPluginManager {
  register(plugin: PluginDefinition): void;

  get(id: string): PluginDefinition | undefined;

  createScene(
    definition: SceneDefinition,
    context: GameContext
  ): Promise<IScenePlugin>;

  createMechanic(
    definition: MechanicDefinition,
    context: GameContext
  ): Promise<IMechanicPlugin>;

  validate(
    game: GameDefinition
  ): ValidationResult;
}
```

注册规则：

- 插件 ID 全局唯一。
- 相同 ID 和版本不得重复注册。
- 插件必须声明版本。
- 插件必须声明 requiredCapabilities。
- 插件必须声明可兼容的场景能力。
- 不允许通过配置执行动态任意代码。

## 5.5 SceneManager

职责：

- 场景初始化。
- 场景切换。
- 场景资源加载。
- 场景对象管理。
- 场景销毁。

接口：

```typescript
interface ISceneManager {
  load(
    definition: SceneDefinition
  ): Promise<void>;

  start(): Promise<void>;

  pause(): void;

  resume(): void;

  unload(): Promise<void>;

  getCurrentScene(): IScenePlugin | null;
}
```

第一版不需要支持多个场景并行运行。

## 5.6 AssetManager

职责：

- 资源清单解析。
- 资源预加载。
- 资源缓存。
- 资源引用计数。
- 加载失败重试。
- 场景和插件资源释放。

接口：

```typescript
interface IAssetManager {
  preload(
    manifest: AssetManifest
  ): Promise<void>;

  get(
    key: string
  ): AssetReference | undefined;

  release(
    scope: string
  ): Promise<void>;

  clearUnused(): Promise<void>;
}
```

资源类型：

```typescript
type AssetType =
  | "IMAGE"
  | "AUDIO"
  | "SPRITESHEET"
  | "ATLAS"
  | "JSON"
  | "VIDEO"
  | "FONT";
```

资源要求：

- 每个资源必须有唯一 key。
- 支持资源 URL 和版本号。
- 允许场景与玩法声明自己的资源。
- 不允许插件直接随意创建不可追踪的资源缓存。
- 资源加载必须支持失败回退。

## 5.7 InputManager

职责：

- 注册输入适配器。
- 接收原始输入。
- 标准化输入。
- 过滤不允许的输入类型。
- 分发 InputEvent。

接口：

```typescript
interface IInputManager {
  registerAdapter(
    adapter: IInputAdapter
  ): void;

  enable(
    sources: InputSource[]
  ): void;

  disable(): void;

  subscribe(
    handler: (event: InputEvent) => void
  ): Unsubscribe;

  dispatch(event: InputEvent): void;
}
```

输入适配器：

```typescript
interface IInputAdapter {
  readonly source: InputSource;

  initialize(): Promise<void>;

  start(): Promise<void>;

  stop(): Promise<void>;

  destroy(): Promise<void>;
}
```

第一版实现：

- TouchAdapter。
- MouseAdapter。
- VoiceAdapter。

GestureAdapter 只定义扩展接口，暂不实现摄像头识别。

## 5.8 AudioManager

职责：

- 音频预加载。
- 音频播放。
- 音量控制。
- 背景音乐。
- 音效管理。
- 播放中断和释放。

接口：

```typescript
interface IAudioManager {
  load(manifest: AssetManifest): Promise<void>;

  play(
    key: string,
    options?: AudioPlayOptions
  ): Promise<AudioPlayback>;

  stop(key: string): void;

  stopAll(): void;

  setVolume(value: number): void;

  destroy(): Promise<void>;
}
```

必须支持：

- 单词音频重复播放。
- 指令播放期间暂停其他语音。
- 背景音乐与语音音量独立。
- 音频加载失败时使用 TTS 回退策略（若已配置）。

## 5.9 RuleEngine

职责：

- 回答正确性判断。
- 尝试次数管理。
- 回合推进。
- 提示策略。
- 游戏完成条件判断。

接口：

```typescript
interface IRuleEngine {
  initialize(config: RuleDefinition): void;

  evaluate(
    input: PlayerAnswer
  ): EvaluationResult;

  nextRound(): void;

  requestHint(): HintResult;

  isCompleted(): boolean;

  reset(): void;
}
```

规则引擎不直接操作 Phaser 对象。

## 5.10 RewardManager

职责：

- 根据游戏事件发放奖励。
- 记录奖励。
- 处理关卡完成奖励。
- 避免重复发放。

接口：

```typescript
interface IRewardManager {
  grant(
    reward: RewardDefinition,
    reason: RewardReason
  ): RewardResult;

  getSummary(): RewardSummary;

  reset(): void;
}
```

奖励计算必须可重复测试，不得由具体玩法插件自行随意计算。

---

# 6. Scene 插件规范

## 6.1 场景接口

```typescript
interface IScenePlugin {
  readonly id: string;
  readonly version: string;

  initialize(
    context: GameContext,
    config: Record<string, unknown>
  ): Promise<void>;

  start(): Promise<void>;

  pause(): void;

  resume(): void;

  getCapabilities(): string[];

  getAssetManifest(): AssetManifest;

  destroy(): Promise<void>;
}
```

## 6.2 场景能力声明

示例：

```typescript
const FruitWorldCapabilities = [
  "RENDER_2D",
  "OBJECT_SPRITE",
  "OBJECT_ANIMATION",
  "OBJECT_COLLISION",
  "BACKGROUND_LAYER",
  "PARTICLE_EFFECT"
];
```

玩法需要的能力必须能够由场景提供。

例如 Slice 需要：

```typescript
[
  "OBJECT_SPRITE",
  "OBJECT_COLLISION",
  "OBJECT_ANIMATION"
]
```

如果场景不具备所需能力，编排器必须阻止发布。

## 6.3 场景设计约束

场景只负责：

- 展示环境。
- 管理场景对象。
- 提供交互目标。
- 提供动画和特效。
- 对外暴露必要的对象操作能力。

场景不负责：

- 具体英语答案。
- 学习进度。
- 语音识别。
- 奖励规则。
- 关卡流程。

---

# 7. Mechanic 玩法插件规范

## 7.1 插件接口

```typescript
interface IMechanicPlugin {
  readonly id: string;
  readonly version: string;

  validateConfig(
    config: unknown
  ): ValidationResult;

  initialize(
    context: GameContext,
    config: unknown
  ): Promise<void>;

  start(): Promise<void>;

  pause(): void;

  resume(): void;

  handleInput(event: InputEvent): void;

  getCapabilities(): string[];

  getRequiredSceneCapabilities(): string[];

  getAssetManifest(): AssetManifest;

  destroy(): Promise<void>;
}
```

## 7.2 插件元数据

```typescript
interface PluginMetadata {
  id: string;
  name: string;
  version: string;

  type: "SCENE" | "MECHANIC";

  apiVersion: string;

  requiredCapabilities: string[];

  optionalCapabilities: string[];

  compatibleScenes?: string[];

  configSchema: object;
}
```

## 7.3 插件开发约束

1. 插件只能通过 GameContext 使用公共服务。
2. 不允许直接访问其他插件实例。
3. 不允许直接访问数据库。
4. 不允许将教材词汇写死在插件代码中。
5. 所有输入必须由 InputManager 提供。
6. 所有资源必须通过 AssetManager 管理。
7. 插件必须提供 destroy。
8. 插件必须清理事件订阅。
9. 插件必须提供配置校验。
10. 插件不得在初始化阶段自动开始游戏。

## 7.4 Tap 插件设计

输入：

```typescript
type TapConfig = {
  selectionMode: "SINGLE";
  showHint: boolean;
  maxOptions: number;
};
```

核心流程：

```text
接收当前学习任务
    ↓
场景展示候选对象
    ↓
AudioManager 播放目标
    ↓
InputManager 接收 TAP
    ↓
插件判断目标对象
    ↓
发布 OBJECT_SELECTED
    ↓
RuleEngine 判断答案
    ↓
发布 ANSWER_CORRECT / ANSWER_INCORRECT
```

## 7.5 Voice Match 插件设计

语音服务与玩法逻辑分离。

```typescript
interface ISpeechService {
  recognize(
    request: SpeechRecognitionRequest
  ): Promise<SpeechRecognitionResult>;

  synthesize(
    request: SpeechSynthesisRequest
  ): Promise<AudioAsset>;
}
```

语音识别结果：

```typescript
interface SpeechRecognitionResult {
  text: string;

  confidence?: number;

  language: string;

  provider: string;

  durationMs: number;

  status:
    | "SUCCESS"
    | "NO_SPEECH"
    | "LOW_CONFIDENCE"
    | "ERROR";
}
```

Voice Match 负责：

- 播放目标单词。
- 请求录音。
- 调用语音服务。
- 归一化识别文本。
- 将识别结果交给匹配策略。
- 发布结果事件。

不负责：

- 具体 ASR 服务商实现。
- 麦克风权限管理的 UI。
- 学习报告生成。

第一版只做单词级匹配，不将 ASR 置信度直接等同于发音水平。

## 7.6 Slice 插件设计

核心算法：

1. 维护滑动轨迹。
2. 检测轨迹与可切割对象的相交。
3. 判断对象是否已经切割。
4. 触发切割动画。
5. 发布 OBJECT_SLICED。
6. 由规则系统判断是否完成任务。

输入事件：

```typescript
interface SwipeInputEvent extends BaseInputEvent {
  type: "SWIPE";

  points: Array<{
    x: number;
    y: number;
    timestamp: number;
  }>;
}
```

算法约束：

- 轨迹点数量必须限制。
- 滑动速度和最短距离可配置。
- 同一个水果不能重复触发切割。
- 坐标必须统一转换为 Phaser 游戏世界坐标。
- 插件不得直接读取浏览器触摸事件。

---

# 8. 事件协议 EVENT PROTOCOL

## 8.1 统一事件结构

```typescript
interface GameEvent<T = unknown> {
  eventId: string;

  type: GameEventType;

  gameId: string;

  sessionId: string;

  timestamp: number;

  source: string;

  payload: T;

  version: string;
}
```

时间戳使用 Unix 毫秒。

## 8.2 事件类型

### 生命周期事件

| 事件 | Payload |
|---|---|
| GAME_INITIALIZED | {} |
| GAME_STARTED | {} |
| GAME_PAUSED | { reason? } |
| GAME_RESUMED | {} |
| GAME_COMPLETED | { durationMs } |
| GAME_ERROR | { code, message } |

### 场景事件

| 事件 | Payload |
|---|---|
| SCENE_LOADED | { sceneId } |
| SCENE_STARTED | { sceneId } |
| SCENE_DESTROYED | { sceneId } |

### 交互事件

| 事件 | Payload |
|---|---|
| OBJECT_SELECTED | { objectId } |
| OBJECT_DRAGGED | { objectId, targetId? } |
| OBJECT_MATCHED | { objectId, contentId } |
| OBJECT_SLICED | { objectId, contentId } |
| INPUT_RECEIVED | { inputType, source } |

### 学习事件

| 事件 | Payload |
|---|---|
| TASK_PRESENTED | { taskId, contentId } |
| AUDIO_PLAYED | { contentId, audioType } |
| ANSWER_SUBMITTED | { taskId, answer } |
| ANSWER_CORRECT | { taskId, contentId } |
| ANSWER_INCORRECT | { taskId, contentId } |
| HINT_REQUESTED | { taskId, level } |
| VOICE_RECOGNIZED | { text, confidence? } |
| VOICE_FAILED | { reason } |

### 奖励事件

| 事件 | Payload |
|---|---|
| REWARD_GRANTED | { rewardType, amount } |
| GAME_REWARD_SUMMARY | { stars, collectibles } |

## 8.3 事件派发原则

- 一个业务动作尽可能只发布一次事实事件。
- 不允许多个模块重复计算同一个答案。
- 学习记录由 Learning Event Collector 订阅事件产生。
- UI 通过状态更新或订阅只读事件获取展示信息。
- 高频坐标事件不进入持久化学习记录。
- 语音原始音频不通过 EventBus 传输。
- 事件必须可以关联 gameId 和 sessionId。

## 8.4 事件时序示例

Listen & Find：

```text
GAME_STARTED
    ↓
TASK_PRESENTED
    ↓
AUDIO_PLAYED
    ↓
INPUT_RECEIVED
    ↓
OBJECT_SELECTED
    ↓
ANSWER_SUBMITTED
    ↓
ANSWER_CORRECT
    ↓
REWARD_GRANTED
    ↓
TASK_PRESENTED
```

语音匹配：

```text
TASK_PRESENTED
    ↓
AUDIO_PLAYED
    ↓
VOICE_RECORDING_STARTED
    ↓
VOICE_RECOGNIZED
    ↓
ANSWER_SUBMITTED
    ↓
ANSWER_CORRECT / ANSWER_INCORRECT
```

---

# 9. GameDefinition JSON Schema

## 9.1 Schema 设计要求

- 使用 JSON Schema Draft 2020-12。
- 根对象必须声明 schemaVersion。
- 所有配置必须显式声明字段类型。
- 未知字段默认禁止。
- 玩法和场景配置通过各自 Schema 验证。
- 关卡必须经过插件能力兼容性校验。
- 配置校验与资源存在性校验分开执行。

## 9.2 第一版 JSON Schema

文件：schemas/game-definition.schema.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/schemas/game-definition.schema.json",
  "title": "GameDefinition",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "id",
    "version",
    "schemaVersion",
    "name",
    "scene",
    "mechanic",
    "content",
    "input",
    "rules",
    "reward"
  ],
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "schemaVersion": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "scene": {
      "$ref": "#/$defs/pluginDefinition"
    },
    "mechanic": {
      "$ref": "#/$defs/pluginDefinition"
    },
    "content": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "curriculumId",
        "unitId",
        "items"
      ],
      "properties": {
        "curriculumId": {
          "type": "string"
        },
        "unitId": {
          "type": "string"
        },
        "items": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["contentId"],
            "properties": {
              "contentId": {
                "type": "string"
              },
              "assetOverrides": {
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    },
    "input": {
      "type": "object",
      "additionalProperties": false,
      "required": ["allowed"],
      "properties": {
        "allowed": {
          "type": "array",
          "uniqueItems": true,
          "items": {
            "enum": [
              "TOUCH",
              "MOUSE",
              "VOICE",
              "CAMERA"
            ]
          }
        }
      }
    },
    "rules": {
      "type": "object",
      "additionalProperties": false,
      "required": ["allowRetry"],
      "properties": {
        "rounds": {
          "type": "integer",
          "minimum": 1
        },
        "allowRetry": {
          "type": "boolean"
        },
        "maxAttempts": {
          "type": "integer",
          "minimum": 1
        },
        "timeLimitMs": {
          "type": ["integer", "null"],
          "minimum": 1000
        }
      }
    },
    "reward": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "type",
        "successReward"
      ],
      "properties": {
        "type": {
          "enum": [
            "STAR",
            "COLLECTIBLE",
            "BADGE"
          ]
        },
        "successReward": {
          "type": "integer",
          "minimum": 0
        },
        "completionBonus": {
          "type": "integer",
          "minimum": 0
        }
      }
    }
  },
  "$defs": {
    "pluginDefinition": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "version",
        "config"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "version": {
          "type": "string"
        },
        "config": {
          "type": "object"
        }
      }
    }
  }
}
```

说明：

此 Schema 是第一版基础契约。每个玩法还必须提供自己的 mechanic config schema，不能仅依靠根 Schema 验证。

## 9.3 配置校验流程

```text
接收 GameDefinition
       ↓
JSON Schema 校验
       ↓
插件是否存在
       ↓
插件版本是否兼容
       ↓
插件配置 Schema 校验
       ↓
场景能力兼容性校验
       ↓
教材内容 ID 校验
       ↓
资源存在性校验
       ↓
READY
```

任何一步失败，都不能启动关卡。

---

# 10. 教材内容系统

## 10.1 LearningContent

```typescript
interface LearningContent {
  id: string;

  curriculumId: string;

  unitId: string;

  type:
    | "VOCABULARY"
    | "SENTENCE"
    | "PHONICS"
    | "LISTENING";

  text: string;

  translation?: string;

  phonetic?: string;

  assets: {
    image?: string;
    audio?: string;
  };

  source?: {
    page?: string;
    reference?: string;
  };

  learningStatus?: {
    introduced: boolean;
    reviewed: boolean;
  };

  tags: string[];
}
```

## 10.2 内容管理规则

1. 教材内容必须有教材和 Unit 归属。
2. 内容 ID 全局唯一。
3. 图片和音频资源使用独立 Asset ID。
4. 内容不能写死在游戏代码中。
5. 内容状态必须支持未学习、已学习、复习中、掌握等状态。
6. 正式关卡必须标明教材来源。
7. 未经家长允许，不自动使用超前词汇和句型。

## 10.3 学习掌握程度

第一版不建立复杂 AI 学习模型。

采用可解释的规则：

- 首次完成。
- 多次正确。
- 是否需要提示。
- 是否主动表达。
- 是否需要重复听。

这些数据作为学习状态的依据之一，不直接宣称等同于真实语言能力。

---

# 11. Game Composer 配置编排器

## 11.1 职责

Game Composer 负责将已有组件组合成一份可运行的 GameDefinition。

第一版不做拖拽编辑器。

## 11.2 第一版功能

- 选择场景。
- 选择玩法。
- 选择教材。
- 选择 Unit。
- 选择知识点。
- 配置难度。
- 配置输入方式。
- 配置奖励。
- 校验配置。
- 预览关卡。
- 发布关卡。

## 11.3 核心接口

```typescript
interface IGameComposer {
  getAvailableScenes(): PluginMetadata[];

  getAvailableMechanics(): PluginMetadata[];

  createDefinition(
    input: GameComposerInput
  ): GameDefinition;

  validate(
    definition: GameDefinition
  ): ValidationResult;

  preview(
    definition: GameDefinition
  ): Promise<void>;
}
```

后续可增加可视化编辑器，但不得改变 GameDefinition 核心契约。

---

# 12. React 与 Phaser 通信协议

## 12.1 设计目标

React 不得直接操作 Phaser 的游戏对象。

通过 GameBridge 进行双向通信。

## 12.2 接口

```typescript
interface IGameBridge {
  send(command: GameCommand): void;

  subscribe(
    handler: (message: GameMessage) => void
  ): Unsubscribe;

  destroy(): void;
}
```

命令：

```typescript
type GameCommand =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "RESTART" }
  | { type: "DESTROY" }
  | { type: "SET_VOLUME"; value: number };
```

消息：

```typescript
type GameMessage =
  | { type: "READY" }
  | { type: "STATE_CHANGED"; state: string }
  | { type: "PROGRESS_CHANGED"; progress: number }
  | { type: "COMPLETED"; summary: GameSummary }
  | { type: "ERROR"; code: string; message: string };
```

## 12.3 生命周期要求

- React 组件挂载时创建 Phaser 实例。
- React 组件卸载时销毁 Phaser 实例。
- 重复挂载不得产生多个残留游戏实例。
- 游戏结束后允许 React 展示结果页。
- 浏览器页面隐藏时允许暂停游戏。

---

# 13. 后端接口设计

第一版采用 REST API。

## 13.1 教材接口

```http
GET /api/v1/curricula
GET /api/v1/curricula/{id}/units
GET /api/v1/units/{id}/contents
```

## 13.2 关卡接口

```http
GET /api/v1/games
GET /api/v1/games/{id}
POST /api/v1/games/validate
```

## 13.3 学习记录接口

```http
POST /api/v1/game-sessions
POST /api/v1/game-sessions/{id}/events
POST /api/v1/game-sessions/{id}/complete
GET /api/v1/learning-progress
```

## 13.4 语音接口

```http
POST /api/v1/speech/recognize
POST /api/v1/speech/synthesize
```

语音识别采用 multipart/form-data 或可配置的音频上传协议。

## 13.5 后端约束

- API 使用版本前缀。
- 请求和响应统一结构。
- 记录必须关联用户和 session。
- 语音文件限制大小和时长。
- 音频文件不得无限期保留。
- 语音服务失败必须返回明确错误码。
- 认证与用户隔离在正式部署时必须实现。

---

# 14. 数据库设计

第一版核心表：

| 表名 | 主要字段 |
|---|---|
| curriculum | id, name, version |
| curriculum_unit | id, curriculum_id, name, sequence |
| learning_content | id, unit_id, type, text, source |
| content_asset | id, content_id, asset_type, url |
| game_scene | id, version, config |
| game_mechanic | id, version, metadata |
| game_definition | id, version, config, status |
| game_session | id, user_id, game_id, started_at, ended_at |
| game_event_record | id, session_id, event_type, payload, timestamp |
| learning_record | id, user_id, content_id, session_id, result |
| learning_progress | id, user_id, content_id, mastery_status |
| reward_record | id, session_id, reward_type, amount |

数据库设计要求：

- 业务主键使用 UUID。
- game_definition 保存 schemaVersion。
- 配置采用 JSONB。
- 事件记录支持按 session 查询。
- 高频输入轨迹不写入数据库。
- 学习记录与游戏分数分开存储。

---

# 15. 安全、隐私与可靠性

儿童使用场景必须特别注意：

1. 麦克风调用必须有明确的用户交互授权。
2. 摄像头功能默认关闭。
3. 第一版不采集儿童视频。
4. 语音数据只用于当前识别任务，默认不长期保存原始音频。
5. 不将孩子语音用于模型训练。
6. 不在日志中输出原始音频内容或敏感信息。
7. API 必须支持用户数据隔离。
8. 资源加载必须限制来源。
9. 游戏配置不得执行任意脚本。
10. 语音服务必须有超时、重试和降级策略。

---

# 16. 测试标准

## 16.1 单元测试

| 模块 | 测试重点 |
|---|---|
| GameEngine | 生命周期、异常恢复 |
| EventBus | 订阅、取消、异常隔离 |
| PluginManager | 注册、查找、版本冲突 |
| InputManager | 输入转换、过滤 |
| AssetManager | 加载、缓存、释放 |
| RuleEngine | 正确性、重试、结束条件 |
| RewardManager | 奖励计算、重复发放 |
| GameDefinition | Schema 校验 |
| Voice Match | 文本归一化和匹配 |
| Slice | 轨迹碰撞、重复切割 |

## 16.2 集成测试

必须覆盖：

1. 配置加载到游戏启动。
2. 场景初始化与玩法初始化。
3. 点击到答案判断。
4. 语音录音到答案判断。
5. 滑动到切割动画。
6. 游戏完成到奖励记录。
7. 游戏销毁到资源释放。

## 16.3 E2E 测试

使用 Playwright 验证：

- 首页打开游戏。
- 游戏正常加载。
- 点击任务对象。
- 游戏反馈正确。
- 暂停和恢复。
- 结束并展示结果。
- 切换玩法。
- 页面卸载后无残留实例。

## 16.4 架构测试

必须验证：

- Game Core 不依赖 Phaser。
- Mechanics 不依赖教材具体内容。
- Scene 不依赖 Mechanics。
- React 不访问 Phaser 内部对象。
- 新增内容不修改玩法代码。
- 新增玩法不修改核心引擎主体。
- 插件销毁后没有遗留事件监听。
- 非法 GameDefinition 无法启动。

## 16.5 性能基线

第一版以移动端浏览器为主要验证对象。

建议初始验收目标：

- 普通关卡资源加载后能够稳定运行。
- 常规游戏场景保持流畅交互。
- 页面切换不残留游戏实例。
- 音频播放与交互反馈没有明显阻塞。
- 游戏资源有明确释放机制。

具体帧率、资源体积和首屏加载目标，在确定目标设备后进行实测，不提前承诺所有低端设备都达到固定性能指标。

---

# 17. 第一版实施边界

第一版必须实现：

- React + Phaser 集成。
- Game Core 基础模块。
- 插件注册和生命周期。
- EventBus。
- InputManager。
- AssetManager。
- Fruit World 场景。
- Tap 玩法。
- Voice Match 玩法。
- Slice 玩法。
- GameDefinition Schema。
- 基础学习事件记录。
- 最小可用后端接口。

第一版不实现：

- 多人实时对战。
- 摄像头手势识别。
- 完整可视化编辑器。
- AI 自动生成可执行插件代码。
- 复杂排行榜。
- 社交系统。
- 大型游戏物理系统。
- 多租户插件市场。

---

# 18. 核心架构验收标准

整个架构最终必须通过以下验收：

**测试 A：内容复用**

增加一个新单词，只需要新增 LearningContent 和资源，不修改玩法代码。

**测试 B：场景复用**

Tap 可以在 Fruit World 和 Forest 场景中运行。

**测试 C：玩法复用**

Fruit World 可以运行 Tap、Voice Match 和 Slice。

**测试 D：输入复用**

Slice 可以使用触屏和鼠标完成同一套玩法逻辑。

**测试 E：插件扩展**

增加一个新玩法插件，不需要修改 Game Core 主体。

**测试 F：配置安全**

非法配置、未知插件、缺失资源和不兼容能力均不能启动关卡。

**测试 G：生命周期**

反复启动、暂停、恢复和销毁游戏，不出现重复监听、资源泄漏和多个残留实例。

**测试 H：学习目标**

孩子可以重复听、请求提示、重新尝试，游戏不因语音识别失败而直接惩罚孩子。

---

# 19. 技术决策记录

| 决策 | 当前方案 | 状态 |
|---|---|---|
| 主前端 | React + TypeScript | 基线 |
| 游戏引擎 | Phaser 3 | 基线 |
| 工程管理 | pnpm Monorepo | 基线 |
| 状态管理 | Zustand | 基线 |
| 配置校验 | JSON Schema + Zod | 基线 |
| 后端 | Spring Boot | 基线 |
| 数据库 | PostgreSQL | 基线 |
| 语音识别 | Provider Adapter | 待选服务商 |
| 语音合成 | Provider Adapter | 待选服务商 |
| 手势识别 | MediaPipe | 后续阶段 |
| 部署形态 | Web 优先，多端适配 | 待确定具体端 |
| 原生 App | 暂不确定 | 待验证 |

所有未确认事项不得在开发过程中擅自转化为既定产品需求。

---

**文档结束**
