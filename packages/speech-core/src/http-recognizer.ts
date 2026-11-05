import type {
  ISpeechRecognizer,
  SpeechRecognitionRequest,
  SpeechRecognitionResult,
} from '@english/contracts';
import { SpeechFailure } from './service';

/** The same-origin backend owns provider credentials and codec conversion. */
export class HttpSpeechRecognizer implements ISpeechRecognizer {
  constructor(private readonly endpoint = '/api/speech/recognize') {
    if (
      !endpoint.startsWith('/') ||
      endpoint.startsWith('//') ||
      endpoint.includes('\\')
    )
      throw new Error('Speech endpoint must be a same-origin path');
  }
  async recognize(
    request: SpeechRecognitionRequest,
  ): Promise<SpeechRecognitionResult> {
    const body = new FormData();
    body.set(
      'audio',
      request.audio,
      request.audio.type.includes('mp4') ? 'speech.m4a' : 'speech.webm',
    );
    body.set('language', request.language);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body,
      signal: request.signal,
      credentials: 'same-origin',
      redirect: 'error',
    });
    if (!response.ok) throw new SpeechFailure('SERVICE_ERROR');
    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      !('text' in result) ||
      typeof result.text !== 'string'
    )
      throw new SpeechFailure('SERVICE_ERROR');
    if (
      'confidence' in result &&
      (typeof result.confidence !== 'number' ||
        !Number.isFinite(result.confidence) ||
        result.confidence < 0 ||
        result.confidence > 1)
    )
      throw new SpeechFailure('SERVICE_ERROR');
    return {
      text: result.text,
      ...('confidence' in result
        ? { confidence: result.confidence as number }
        : {}),
    };
  }
}
