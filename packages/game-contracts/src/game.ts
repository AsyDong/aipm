/** Logical size of the game canvas; every scene and mechanic works in these units. */
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
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
export interface SliceConfig {
  minDistance?: number;
}
/** A completed gesture in game-world coordinates, never DOM events. */
export interface SwipeInputEvent {
  type: 'SWIPE';
  source: InputSource;
  points: { x: number; y: number; timestamp: number }[];
  timestamp: number;
}
export interface VoiceInputEvent {
  type: 'VOICE';
  source: 'VOICE';
  taskId: string;
  sessionId: string;
  text?: string;
  confidence?: number;
  failure?: UnrecognizedReason;
  timestamp: number;
}
export type InputEvent = TapInputEvent | SwipeInputEvent | VoiceInputEvent;
/** Turns one raw device API into standard InputEvents; owned by InputManager. */
export interface IInputAdapter {
  readonly sources: InputSource[];
  start(emit: (event: InputEvent) => void): void;
  stop(): void;
  /** Drops a gesture begun before a prompt, pause or other input boundary. */
  reset?(): void;
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
  /** The child's answer could not be read (e.g. no speech). Not a wrong answer: no attempt is counted. */
  VOICE_FAILED: { taskId: string; reason: UnrecognizedReason };
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
/** 'playback' for prompts; 'play-and-record' while the microphone is open (iOS routes audio differently). */
export type AudioSessionMode = 'playback' | 'play-and-record';
export interface IAudioManager {
  play(key: string): Promise<void>;
  /** Plays a short line over nothing else; resolves when it ends. Failures never throw. */
  say(key: string): Promise<void>;
  setSession(mode: AudioSessionMode): void;
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
  /** The scene says where its counter is: horizontal centre and the surface fruit stands on. */
  setShelf(centerX: number, baseY: number): void;
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
export type UnrecognizedReason =
  | 'NO_SPEECH'
  | 'LOW_CONFIDENCE'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'ERROR';
/**
 * The single way a mechanic reports what the child did. The runtime decides
 * whether answers are open (e.g. after the prompt), so mechanics stay simple.
 */
export interface IAnswerPort {
  /** False while a prompt is playing or the game is paused; submissions are then ignored. */
  isOpen(): boolean;
  submit(contentId: string, objectId?: string): void;
  unrecognized(reason: UnrecognizedReason): void;
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
  readonly answers: IAnswerPort;
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
  /** Files the plugin needs for this config; preloaded before the game can start. */
  assets?(config: Record<string, unknown>): AssetReference[];
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
        | 'NEXT'
        | 'VOICE_START'
        | 'VOICE_STOP';
    }
  | { type: 'SET_VOLUME'; value: number }
  /** Speak a short guide line (an audio url the host owns). With wait, later commands queue until it ends. */
  | { type: 'SAY'; url: string; wait?: boolean };
export interface GameViewState {
  lifecycle: GameLifecycleState;
  round: number;
  total: number;
  stars: number;
  feedback:
    'LISTEN' | 'RETRY' | 'CORRECT' | 'HINT' | 'AUDIO_ERROR' | 'NOT_HEARD';
  busy: boolean;
  voice?: {
    status: 'IDLE' | 'REQUESTING' | 'RECORDING' | 'RECOGNIZING';
    failure?: UnrecognizedReason;
  };
  /** Only set once the task is solved, so the answer is never leaked earlier. */
  word?: string;
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
