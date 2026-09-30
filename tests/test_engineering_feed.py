"""Offline regression checks for publisher parsing, archive safety and Pages staging."""
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts/engineering-feed' / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


feed = module('feed', 'collect.py')
stage = module('stage', 'stage.py')
SOURCES = json.loads(feed.REGISTRY.read_text())['sources']
BY_ID = {s['id']: s for s in SOURCES}
NOW = datetime(2026, 9, 30, tzinfo=timezone.utc)


def article(source='uber', slug='scaling-databases'):
    s = BY_ID[source]
    return feed.normalise({'title': 'Scaling databases safely', 'url': f'https://{s["hosts"][0]}/' + ('us/en/blog/' if source == 'uber' else 'index/') + slug + '/', 'publishedAt': '2026-09-25'}, s, NOW)


def previous():
    return {'version': 1, 'seed': True, 'generatedAt': feed.iso(NOW), 'lastPollAt': None,
            'sources': [{'id': s['id'], 'status': 'pending'} for s in SOURCES], 'articles': [article()]}


class CollectionTests(unittest.TestCase):
    def test_rss_atom_and_markup(self):
        rss = '''<rss><channel><item><title>Scaling &amp; safety</title><link>https://www.uber.com/us/en/blog/scale/?utm_source=rss</link><pubDate>Tue, 29 Sep 2026 06:00:00 GMT</pubDate><description><![CDATA[<!DOCTYPE html><p>Fast <b>systems</b></p><script>bad()</script>]]></description></item></channel></rss>'''
        parsed = feed.normalise(feed.parse_feed(rss, BY_ID['uber'])[0], BY_ID['uber'], NOW)
        self.assertEqual(parsed['title'], 'Scaling & safety')
        self.assertEqual(parsed['excerpt'], 'Fast systems')
        self.assertNotIn('utm_', parsed['url'])
        atom = '''<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Agent research</title><link href="https://openai.com/index/research/"/><updated>2026-09-29T00:00:00Z</updated><category term="AI"/></entry></feed>'''
        parsed = feed.normalise(feed.parse_feed(atom, BY_ID['openai'])[0], BY_ID['openai'], NOW)
        self.assertIsNone(parsed['publishedAt'], 'An updated timestamp is not a publication date')
        self.assertEqual(parsed['updatedAt'], '2026-09-29T00:00:00Z')
        with self.assertRaises(ValueError):
            feed.parse_feed('<!DOCTYPE x [<!ENTITY a "expand">]><rss/>', BY_ID['uber'])

    def test_publisher_card_titles_and_navigation(self):
        # Minimal structural fixtures from the official index layouts; no article bodies.
        cases = [
            ('uber', '<nav><a href="/us/en/blog/higher-education/">Higher Education</a></nav><article><h3><a href="/us/en/blog/scaling/">Scaling the service mesh</a></h3><time datetime="2026-09-15">September 15, 2026</time></article>', 'Scaling the service mesh'),
            ('openai', '<a href="/index/scaling/"><div class="mb-4 text-h5">Scaling AI storage</div><p>Engineering <time datetime="2026-09-11T10:00">Sep 11, 2026</time></p></a>', 'Scaling AI storage'),
            ('cursor', '<a href="/blog/builds"><div>product <time datetime="2026-09-12">Sep 12, 2026</time></div><p class="type-base text-theme-text text-pretty">Agents start faster</p><div>Someone · 4m</div></a>', 'Agents start faster'),
            ('together', '<a href="/blog/inference" class="latest-item"><div>Inference</div><p class="h5">Faster inference systems</p><p class="body-s">A description and a byline</p></a>', 'Faster inference systems'),
        ]
        for sid, html, title in cases:
            with self.subTest(source=sid):
                records = feed.parse_index(html, BY_ID[sid])
                self.assertEqual(len(records), 1)
                self.assertEqual(records[0]['title'], title)
        with self.assertRaises(ValueError):
            feed.parse_index('<a href="/us/en/blog/riding/">Go riding with us</a>', BY_ID['uber'])

    def test_link_and_content_boundaries(self):
        for url in ['javascript:alert(1)', 'http://www.uber.com/us/en/blog/a/', 'https://www.uber.com.evil.test/a', 'https://user:pass@www.uber.com/us/en/blog/a/', 'https://www.uber.com:444/us/en/blog/a/']:
            self.assertIsNone(feed.safe_url(url, BY_ID['uber']))
        req = feed.urllib.request.Request('https://www.uber.com/us/en/blog/engineering/')
        with self.assertRaises(ValueError):
            feed.SafeRedirect(BY_ID['uber']).redirect_request(req, None, 302, '', {}, 'https://evil.test/')
        raw = {'url': 'https://openai.com/index/news/', 'title': 'Announcing a Series F funding round'}
        self.assertIsNone(feed.normalise(raw, BY_ID['openai'], NOW))
        raw.update(title='Building agent systems', publishedAt='2099-01-01')
        self.assertIsNone(feed.normalise(raw, BY_ID['openai'], NOW))

    def test_gzip_and_size_limit(self):
        class Response(io.BytesIO):
            headers = {}
            def geturl(self): return BY_ID['uber']['homepage']
        response = Response(gzip.compress(b'<html>hello</html>'))
        with patch.object(feed.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            self.assertEqual(feed.fetch(BY_ID['uber']['homepage'], BY_ID['uber'])[0], '<html>hello</html>')
        response = Response(gzip.compress(b'x' * (feed.MAX_BYTES + 1)))
        with patch.object(feed.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            with self.assertRaises(ValueError): feed.fetch(BY_ID['uber']['homepage'], BY_ID['uber'])

    def test_failure_retains_archive_and_deduplicates(self):
        old = previous()
        with patch.object(feed, 'fetch', side_effect=OSError('temporarily offline')):
            records, status = feed.collect_source(BY_ID['uber'], {'lastSuccessAt': '2026-09-29T00:00:00Z'}, NOW)
        self.assertEqual(status['status'], 'error')
        self.assertEqual(status['lastSuccessAt'], '2026-09-29T00:00:00Z')
        results = {s['id']: (None, {'status':'ok'}) for s in SOURCES}
        results['uber'] = (records, status)
        self.assertEqual(feed.merge_catalogue(old, SOURCES, results, NOW)['articles'], old['articles'])
        edited = article(); edited['title'] = 'Scaling databases safely, revised'; edited['firstSeenAt'] = feed.iso(NOW)
        old['articles'][0]['firstSeenAt'] = '2026-09-25T00:00:00Z'
        results['uber'] = ([edited, edited], {'status':'ok'})
        merged = feed.merge_catalogue(old, SOURCES, results, NOW)
        self.assertEqual(len(merged['articles']), 1)
        self.assertEqual(merged['articles'][0]['firstSeenAt'], '2026-09-25T00:00:00Z')

    def test_recovery_failure_never_replaces_a_live_archive(self):
        with tempfile.TemporaryDirectory() as td:
            file = Path(td) / 'catalogue.json'; original = json.dumps(previous()); file.write_text(original)
            argv = ['collect', '--output', str(file), '--previous-url', 'https://stavreskimario.github.io/engineering-journal/data/catalogue.json', '--reuse-only']
            with patch('sys.argv', argv), patch.object(feed, 'recover', side_effect=OSError('offline')):
                with self.assertRaises(OSError): feed.main()
            self.assertEqual(file.read_text(), original)
            with patch('sys.argv', argv), patch.object(feed, 'recover', side_effect=urllib.error.HTTPError('',404,'Not found',{},None)):
                feed.main()
            self.assertEqual(json.loads(file.read_text()), previous())
            with patch('sys.argv', argv[:-1]), patch.object(feed, 'recover', return_value=previous()), patch.object(feed, 'collect_source', return_value=([], {'status':'error'})):
                with self.assertRaises(SystemExit): feed.main()
            self.assertEqual(json.loads(file.read_text()), previous())

    def test_schema_and_retention(self):
        bad = previous(); bad['articles'][0]['url'] = 'https://evil.test/'
        with self.assertRaises(ValueError): feed.validate_catalogue(bad, SOURCES)
        old = previous(); old['articles'][0]['publishedAt'] = '2025-01-01'
        results = {s['id']: (None, {'status':'ok'}) for s in SOURCES}
        self.assertEqual(feed.merge_catalogue(old,SOURCES,results,NOW)['articles'], [])

    def test_melbourne_daily_schedule_across_dst(self):
        zone = ZoneInfo('Australia/Melbourne')
        for date, hour in [('2026-07-01',20), ('2026-12-01',19), ('2026-10-04',19), ('2026-04-05',20)]:
            local = datetime.fromisoformat(date + 'T06:00:00').replace(tzinfo=zone)
            self.assertEqual(local.astimezone(timezone.utc).hour, hour)
        workflow = (ROOT / '.github/workflows/engineering-journal-pages.yml').read_text()
        self.assertIn("cron: '0 6 * * *'", workflow)
        self.assertIn('timezone: Australia/Melbourne', workflow)

    def test_staging_preserves_apps_excludes_repository(self):
        with tempfile.TemporaryDirectory() as td:
            output = Path(td) / 'pages'; stage.stage(ROOT, output)
            self.assertTrue((output/'.nojekyll').exists())
            for app in json.loads((ROOT/'apps.json').read_text())['apps']:
                self.assertTrue((output/app['id']/'index.html').exists())
            self.assertTrue((output/'la-trip/assets/la-skyline.jpg').exists())
            self.assertTrue((output/'engineering-journal/data/catalogue.json').exists())
            self.assertFalse((output/'.git').exists())
            self.assertFalse((output/'scripts').exists())
            self.assertFalse((output/'.github').exists())


if __name__ == '__main__': unittest.main()
