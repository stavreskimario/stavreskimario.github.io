"""Offline checks for retained whole-site staging and optional publishing."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('site_stage', ROOT / 'scripts/site-publishing/stage.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


def sample_site(root):
    (root / 'shared').mkdir()
    (root / 'shared/theme.css').write_text('body {}')
    (root / 'hello-world').mkdir()
    (root / 'hello-world/index.html').write_text('<h1>Hello</h1>')
    (root / 'index.html').write_text('<h1>Apps</h1>')
    (root / '.nojekyll').touch()
    (root / 'apps.json').write_text(json.dumps({'version': 1, 'apps': [
        {'id': 'hello-world', 'path': './hello-world/'}]}))


class SiteStagingTests(unittest.TestCase):
    def test_complete_site_keeps_registered_apps_and_assets(self):
        with tempfile.TemporaryDirectory() as td:
            output = Path(td) / 'pages'
            stage.stage(ROOT, output)
            self.assertTrue((output / '.nojekyll').exists())
            manifest = json.loads((output / 'apps.json').read_text())
            for app in manifest['apps']:
                self.assertTrue((output / app['id'] / 'index.html').exists())
            for relative in ['la-trip/assets/la-skyline.jpg', 'penn-station-1935/dist/app.js']:
                source = (ROOT / relative).read_bytes()
                self.assertEqual(hashlib.sha256(source).digest(),
                                 hashlib.sha256((output / relative).read_bytes()).digest())
            for excluded in ['.git', '.github', 'scripts', 'tests', 'authoring',
                             'engineering-journal', 'crystal-palace']:
                self.assertFalse((output / excluded).exists(), excluded)

    def test_source_containing_and_existing_destinations_are_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            parent = Path(td)
            root = parent / 'site'
            root.mkdir()
            sample_site(root)
            for destination in [root, parent, root / 'shared']:
                with self.subTest(destination=destination), self.assertRaises(ValueError):
                    stage.stage(root, destination)

    def test_manifest_traversal_and_missing_entrypoint_are_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / 'site'
            root.mkdir()
            sample_site(root)
            for app in [{'id': 'hello-world', 'path': '../hello-world/'},
                        {'id': '../outside', 'path': './../outside/'},
                        {'id': 'missing', 'path': './missing/'}]:
                (root / 'apps.json').write_text(json.dumps({'apps': [app]}))
                with self.subTest(app=app), self.assertRaises(ValueError):
                    stage.stage(root, Path(td) / 'pages')

    def test_hidden_app_files_and_symlinks_are_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / 'site'
            root.mkdir()
            sample_site(root)
            hidden = root / 'hello-world/.private'
            hidden.write_text('must not ship')
            with self.assertRaisesRegex(ValueError, 'Hidden files and symlinks'):
                stage.stage(root, Path(td) / 'pages')
            hidden.unlink()
            (root / 'hello-world/linked.html').symlink_to(root / 'index.html')
            with self.assertRaisesRegex(ValueError, 'Hidden files and symlinks'):
                stage.stage(root, Path(td) / 'pages')

    def test_budget_failure_does_not_create_an_artifact(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / 'site'
            root.mkdir()
            sample_site(root)
            output = Path(td) / 'pages'
            with patch.object(stage, 'MAX_PUBLIC_SITE_BYTES', 1):
                with self.assertRaisesRegex(ValueError, 'public artifact budget'):
                    stage.stage(root, output)
            self.assertFalse(output.exists())

    def test_optional_publisher_has_no_collection_or_schedule(self):
        workflow = (ROOT / '.github/workflows/site-pages.yml').read_text()
        self.assertNotIn('schedule:', workflow)
        self.assertNotIn('collect.py', workflow)
        self.assertNotIn('previous-url', workflow)
        self.assertIn("github.ref == 'refs/heads/main' && vars.PAGES_ACTIONS_ENABLED == 'true'", workflow)
        self.assertIn('scripts/site-publishing/stage.py', workflow)
        self.assertIn('group: pages-production', workflow)
        self.assertIn('persist-credentials: false', workflow)
        self.assertIn('test "$current" = "$BUILT_SHA"', workflow)


if __name__ == '__main__':
    unittest.main()
