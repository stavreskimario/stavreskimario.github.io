#!/usr/bin/env python3
"""Dependency-free delivery checks for the static app collection."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
GENERATED_DIRS = {'.git', 'node_modules', '.next', 'test-results'}

def require(condition, message):
    if not condition:
        raise SystemExit(message)

class LocalLinks(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('src', 'href') or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            require(not url.path.startswith('/'), f'{self.page}: use a relative URL: {value}')
            target = (self.page.parent / unquote(url.path)).resolve()
            require(target.is_relative_to(ROOT), f'{self.page}: link escapes site: {value}')
            require(target.exists(), f'{self.page}: missing target: {value}')
            if target.is_dir():
                require((target/'index.html').is_file(), f'{target}: missing index.html')

def validate():
    manifest = json.loads((ROOT/'apps.json').read_text())
    require(manifest.get('version') == 1 and isinstance(manifest.get('apps'), list), 'Expected manifest version 1 and apps array')
    ids = set()
    for app in manifest['apps']:
        slug = app.get('id', '')
        require(isinstance(slug, str) and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug), f'Invalid app id: {slug}')
        require(slug not in ids, f'Duplicate app id: {slug}')
        ids.add(slug)
        require(app.get('path') == f'./apps/{slug}/', f'{slug}: path must be ./apps/{slug}/')
        require((ROOT/'apps'/slug/'index.html').is_file(), f'{slug}: missing app index.html')
        for key in ('name','description','category'):
            require(isinstance(app.get(key), str) and app[key].strip(), f'{slug}: missing {key}')
        if app.get('image'):
            image = app['image']
            require(isinstance(image,str) and re.fullmatch(r'\./[a-z0-9][a-z0-9/_.-]*',image) and '..' not in image.split('/'), f'{slug}: invalid image path')
            require((ROOT/image).is_file(), f'{slug}: missing preview image')
            require(isinstance(app.get('imageAlt'),str) and app['imageAlt'].strip(), f'{slug}: add imageAlt')
    for page in ROOT.rglob('*.html'):
        if not GENERATED_DIRS.intersection(page.relative_to(ROOT).parts):
            LocalLinks(page).feed(page.read_text())
    for script in ROOT.rglob('*.js'):
        if not GENERATED_DIRS.intersection(script.relative_to(ROOT).parts):
            subprocess.run(['node','--check',str(script)],check=True)
    require((ROOT/'.nojekyll').exists(), 'Keep .nojekyll for static Pages publishing')
    print(f'Validated {len(ids)} apps: manifest, entrypoints, relative HTML links/assets and JavaScript syntax.')

if __name__ == '__main__':
    validate()
