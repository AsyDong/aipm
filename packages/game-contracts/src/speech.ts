export type SpeechErrorCode =
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'NO_SPEECH'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'SERVICE_ERROR';

export interface SpeechRecognitionRequest {
  audio: Blob;
  language: string;
  signal: AbortSignal;
}
export interface SpeechRecognitionResult {
  text: string;
  /** Provider certainty about transcription, never a pronunciation score. */
  confidence?: number;
}
export interface SpeechSynthesisRequest {
  text: string;
  language: string;
  signal: AbortSignal;
}
export interface ISpeechRecognizer {
  recognize(
    request: SpeechRecognitionRequest,
  ): Promise<SpeechRecognitionResult>;
}
export interface ISpeechSynthesizer {
  synthesize(request: SpeechSynthesisRequest): Promise<Blob>;
}
export interface ISpeechService extends ISpeechRecognizer, ISpeechSynthesizer {}

export interface IVoiceRecorder {
  start(signal: AbortSignal): Promise<void>;
  stop(): Promise<Blob>;
  cancel(): void;
}
