"""Local single-profile learning API. No audio, transcript or pointer data accepted."""
import argparse
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import sqlite3
from urllib.parse import parse_qs, urlsplit

MAX_BODY = 262144
ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$')
COUNTS = ('listens', 'hints', 'attempts', 'voiceAttempts', 'recognized')
RECORD_KEYS = {'taskId', 'contentId', 'curriculumId', 'unitId', *COUNTS,
               'completed', 'needsReview'}


def identifier(value):
    return isinstance(value, str) and bool(ID.fullmatch(value))


def number(value, maximum):
    return type(value) is int and 0 <= value <= maximum


def validate(data):
    if not isinstance(data, dict) or set(data) != {'version', 'session', 'endedAt', 'completed', 'records'}:
        raise ValueError('Invalid submission')
    session = data['session']
    if (data['version'] != '1.0.0' or not isinstance(session, dict)
            or set(session) != {'sessionId', 'learnerId', 'gameId', 'mechanicId', 'startedAt'}
            or not all(identifier(session[k]) for k in ('sessionId', 'learnerId', 'gameId', 'mechanicId'))
            or not number(session['startedAt'], 10**14)
            or not number(data['endedAt'], 10**14)
            or data['endedAt'] < session['startedAt']
            or type(data['completed']) is not bool
            or not isinstance(data['records'], list) or not 0 <= len(data['records']) <= 1000):
        raise ValueError('Invalid session')
    tasks = set()
    for record in data['records']:
        if (not isinstance(record, dict) or set(record) != RECORD_KEYS
                or not all(identifier(record[k]) for k in ('taskId', 'contentId', 'curriculumId', 'unitId'))
                or not all(number(record[k], 100000) for k in COUNTS)
                or type(record['completed']) is not bool or type(record['needsReview']) is not bool
                or record['taskId'] in tasks
                or record['recognized'] > record['voiceAttempts']
                or (record['completed'] and record['attempts'] == 0)
                or record['needsReview'] != (not record['completed'] or record['hints'] > 0 or record['attempts'] > 1)):
            raise ValueError('Invalid record')
        tasks.add(record['taskId'])
    if data['completed'] and (not tasks or not all(r['completed'] for r in data['records'])):
        raise ValueError('Invalid completion')
    return data


@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=5)
    db.execute('PRAGMA foreign_keys=ON')
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize(path):
    with connect(path) as db:
        db.executescript('''
          CREATE TABLE IF NOT EXISTS game_session (
            session_id TEXT PRIMARY KEY, learner_id TEXT NOT NULL,
            game_id TEXT NOT NULL, started_at INTEGER NOT NULL,
            ended_at INTEGER NOT NULL, body TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS session_learner ON game_session(learner_id);
          CREATE TABLE IF NOT EXISTS learning_record (
            session_id TEXT NOT NULL REFERENCES game_session(session_id),
            task_id TEXT NOT NULL, content_id TEXT NOT NULL,
            curriculum_id TEXT NOT NULL, unit_id TEXT NOT NULL,
            listens INTEGER NOT NULL, hints INTEGER NOT NULL, attempts INTEGER NOT NULL,
            voice_attempts INTEGER NOT NULL, recognized INTEGER NOT NULL,
            completed INTEGER NOT NULL, needs_review INTEGER NOT NULL,
            PRIMARY KEY(session_id, task_id));
        ''')


class Conflict(Exception):
    pass


def save(path, raw):
    data = validate(raw)
    session = data['session']
    body = json.dumps(data, sort_keys=True, separators=(',', ':'))
    with connect(path) as db:
        # Serialize duplicate checks and inserts, including concurrent retries.
        db.execute('BEGIN IMMEDIATE')
        existing = db.execute('SELECT body FROM game_session WHERE session_id=?',
                              (session['sessionId'],)).fetchone()
        if existing:
            if existing[0] != body:
                raise Conflict()
            return session['sessionId']
        db.execute('INSERT INTO game_session VALUES(?,?,?,?,?,?)',
                   (session['sessionId'], session['learnerId'], session['gameId'],
                    session['startedAt'], data['endedAt'], body))
        db.executemany('INSERT INTO learning_record VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [
            (session['sessionId'], r['taskId'], r['contentId'], r['curriculumId'], r['unitId'],
             *(r[k] for k in COUNTS), r['completed'], r['needsReview']) for r in data['records']])
    return session['sessionId']


