#!/usr/bin/env python3
"""Stage only public site assets; do not ship workflow credentials or repository internals."""
import argparse
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[2]


def stage(root, destination):
    root, destination = Path(root).resolve(), Path(destination).resolve()
    if destination == root or root.is_relative_to(destination):
        raise ValueError('The output must not contain the source repository')
    if destination.exists():
        raise ValueError('Choose a new, empty staging directory')
    manifest = json.loads((root / 'apps.json').read_text())
    folders = ['shared']
    for app in manifest['apps']:
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', app['id']) or app['path'] != f'./{app["id"]}/':
            raise ValueError('Invalid app path')
        if not (root / app['id'] / 'index.html').is_file():
            raise ValueError('Missing app entrypoint')
        folders.append(app['id'])
    # Explicit manifest directories retain all app assets, including LA photos.
    files = [p for folder in folders for p in (root / folder).rglob('*') if p.is_file()]
    files += [root / name for name in ('index.html', 'apps.json', '.nojekyll', 'CNAME', 'robots.txt', 'sitemap.xml', 'favicon.ico') if (root / name).is_file()]
    for file in files:
        relative = file.relative_to(root)
        if file.is_symlink() or any(part.startswith('.') for part in relative.parts) and relative.name != '.nojekyll':
            raise ValueError('Hidden files and symlinks must not enter the Pages artifact')
    if sum(p.stat().st_size for p in files) > 100_000_000:
        raise ValueError('Site exceeds the 100 MB artifact budget')
    destination.mkdir(parents=True)
    for file in files:
        target = destination / file.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
    print(f'Staged {len(files)} public files at {destination}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    stage(ROOT, args.destination)
