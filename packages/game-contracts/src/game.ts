export type GameLifecycleState =
  | 'CREATED'
  | 'INITIALIZING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ERROR'
  | 'DESTROYED';
export type InputSource = 'TOUCH' | 'MOUSE' | 'VOICE' | 'CAMERA';
export interface PluginDefinition {
  id: string;
  version: string;
  config: Record<string, unknown>;
}
export interface ContentDefinition {
  curriculumId: string;
  unitId: string;
  items: { contentId: string; assetOverrides?: Record<string, string> }[];
}
export interface RuleDefinition {
  rounds?: number;
  allowRetry: boolean;
  maxAttempts?: number;
  timeLimitMs?: number | null;
  hintPolicy?: { enabled: boolean; afterAttempts?: number; hintLevel?: number };
  progression?: { mode: 'SEQUENTIAL' | 'RANDOM' };
}
export interface RewardDefinition {
  type: 'STAR' | 'COLLECTIBLE' | 'BADGE';
  successReward: number;
  completionBonus?: number;
}
export interface GameDefinition {
  id: string;
  version: string;
  schemaVersion: '1.0.0';
  name: string;
  description?: string;
  scene: PluginDefinition;
  mechanic: PluginDefinition;
  content: ContentDefinition;
  input: {
    allowed: InputSource[];
    settings?: {
      swipeThreshold?: number;
      voiceTimeoutMs?: number;
      gestureEnabled?: boolean;
    };
  };
  rules: RuleDefinition;
  reward: RewardDefinition;
  difficulty?: { optionCount: number };
  metadata?: Record<string, unknown>;
}
export type SceneDefinition = PluginDefinition;
export type MechanicDefinition = PluginDefinition;
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
export interface GameError {
  code: string;
  message: string;
  module: string;
  recoverable: boolean;
  cause?: unknown;
}
export interface LearningContent {
  id: string;
  curriculumId: string;
  unitId: string;
  text: string;
  assets: { image: string; audio: string };
  source: { reference: string; page?: string; kind: 'CURRICULUM' | 'DEMO' };
}
export interface LearningTask {
  id: string;
  curriculumId: string;
  unitId: string;
  target: LearningContent;
  candidates: LearningContent[];
}
export interface SceneObject {
  objectId: string;
  contentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface TapInputEvent {
  type: 'TAP';
  source: InputSource;
  x: number;
  y: number;
  timestamp: number;
}
/** Reserved for Slice: points are in game-world coordinates, never DOM events. */
export interface SwipeInputEvent {
  type: 'SWIPE';
  source: InputSource;
  points: { x: number; y: number; timestamp: number }[];
  timestamp: number;
}
export type InputEvent = TapInputEvent | SwipeInputEvent;
/** Turns one raw device API into standard InputEvents; owned by InputManager. */
export interface IInputAdapter {
  readonly sources: InputSource[];
  start(emit: (event: InputEvent) => void): void;
  stop(): void;
}
export interface PlayerAnswer {
  taskId: string;
  contentId: string;
}
export interface EvaluationResult {
  correct: boolean;
  attempts: number;
  completed: boolean;
  hintAvailable: boolean;
}
export interface GameSummary {
  sessionId: string;
  completed: number;
  total: number;
  stars: number;
  firstTryCorrect: number;
  replays: number;
  hints: number;
  durationMs: number;
}
export interface EventPayloadMap {
  GAME_INITIALIZED: Record<string, never>;
  GAME_STARTED: Record<string, never>;
  GAME_PAUSED: { reason?: string };
  GAME_RESUMED: Record<string, never>;
  GAME_COMPLETED: { durationMs: number };
  GAME_ERROR: { code: string; message: string };
  SCENE_LOADED: { sceneId: string };
  SCENE_STARTED: { sceneId: string };
  SCENE_DESTROYED: { sceneId: string };
  INPUT_RECEIVED: { inputType: string; source: InputSource };
  OBJECT_SELECTED: { objectId: string; contentId: string; taskId: string };
  TASK_PRESENTED: {
    taskId: string;
    contentId: string;
    curriculumId: string;
    unitId: string;
  };
  AUDIO_PLAYED: {
    taskId: string;
    contentId: string;
    audioType: 'PROMPT' | 'REPLAY';
  };
  ANSWER_SUBMITTED: PlayerAnswer;
  ANSWER_CORRECT: { taskId: string; contentId: string; attempts: number };
  ANSWER_INCORRECT: { taskId: string; contentId: string; attempts: number };
  HINT_REQUESTED: { taskId: string; level: number };
  REWARD_GRANTED: {
    rewardType: RewardDefinition['type'];
    amount: number;
    taskId: string;
  };
  GAME_REWARD_SUMMARY: { stars: number; collectibles: number };
}
export type GameEventType = keyof EventPayloadMap;
export interface GameEvent<K extends GameEventType = GameEventType> {
  eventId: string;
  type: K;
  gameId: string;
  sessionId: string;
  timestamp: number;
  source: string;
  payload: EventPayloadMap[K];
  version: '1.0.0';
}
export interface IEventBus {
  on<K extends GameEventType>(
    type: K,
    handler: (event: GameEvent<K>) => void,
  ): () => void;
  once<K extends GameEventType>(
    type: K,
    handler: (event: GameEvent<K>) => void,
  ): () => void;
  emit<K extends GameEventType>(
    type: K,
    payload: EventPayloadMap[K],
    source?: string,
  ): void;
  clear(): void;
}
export interface AssetReference {
  key: string;
  type: 'IMAGE' | 'AUDIO';
  url: string;
  version: string;
}
export interface AssetManifest {
  scope: string;
  assets: AssetReference[];
}
export interface IAssetManager {
  preload(manifest: AssetManifest): Promise<void>;
  get(key: string): AssetReference | undefined;
  release(scope: string): Promise<void>;
  clearUnused(): Promise<void>;
}
export interface IInputManager {
  /** Starts the adapter; returns a function that stops and removes it. */
  registerAdapter(adapter: IInputAdapter): () => void;
  enable(sources: InputSource[]): void;
  disable(): void;
  subscribe(handler: (event: InputEvent) => void): () => void;
  dispatch(event: InputEvent): void;
}
export interface IAudioManager {
  play(key: string): Promise<void>;
  stopAll(): void;
  setVolume(value: number): void;
  destroy(): Promise<void>;
}
/** What a scene needs to draw one object. It never learns which item is the answer. */
export interface SceneItem {
  objectId: string;
  contentId: string;
  image: string;
}
export interface ISceneObjects {
  show(items: SceneItem[]): void;
  hitTest(x: number, y: number): SceneObject | undefined;
  findByContent(contentId: string): SceneObject | undefined;
  feedback(objectId: string, kind: 'CORRECT' | 'RETRY' | 'HINT'): void;
  clear(): void;
}
export interface IContentResolver {
  resolve(definition: ContentDefinition): Promise<LearningContent[]>;
}
/** Read-only view of the running task sequence for plugins. */
export interface ITaskView {
  current(): LearningTask | undefined;
}
export interface IRuleEngine {
  initialize(config: RuleDefinition): void;
  setTask(task: LearningTask): void;
  evaluate(answer: PlayerAnswer): EvaluationResult;
  canHint(): boolean;
  nextRound(): void;
  isCompleted(): boolean;
  reset(): void;
}
export interface IRewardManager {
  grant(taskId: string, config: RewardDefinition): number;
  getSummary(): { stars: number };
  reset(): void;
}
export interface GameContext {
  readonly gameId: string;
  readonly sessionId: string;
  readonly definition: GameDefinition;
  readonly eventBus: IEventBus;
  readonly state: { readonly lifecycle: GameLifecycleState };
  readonly input: IInputManager;
  readonly assets: IAssetManager;
  readonly audio: IAudioManager;
  readonly objects: ISceneObjects;
  readonly tasks: ITaskView;
  readonly content: IContentResolver;
  readonly rules: IRuleEngine;
  readonly rewards: IRewardManager;
  readonly logger: { error(error: unknown): void };
}
export interface IPlugin {
  initialize(
    context: GameContext,
    config: Record<string, unknown>,
  ): void | Promise<void>;
  start(): void | Promise<void>;
  pause(): void;
  resume(): void;
  destroy(): void | Promise<void>;
}
export type IScenePlugin = IPlugin;
export type IMechanicPlugin = IPlugin;
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  apiVersion: '1.0.0';
  type: 'SCENE' | 'MECHANIC';
  requiredCapabilities: string[];
  capabilities: string[];
  configSchema: object;
}
export interface PluginRegistration {
  metadata: PluginMetadata;
  create(): IPlugin;
}
export interface EngineBaseContext {
  gameId: string;
  sessionId: string;
  definition: GameDefinition;
  eventBus: IEventBus;
  state: { readonly lifecycle: GameLifecycleState };
}
export type ContextFactory = (base: EngineBaseContext) => {
  context: GameContext;
  dispose(): void | Promise<void>;
};
export type GameCommand =
  | {
      type:
        | 'START'
        | 'PAUSE'
        | 'RESUME'
        | 'RESTART'
        | 'DESTROY'
        | 'REPLAY'
        | 'HINT'
        | 'NEXT';
    }
  | { type: 'SET_VOLUME'; value: number };
export interface GameViewState {
  lifecycle: GameLifecycleState;
  round: number;
  total: number;
  stars: number;
  feedback: 'LISTEN' | 'RETRY' | 'CORRECT' | 'HINT' | 'AUDIO_ERROR';
  busy: boolean;
  summary?: GameSummary;
}
export type GameMessage =
  | { type: 'STATE_CHANGED'; state: GameViewState }
  | { type: 'ERROR'; code: string; message: string };
export interface IGameBridge {
  send(command: GameCommand): void;
  subscribe(handler: (message: GameMessage) => void): () => void;
  destroy(): void;
}
export interface IGameEngine {
  initialize(definition: GameDefinition): Promise<void>;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  restart(): Promise<void>;
  destroy(): Promise<void>;
  getState(): GameLifecycleState;
}
