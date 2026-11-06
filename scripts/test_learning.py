import copy
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from learning_server import Conflict, Handler, initialize, progress, save


def submission():
    return {'version': '1.0.0', 'session': {
        'sessionId': 's', 'learnerId': 'l', 'gameId': 'g', 'mechanicId': 'tap', 'startedAt': 1},
        'endedAt': 2, 'completed': True, 'records': [{
            'taskId': 't', 'contentId': 'c', 'curriculumId': 'book', 'unitId': 'u',
            'listens': 2, 'hints': 1, 'attempts': 2, 'voiceAttempts': 0, 'recognized': 0,
            'completed': True, 'needsReview': True}]}


class LearningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'learning.sqlite3')
        initialize(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_concurrent_idempotency_and_conflict(self):
        data = submission()
        with ThreadPoolExecutor(4) as pool:
            self.assertEqual(list(pool.map(lambda _: save(self.path, data), range(8))), ['s'] * 8)
        self.assertEqual(progress(self.path, 'l')[0]['attempts'], 2)
        data['records'][0]['listens'] = 3
        with self.assertRaises(Conflict):
            save(self.path, data)
        self.assertEqual(progress(self.path, 'l')[0]['listens'], 2)

    def test_progress_ownership_latest_review_and_database_reopen(self):
        save(self.path, submission())
        data = submission()
        data['session']['sessionId'] = 's2'
        data['session']['startedAt'] = 3
        data['endedAt'] = 4
        data['records'][0].update(hints=0, attempts=1, needsReview=False)
        save(self.path, data)
        initialize(self.path)
        row = progress(self.path, 'l')[0]
        self.assertEqual(row['sessions'], 2)
        self.assertEqual(row['completions'], 2)
        self.assertFalse(row['needsReview'])
        self.assertEqual(progress(self.path, 'other'), [])
        with closing(sqlite3.connect(self.path)) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM learning_record').fetchone()[0], 2)

    def test_invalid_payloads_are_atomic(self):
        variants = []
        for key, value in [('attempts', -1), ('recognized', 1), ('needsReview', False), ('audio', 'private')]:
            data = submission()
            data['records'][0][key] = value
            variants.append(data)
        data = submission()
        data['records'].append(copy.deepcopy(data['records'][0]))
        variants.append(data)
        for data in variants:
            with self.assertRaises(ValueError):
                save(self.path, data)
        self.assertEqual(progress(self.path, 'l'), [])

    def test_http_validation_origin_and_retry(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        server.database = self.path
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            def post(data, origin=None):
                headers = {'Content-Type': 'application/json'}
                if origin:
                    headers['Origin'] = origin
                return urlopen(Request(base + '/api/v1/game-sessions', json.dumps(data).encode(), headers), timeout=5)
            for _ in range(2):
                with post(submission()) as response:
                    self.assertEqual(json.load(response), {'sessionId': 's'})
            with self.assertRaises(HTTPError) as denied:
                post(submission(), 'https://foreign.example')
            self.assertEqual(denied.exception.code, 403)
            with self.assertRaises(HTTPError) as invalid:
                post({'audio': 'forbidden'})
            self.assertEqual(invalid.exception.code, 400)
            with urlopen(base + '/api/v1/learning-progress?learnerId=l', timeout=5) as response:
                self.assertEqual(json.load(response)['progress'][0]['sessions'], 1)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