def progress(path, learner):
    if not identifier(learner):
        raise ValueError('Invalid learner')
    with connect(path) as db:
        rows = db.execute('''
          WITH owned AS (
            SELECT r.*, s.ended_at, ROW_NUMBER() OVER (
              PARTITION BY r.content_id, r.curriculum_id, r.unit_id
              ORDER BY s.ended_at DESC, s.started_at DESC, s.session_id DESC, r.rowid DESC
            ) AS recent
            FROM learning_record r JOIN game_session s USING(session_id)
            WHERE s.learner_id=?
          )
          SELECT content_id, curriculum_id, unit_id, COUNT(DISTINCT session_id),
            SUM(completed), SUM(listens), SUM(hints), SUM(attempts),
            SUM(voice_attempts), SUM(recognized), MAX(ended_at),
            MAX(CASE WHEN recent=1 THEN needs_review END)
          FROM owned GROUP BY content_id, curriculum_id, unit_id
          ORDER BY curriculum_id, unit_id, content_id LIMIT 5000
        ''', (learner,)).fetchall()
        result = []
        keys = ('contentId', 'curriculumId', 'unitId', 'sessions', 'completions', *COUNTS, 'lastPracticedAt')
        for row in rows:
            item = dict(zip(keys, row[:-1]))
            item['needsReview'] = bool(row[-1])
            result.append(item)
        return result


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *_args):
        pass

    def reply(self, status, body):
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(encoded)

    def allowed(self):
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        try:
            return (urlsplit('http://' + host).hostname in
                    os.environ.get('LEARNING_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')
                    and (not origin or urlsplit(origin).netloc == host))
        except ValueError:
            return False

    def do_POST(self):
        if not self.allowed():
            self.reply(403, {'error': 'ORIGIN_DENIED'})
            return
        if self.path != '/api/v1/game-sessions':
            self.reply(404, {'error': 'NOT_FOUND'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if self.headers.get('Transfer-Encoding') or not 0 < length <= MAX_BODY:
                self.reply(413, {'error': 'BODY_LIMIT'})
                return
            if self.headers.get_content_type() != 'application/json':
                raise ValueError('Content type')
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError('Truncated body')
            session = save(self.server.database, json.loads(raw))
            self.reply(200, {'sessionId': session})
        except Conflict:
            self.reply(409, {'error': 'SESSION_CONFLICT'})
        except (ValueError, UnicodeError, RecursionError):
            self.reply(400, {'error': 'INVALID_SUBMISSION'})
        except sqlite3.Error:
            self.reply(503, {'error': 'STORAGE_UNAVAILABLE'})
        except OSError:
            pass

    def do_GET(self):
        if not self.allowed():
            self.reply(403, {'error': 'ORIGIN_DENIED'})
            return
        url = urlsplit(self.path)
        if url.path != '/api/v1/learning-progress':
            self.reply(404, {'error': 'NOT_FOUND'})
            return
        try:
            query = parse_qs(url.query)
            if set(query) != {'learnerId'} or len(query['learnerId']) != 1:
                raise ValueError('Invalid query')
            self.reply(200, {'progress': progress(self.server.database, query['learnerId'][0])})
        except ValueError:
            self.reply(400, {'error': 'INVALID_QUERY'})
        except sqlite3.Error:
            self.reply(503, {'error': 'STORAGE_UNAVAILABLE'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8788)
    parser.add_argument('--database', default=str(Path.home() / '.english-adventure' / 'learning.sqlite3'))
    args = parser.parse_args()
    path = Path(args.database).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    initialize(path)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.database = str(path)
    print(f'Learning API: http://127.0.0.1:{args.port} (local profile only)', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
