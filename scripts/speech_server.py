"""Loopback-only speech API. Put behind the same-origin web proxy; never serves secrets."""
import argparse
import asyncio
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import select
import socket
import threading
from urllib.parse import urlsplit

from volc_asr import AsrFailure, MAX_UPLOAD, transcribe

SLOTS = threading.BoundedSemaphore(2)


def parse_upload(content_type, body):
    if not content_type.lower().startswith('multipart/form-data;'):
        raise AsrFailure('INVALID_AUDIO')
    message = BytesParser(policy=default).parsebytes(
        f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode() + body)
    if not message.is_multipart() or message.defects:
        raise AsrFailure('INVALID_AUDIO')
    fields = {}
    for part in message.iter_parts():
        name = part.get_param('name', header='content-disposition')
        if name not in ('audio', 'language') or name in fields or part.is_multipart() or part.defects:
            raise AsrFailure('INVALID_AUDIO')
        fields[name] = part
    if set(fields) != {'audio', 'language'}:
        raise AsrFailure('INVALID_AUDIO')
    try:
        return (fields['audio'].get_payload(decode=True), fields['audio'].get_content_type(),
                fields['language'].get_payload(decode=True).decode('utf-8'))
    except (ValueError, UnicodeError, AttributeError):
        raise AsrFailure('INVALID_AUDIO') from None


async def while_connected(connection, work):
    task = asyncio.create_task(work)
    try:
        while not task.done():
            await asyncio.sleep(0.05)
            if select.select([connection], [], [], 0)[0] and not connection.recv(1, socket.MSG_PEEK):
                raise ConnectionError('Client disconnected')
        return await task
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(3)

    def handle(self):
        try:
            super().handle()
        except OSError:
            pass

    # No request bodies, transcripts, credentials or raw provider failures in logs.
    def log_message(self, *_args):
        pass

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        self.connection.settimeout(3)
        if self.path != '/api/speech/recognize':
            self.reply(404, {'error': 'NOT_FOUND'})
            return
        host = self.headers.get('Host', '')
        allowed = os.environ.get('SPEECH_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')
        origin = self.headers.get('Origin')
        try:
            valid_host = urlsplit('http://' + host).hostname in allowed
            valid_origin = not origin or urlsplit(origin).netloc == host
        except ValueError:
            valid_host = valid_origin = False
        if not valid_host or not valid_origin:
            self.reply(403, {'error': 'ORIGIN_DENIED'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if self.headers.get('Transfer-Encoding') or not 0 < length <= MAX_UPLOAD + 8192:
            self.reply(413, {'error': 'UPLOAD_LIMIT'})
            return
        if not SLOTS.acquire(blocking=False):
            self.reply(429, {'error': 'BUSY'})
            return
        try:
            body = self.rfile.read(length)
            if len(body) != length:
                raise AsrFailure('INVALID_AUDIO')
            audio, mime, language = parse_upload(self.headers.get('Content-Type', ''), body)
            result = asyncio.run(while_connected(self.connection, transcribe(audio, mime, language)))
            self.reply(200, result)
        except AsrFailure as error:
            status = 400 if error.code.startswith('INVALID_') else 504 if error.code == 'TIMEOUT' else 503
            self.reply(status, {'error': error.code})
        except (OSError, ConnectionError):
            pass
        except Exception:
            self.reply(503, {'error': 'SERVICE_ERROR'})
        finally:
            SLOTS.release()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8787)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Speech API on http://127.0.0.1:{server.server_port} (loopback only)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
