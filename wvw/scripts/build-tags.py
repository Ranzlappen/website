#!/usr/bin/env python3
"""Build the commander / catmander tag icons for the WvW Hub raid editor.

Run from the repo root (needs Pillow + network access to the GW2 wiki):

    python3 -I wvw/scripts/build-tags.py

Outputs (committed — the browser never contacts the wiki, same privacy-first
rule as the map images and the blog's local favicons):

    wvw/public/tags/{commander,catmander}-{color}.webp   36 px tall, transparent

The source images are the in-game tag icons as published on the official
Guild Wars 2 wiki ("Commander tag (blue).png", "Catmander tag (blue).png", …).
Guild Wars 2 assets © ArenaNet, used under ArenaNet's content terms for
non-commercial fan sites. Re-run if ArenaNet adds a colour; the colour list
must match TAG_COLORS in wvw/src/shared/constants.ts.
"""
import io
import json
import os
import sys
import urllib.parse
import urllib.request

from PIL import Image

WIKI_API = 'https://wiki.guildwars2.com/api.php'
COLORS = ['blue', 'cyan', 'green', 'magenta', 'orange', 'purple', 'red', 'white', 'yellow']
KINDS = {'commander': 'Commander', 'catmander': 'Catmander'}
HEIGHT = 36  # rendered at ≤ 24 px; 36 keeps it crisp on 1.5× screens
UA = 'wvw-hub-asset-builder/1.0 (non-commercial fan site)'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'tags')


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def image_url(title: str) -> str:
    q = urllib.parse.urlencode({
        'action': 'query', 'titles': f'File:{title}', 'prop': 'imageinfo',
        'iiprop': 'url', 'format': 'json',
    })
    pages = json.loads(get(f'{WIKI_API}?{q}'))['query']['pages']
    info = next(iter(pages.values())).get('imageinfo')
    if not info:
        raise SystemExit(f'missing on the wiki: {title}')
    return info[0]['url']


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for kind, wiki_name in KINDS.items():
        for color in COLORS:
            src = Image.open(io.BytesIO(get(image_url(f'{wiki_name} tag ({color}).png')))).convert('RGBA')
            w = round(src.width * HEIGHT / src.height)
            img = src.resize((w, HEIGHT), Image.LANCZOS)
            path = os.path.join(OUT, f'{kind}-{color}.webp')
            img.save(path, 'WEBP', lossless=True, method=6)
            total += os.path.getsize(path)
            print(f'{path}  {w}×{HEIGHT}  {os.path.getsize(path)} B')
    print(f'total {total} B')
    return 0


if __name__ == '__main__':
    sys.exit(main())
