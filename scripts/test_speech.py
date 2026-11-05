"""Offline checks; never opens a cloud connection or reads local credentials."""
import asyncio
import gzip
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import socket
import struct
import subprocess
import threading
import unittest
from unittest.mock import AsyncMock, patch
import urllib.error
import urllib.request

import speech_server
from volc_asr import AsrFailure, MAX_UPLOAD, audio_frame, credentials, pcm_audio, recognize_pcm, request_frame, response_frame, transcribe


def multipart(audio=b'encoded', mime='audio/webm'):
    return (b'--test\r\nContent-Disposition: form-data; name="audio"; filename="voice"\r\n'
            + f'Content-Type: {mime}\r\n\r\n'.encode() + audio
            + b'\r\n--test\r\nContent-Disposition: form-data; name="language"\r\n\r\nen-GB\r\n--test--\r\n')


class ProtocolTests(unittest.TestCase):
    def test_credentials_support_new_api_key_and_legacy_app_id_without_reading_secrets(self):
        with patch('volc_asr.importlib.util.spec_from_file_location'), patch('volc_asr.importlib.util.module_from_spec') as module:
            module.return_value.load_keys.return_value = {'VOLC_AGENT_KEY': 'test-token'}
            headers = credentials()
            self.assertEqual(headers['X-Api-Key'], 'test-token')
            self.assertNotIn('X-Api-App-Key', headers)
            module.return_value.load_keys.return_value = {'DOUBAO_APP_ID': 'test-app', 'DOUBAO_TTS_API_KEY': 'test-speech-token', 'VOLC_AGENT_KEY': 'test-token'}
            headers = credentials()
            self.assertEqual(headers['X-Api-App-Key'], 'test-app')
            self.assertEqual(headers['X-Api-Access-Key'], 'test-speech-token')
            self.assertNotIn('X-Api-Key', headers)

    def test_request_and_audio_use_distinct_types_and_negative_final_sequence(self):
        request = request_frame({'audio': {'format': 'pcm'}})
        self.assertEqual(request[:4], bytes([0x11, 0x10, 0x11, 0]))
        self.assertEqual(json.loads(gzip.decompress(request[8:])), {'audio': {'format': 'pcm'}})
        audio = audio_frame(b'pcm', 2, True)
        self.assertEqual(audio[:4], bytes([0x11, 0x23, 0x01, 0]))
        self.assertEqual(struct.unpack_from('>i', audio, 4)[0], -2)
        self.assertEqual(gzip.decompress(audio[12:]), b'pcm')

    def test_response_checks_terminal_flag_compression_and_lengths(self):
        payload = gzip.compress(json.dumps({'result': {'text': 'hello'}}).encode())
        frame = bytes([0x11, 0x93, 0x11, 0]) + struct.pack('>iI', -1, len(payload)) + payload
        self.assertEqual(response_frame(frame), ({'result': {'text': 'hello'}}, True))
        for malformed in (b'', frame[:7], frame[:-1], bytes([0x11, 0xf0, 0x10, 0]) + b'secret data'):
            with self.subTest(frame=malformed[:4]):
                with self.assertRaises(AsrFailure) as error:
                    response_frame(malformed)
                self.assertNotIn('secret', str(error.exception))

    def test_multipart_keeps_format_and_rejects_unexpected_or_duplicate_fields(self):
        content_type = 'multipart/form-data; boundary=test'
        self.assertEqual(speech_server.parse_upload(content_type, multipart()), (b'encoded', 'audio/webm', 'en-GB'))
        for bad in (multipart().replace(b'name="language"', b'name="audio"'), multipart().replace(b'name="language"', b'name="answer"'), b'broken'):
            with self.assertRaises(AsrFailure):
                speech_server.parse_upload(content_type, bad)


