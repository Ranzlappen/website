#!/usr/bin/env python3
"""Build the curated WvW map assets for the WvW Hub map picker.

Run from the repo root (needs Pillow, network access to the GW2 API + tiles):

    python3 -I wvw/scripts/build-maps.py

Outputs (committed — the browser never contacts ArenaNet's servers, same
privacy-first rule as the blog's local favicons):

    wvw/public/maps/{ebg,red,blue,green}.webp   stitched from tiles.guildwars2.com
    wvw/src/lib/wvwMaps.json                    per-map size, colour thirds, objectives

"Thirds": every map is split into three regions, one per team colour, by
assigning each point to the nearest team *spawn* (a 3-site Voronoi diagram,
clipped to the map rectangle). Spawn positions come from `/v2/wvw/objectives`
(`label_coord`); which colour owns which spawn comes from a live match (spawns
never change owner). Re-run after ArenaNet changes a map.
"""
import io
import json
import math
import os
import sys
import urllib.request

from PIL import Image

API = 'https://api.guildwars2.com/v2'
TILES = 'https://tiles.guildwars2.com/{continent}/{floor}/{z}/{x}/{y}.jpg'
CONTINENT = 2  # The Mists
FLOOR = 3      # default floor of the WvW maps
# The tile pyramid for the Mists is 1 px = 1 continent unit at zoom 7, even
# though /v2/continents/2 reports max_zoom 6 (verified empirically: zoom 3 has
# only a 4×4 tile grid). Tile math must use 7.
MAX_ZOOM = 7
ZOOM = 6       # 1 px = 2 continent units, then downscaled to MAX_DIM
MAX_DIM = 960  # longest side of the shipped image
MAP_TYPES = {'ebg': 'Center', 'red': 'RedHome', 'blue': 'BlueHome', 'green': 'GreenHome'}
OBJECTIVE_TYPES = {'Camp', 'Tower', 'Keep', 'Castle'}

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_IMG = os.path.join(ROOT, 'public', 'maps')
OUT_JSON = os.path.join(ROOT, 'src', 'lib', 'wvwMaps.json')


def get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'wvw-hub-build/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def get_bytes(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'wvw-hub-build/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def clip(poly, a, b, c):
    """Sutherland–Hodgman: keep the part of `poly` where a*x + b*y <= c."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp = a * p[0] + b * p[1] - c
        fq = a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp <= 0) != (fq <= 0):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def voronoi_cell(site, others, rect):
    (x1, y1), (x2, y2) = rect
    poly = [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
    px, py = site
    for qx, qy in others:
        # |X-P|² <= |X-Q|²  <=>  2(Q-P)·X <= |Q|² - |P|²
        poly = clip(poly, 2 * (qx - px), 2 * (qy - py), qx * qx + qy * qy - px * px - py * py)
    return poly


def stitch(rect):
    (x1, y1), (x2, y2) = rect
    units = 256 * 2 ** (MAX_ZOOM - ZOOM)  # continent units per tile
    scale = 1 / 2 ** (MAX_ZOOM - ZOOM)    # px per continent unit
    tx0, ty0 = math.floor(x1 / units), math.floor(y1 / units)
    tx1, ty1 = math.floor((x2 - 1) / units), math.floor((y2 - 1) / units)
    canvas = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), (12, 16, 22))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = TILES.format(continent=CONTINENT, floor=FLOOR, z=ZOOM, x=tx, y=ty)
            try:
                tile = Image.open(io.BytesIO(get_bytes(url))).convert('RGB')
                canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
            except Exception as e:  # missing edge tiles are fine (dark fill)
                print(f'  tile {tx},{ty}: {e}', file=sys.stderr)
    left = round((x1 - tx0 * units) * scale)
    top = round((y1 - ty0 * units) * scale)
    img = canvas.crop((left, top, left + round((x2 - x1) * scale), top + round((y2 - y1) * scale)))
    f = MAX_DIM / max(img.size)
    if f < 1:
        img = img.resize((round(img.width * f), round(img.height * f)), Image.LANCZOS)
    return img


def main():
    match = get_json(f'{API}/wvw/matches/2-1')
    map_ids = {m['type']: m['id'] for m in match['maps']}
    spawn_owner = {}
    for m in match['maps']:
        for o in m['objectives']:
            if o['type'] == 'Spawn':
                spawn_owner[o['id']] = o['owner'].lower()

    ids = ','.join(str(map_ids[t]) for t in MAP_TYPES.values())
    maps = {m['id']: m for m in get_json(f'{API}/maps?ids={ids}')}
    objectives = get_json(f'{API}/wvw/objectives?ids=all')

    os.makedirs(OUT_IMG, exist_ok=True)
    data = {
        'attribution': 'Map tiles © ArenaNet (tiles.guildwars2.com)',
        'generated': match['start_time'][:10],
        'maps': {},
    }
    for key, mtype in MAP_TYPES.items():
        mid = map_ids[mtype]
        info = maps[mid]
        rect = info['continent_rect']
        (x1, y1), (x2, y2) = rect
        w, h = x2 - x1, y2 - y1
        norm = lambda p: [round((p[0] - x1) / w, 4), round((p[1] - y1) / h, 4)]

        spawns = {}
        for o in objectives:
            if o.get('map_id') == mid and o['type'] == 'Spawn' and o['id'] in spawn_owner:
                spawns[spawn_owner[o['id']]] = o['label_coord']
        assert set(spawns) == {'red', 'blue', 'green'}, f'{key}: spawns {spawns}'

        thirds = {}
        for color, site in spawns.items():
            others = [p for c, p in spawns.items() if c != color]
            cell = voronoi_cell(site, others, rect)
            pts = [norm(p) for p in cell]
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            thirds[color] = {'polygon': pts, 'centroid': [round(cx, 4), round(cy, 4)], 'spawn': norm(site)}

        objs = []
        for o in objectives:
            if o.get('map_id') == mid and o['type'] in OBJECTIVE_TYPES and o.get('coord'):
                objs.append({'id': o['id'], 'name': o['name'].strip(), 'type': o['type'], 'pos': norm(o['coord'])})

        print(f'{key}: map {mid} {info["name"]} rect {w}x{h}, stitching…')
        img = stitch(rect)
        path = os.path.join(OUT_IMG, f'{key}.webp')
        img.save(path, 'WEBP', quality=68, method=6)
        print(f'  → {path} {img.size} {os.path.getsize(path) // 1024} KB')

        data['maps'][key] = {
            'mapId': mid,
            'name': info['name'].strip(),
            'image': f'maps/{key}.webp',
            'width': img.width,
            'height': img.height,
            'thirds': thirds,
            'objectives': sorted(objs, key=lambda x: x['id']),
        }

    with open(OUT_JSON, 'w') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    print(f'wrote {OUT_JSON}')


if __name__ == '__main__':
    main()
