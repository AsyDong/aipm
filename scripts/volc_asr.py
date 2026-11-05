"""Short in-memory ASR using volcengine-media's credential loader (no secrets copied)."""
import asyncio
import gzip
import importlib.util
from io import BytesIO
import json
import os
from pathlib import Path
import struct
import uuid

import websockets

ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream'
MAX_UPLOAD = 1024 * 1024
MAX_PCM = 176000  # 5.5 seconds, mono 16 kHz signed 16-bit.
FORMATS = {'audio/webm': 'matroska', 'audio/mp4': 'mov', 'audio/mpeg': 'mp3', 'audio/wav': 'wav'}


class AsrFailure(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def credentials():
    skill = Path(os.environ.get('VOLC_MEDIA_SKILL_DIR', Path.home() / '.workbuddy/skills/volcengine-media'))
    try:
        spec = importlib.util.spec_from_file_location('volc_media_common', skill / 'scripts/volc_common.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        keys = module.load_keys()
    except Exception:
        raise AsrFailure('NOT_CONFIGURED') from None
    key = keys.get('DOUBAO_TTS_API_KEY') or keys.get('VOLC_AGENT_KEY')
    if not key:
        raise AsrFailure('NOT_CONFIGURED')
    auth = {'X-Api-App-Key': keys['DOUBAO_APP_ID'], 'X-Api-Access-Key': key} if keys.get('DOUBAO_APP_ID') else {'X-Api-Key': key}
    return {
        **auth,
        'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
        'X-Api-Request-Id': str(uuid.uuid4()),
    }


def request_frame(payload):
    body = gzip.compress(json.dumps(payload).encode('utf-8'))
    return bytes([0x11, 0x10, 0x11, 0]) + struct.pack('>I', len(body)) + body


def audio_frame(audio, sequence, last):
    body = gzip.compress(audio)
    # Audio-only request is type 2, not the full JSON request type 1.
    return bytes([0x11, 0x23 if last else 0x21, 0x01, 0]) + struct.pack('>iI', -sequence if last else sequence, len(body)) + body


def response_frame(data):
    if not isinstance(data, bytes) or len(data) < 8 or data[0] >> 4 != 1:
        raise AsrFailure('INVALID_RESPONSE')
    kind, flags = data[1] >> 4, data[1] & 15
    position = (data[0] & 15) * 4
    if position < 4 or kind not in (9, 15):
        raise AsrFailure('INVALID_RESPONSE')
    if kind == 15:
        # Do not echo provider payloads: they may contain request headers.
        raise AsrFailure('PROVIDER_ERROR')
    if flags & 1:
        position += 4
    if len(data) < position + 4:
        raise AsrFailure('INVALID_RESPONSE')
    size = struct.unpack_from('>I', data, position)[0]
    body = data[position + 4:]
    if size != len(body) or size > MAX_UPLOAD:
        raise AsrFailure('INVALID_RESPONSE')
    try:
        if data[2] & 15 == 1:
            with gzip.GzipFile(fileobj=BytesIO(body)) as compressed:
                body = compressed.read(MAX_UPLOAD + 1)
        if len(body) > MAX_UPLOAD or data[2] >> 4 != 1 or data[2] & 15 not in (0, 1):
            raise ValueError()
        result = json.loads(body)
        if not isinstance(result, dict):
            raise ValueError()
    except (ValueError, OSError, EOFError):
        raise AsrFailure('INVALID_RESPONSE') from None
    return result, bool(flags & 2)


async def pcm_audio(audio, mime):
    kind = FORMATS.get(mime.split(';', 1)[0].strip().lower())
    if not kind or not audio or len(audio) > MAX_UPLOAD:
        raise AsrFailure('INVALID_AUDIO')
    try:
        process = await asyncio.create_subprocess_exec(
            os.environ.get('FFMPEG_PATH', 'ffmpeg'), '-hide_banner', '-loglevel', 'error',
            '-nostdin', '-protocol_whitelist', 'pipe', '-threads', '1', '-f', kind,
            '-i', 'pipe:0', '-t', '6', '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1',
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        )
    except OSError:
        raise AsrFailure('TRANSCODER_UNAVAILABLE') from None
    try:
        pcm, _ = await asyncio.wait_for(process.communicate(audio), 3)
        if process.returncode or not pcm or len(pcm) > MAX_PCM:
            raise AsrFailure('INVALID_AUDIO')
        return pcm
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()


async def recognize_pcm(pcm, headers):
    try:
        async with websockets.connect(ENDPOINT, additional_headers=headers, open_timeout=3, close_timeout=0.5, max_size=MAX_UPLOAD, proxy=None) as ws:
            await ws.send(request_frame({
                'user': {'uid': 'english-adventure'},
                'audio': {'format': 'pcm', 'codec': 'raw', 'rate': 16000, 'bits': 16, 'channel': 1, 'language': 'en-US'},
                'request': {'model_name': 'bigmodel', 'enable_itn': True, 'enable_punc': True},
            }))
            for offset in range(0, len(pcm), 8192):
                # The initial full request already consumed sequence 1.
                await ws.send(audio_frame(pcm[offset:offset + 8192], offset // 8192 + 2, offset + 8192 >= len(pcm)))
            text = None
            async for message in ws:
                result, final = response_frame(message)
                code = result.get('code', 0)
                if code not in (0, 1000, 20000000):
                    raise AsrFailure('PROVIDER_ERROR')
                value = result.get('result', {})
                if isinstance(value, dict) and isinstance(value.get('text'), str):
                    text = value['text']
                if final:
                    if text is None:
                        raise AsrFailure('INVALID_RESPONSE')
                    return {'text': text}
            raise AsrFailure('INVALID_RESPONSE')
    except websockets.exceptions.InvalidStatus as error:
        raise AsrFailure('PROVIDER_AUTH' if error.response.status_code in (401, 403) else 'PROVIDER_ERROR') from None


async def transcribe(audio, mime, language):
    if language not in ('en-GB', 'en-US', 'en'):
        raise AsrFailure('INVALID_LANGUAGE')
    try:
        async with asyncio.timeout(8):
            headers = credentials()
            pcm = await pcm_audio(audio, mime)
            return await recognize_pcm(pcm, headers)
    except TimeoutError:
        raise AsrFailure('TIMEOUT') from None
    except AsrFailure:
        raise
    except Exception:
        raise AsrFailure('SERVICE_ERROR') from None


if __name__ == '__main__':
    import argparse
    import sys
    parser = argparse.ArgumentParser(description='Live ASR check; sends the chosen audio to Volcengine.')
    parser.add_argument('--audio', type=Path, required=True)
    parser.add_argument('--mime', default='audio/mpeg')
    args = parser.parse_args()
    try:
        print(json.dumps(asyncio.run(transcribe(args.audio.read_bytes(), args.mime, 'en-GB'))))
    except (AsrFailure, OSError) as error:
        print(json.dumps({'error': error.code if isinstance(error, AsrFailure) else 'AUDIO_UNAVAILABLE'}))
        sys.exit(1)