class AudioTests(unittest.IsolatedAsyncioTestCase):
    async def test_provider_result_does_not_invent_confidence_or_send_an_answer(self):
        payload = gzip.compress(json.dumps({'result': {'text': 'Hello.'}}).encode())
        final = bytes([0x11, 0x93, 0x11, 0]) + struct.pack('>iI', -1, len(payload)) + payload
        ws = AsyncMock()
        ws.__aiter__.return_value = [final]
        connection = AsyncMock()
        connection.__aenter__.return_value = ws
        with patch('volc_asr.websockets.connect', return_value=connection):
            self.assertEqual(await recognize_pcm(b'pcm', {'test': 'header'}), {'text': 'Hello.'})
        config = json.loads(gzip.decompress(ws.send.await_args_list[0].args[0][8:]))
        self.assertEqual(set(config), {'user', 'audio', 'request'})
        self.assertEqual(config['audio']['rate'], 16000)
        self.assertEqual(ws.send.await_args_list[1].args[0][1], 0x23)
        self.assertEqual(struct.unpack_from('>i', ws.send.await_args_list[1].args[0], 4)[0], -2)

    async def test_missing_configuration_fails_before_conversion_or_cloud_use(self):
        with patch('volc_asr.credentials', side_effect=AsrFailure('NOT_CONFIGURED')), patch('volc_asr.pcm_audio', new=AsyncMock()) as convert:
            with self.assertRaises(AsrFailure) as error:
                await transcribe(b'voice', 'audio/mp4', 'en-GB')
            self.assertEqual(error.exception.code, 'NOT_CONFIGURED')
            convert.assert_not_called()

    async def test_transcodes_actual_webm_and_mp4_without_files(self):
        prompt = (Path(__file__).resolve().parents[1] / 'apps/web/public/audio/apple.mp3').read_bytes()
        for mime, options in (
            ('audio/webm', ['-c:a', 'libopus', '-f', 'webm']),
            ('audio/mp4', ['-c:a', 'aac', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4']),
        ):
            with self.subTest(mime=mime):
                encoded = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', *options, 'pipe:1'], input=prompt, capture_output=True, check=True, timeout=5).stdout
                pcm = await pcm_audio(encoded, mime)
                self.assertGreater(len(pcm), 3200)
                self.assertEqual(len(pcm) % 2, 0)

    async def test_rejects_invalid_format_bytes_and_excessive_duration(self):
        for audio, mime in ((b'x', 'text/plain'), (b'x', 'audio/webm'), (b'', 'audio/mp4'), (b'x' * (MAX_UPLOAD + 1), 'audio/webm')):
            with self.assertRaises(AsrFailure):
                await pcm_audio(audio, mime)
        wav = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '6', '-f', 'wav', 'pipe:1'], capture_output=True, check=True, timeout=5).stdout
        with self.assertRaises(AsrFailure):
            await pcm_audio(wav, 'audio/wav')

    async def test_client_disconnect_cancels_provider_work(self):
        connection, client = socket.socketpair()
        cancelled = asyncio.Event()
        async def pending():
            try:
                await asyncio.Future()
            finally:
                cancelled.set()
        try:
            operation = asyncio.create_task(speech_server.while_connected(connection, pending()))
            await asyncio.sleep(0)
            client.close()
            with self.assertRaises(ConnectionError):
                await operation
            self.assertTrue(cancelled.is_set())
        finally:
            connection.close()
            client.close()


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.mock = patch('speech_server.transcribe', new=AsyncMock(return_value={'text': 'hello'}))
        self.transcribe = self.mock.start()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), speech_server.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}'
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.mock.stop()

    def request(self, body=None, headers=None):
        req = urllib.request.Request(self.url + '/api/speech/recognize', data=multipart() if body is None else body, headers={'Content-Type': 'multipart/form-data; boundary=test', **(headers or {})})
        return self.opener.open(req, timeout=3)

    def test_accepts_same_origin_upload_and_returns_no_store_json(self):
        with self.request(headers={'Origin': self.url}) as response:
            self.assertEqual(json.load(response), {'text': 'hello'})
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.transcribe.assert_awaited_once_with(b'encoded', 'audio/webm', 'en-GB')

    def test_rejects_cross_origin_oversize_and_busy_before_calling_provider(self):
        for body, headers, status in ((None, {'Origin': 'https://other.example'}, 403), (b'x', {'Content-Length': str(MAX_UPLOAD + 8193)}, 413)):
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request(body, headers)
            self.assertEqual(error.exception.code, status)
        with patch('speech_server.SLOTS', threading.BoundedSemaphore(0)):
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request()
            self.assertEqual(error.exception.code, 429)
        self.transcribe.assert_not_called()

    def test_timeouts_and_unexpected_failures_do_not_echo_details(self):
        for failure, status, code in ((AsrFailure('TIMEOUT'), 504, 'TIMEOUT'), (RuntimeError('private upstream detail'), 503, 'SERVICE_ERROR')):
            self.transcribe.side_effect = failure
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request()
            self.assertEqual(error.exception.code, status)
            self.assertEqual(json.load(error.exception), {'error': code})


if __name__ == '__main__':
    unittest.main()
