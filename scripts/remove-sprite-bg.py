#!/usr/bin/env python3
"""
Remove solid background color from Dragon Ball pixel sprites using a magic-wand
flood fill.  For each PNG the script:

1. Reads the 4 corner pixels.
2. Verifies they are identical (exact RGBA match).
3. Flood-fills from every corner with tolerance=0 (only 100 % color matches),
   turning matched connected pixels transparent.
4. Overwrites the file in-place.

Usage:
    python3 scripts/remove-sprite-bg.py
"""

import os
import sys
from collections import deque
from PIL import Image

SPRITES_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "static",
    "stickers",
    "dragon-ball-pixel",
)


def flood_fill_transparent(img, start_x, start_y, target_color):
    """
    BFS flood fill starting at (start_x, start_y).
    Every connected pixel whose RGBA value is *exactly* target_color
    is set to fully transparent (0, 0, 0, 0).
    Only 4-connected neighbours (up/down/left/right) are considered.
    """
    w, h = img.size
    pixels = img.load()

    if pixels[start_x, start_y] != target_color:
        return 0

    transparent = (0, 0, 0, 0)
    visited = set()
    queue = deque()
    queue.append((start_x, start_y))
    visited.add((start_x, start_y))
    count = 0

    while queue:
        x, y = queue.popleft()
        if pixels[x, y] == target_color:
            pixels[x, y] = transparent
            count += 1
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                    visited.add((nx, ny))
                    if pixels[nx, ny] == target_color:
                        queue.append((nx, ny))

    return count


def process_image(filepath):
    """
    Process a single PNG sprite.  Returns a status string.
    """
    img = Image.open(filepath).convert("RGBA")
    w, h = img.size

    corners = (
        img.getpixel((0, 0)),
        img.getpixel((w - 1, 0)),
        img.getpixel((0, h - 1)),
        img.getpixel((w - 1, h - 1)),
    )

    if len(set(corners)) != 1:
        return "SKIP (corners differ: {})".format(corners)

    target_color = corners[0]

    # Already transparent – nothing to do
    if target_color[3] == 0:
        return "SKIP (already transparent)"

    total_removed = 0
    # Flood fill from all four corners to catch any disconnected background
    # pockets along the edges.
    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        total_removed += flood_fill_transparent(img, sx, sy, target_color)

    if total_removed == 0:
        return "SKIP (0 pixels matched)"

    img.save(filepath)
    return "OK – removed {} px (bg color {})".format(total_removed, target_color)


def main():
    sprites_dir = os.path.normpath(SPRITES_DIR)

    if not os.path.isdir(sprites_dir):
        print("ERROR: directory not found: {}".format(sprites_dir))
        sys.exit(1)

    png_files = []
    for root, _dirs, files in os.walk(sprites_dir):
        for f in sorted(files):
            if f.lower().endswith(".png"):
                png_files.append(os.path.join(root, f))

    if not png_files:
        print("No PNG files found in {}".format(sprites_dir))
        sys.exit(1)

    print("Processing {} PNG files in {}\n".format(len(png_files), sprites_dir))

    ok = 0
    skipped = 0
    for filepath in png_files:
        rel = os.path.relpath(filepath, sprites_dir)
        status = process_image(filepath)
        print("  {} – {}".format(rel, status))
        if status.startswith("OK"):
            ok += 1
        else:
            skipped += 1

    print("\nDone. {} processed, {} skipped.".format(ok, skipped))


if __name__ == "__main__":
    main()
