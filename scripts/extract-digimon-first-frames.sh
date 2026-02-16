#!/usr/bin/env bash
#
# Extract ALL frames from each animated GIF in static/stickers/digimon/_originals/
# as PNGs. Frame 0 is kept at the top level as the default display image.
# All frames go into _frames/<Name>/0.png, 1.png, ...
# A _frames/manifest.json is generated with frame counts per digimon.
#
# Usage: bash scripts/extract-digimon-first-frames.sh
#
# Prerequisites: The original GIFs must be in _originals/ (from a previous run
# or manually placed there). If GIFs are still at the top level, they will be
# moved to _originals/ first.
#
# To revert (re-apply GIFs as stickers):
#   mv static/stickers/digimon/_originals/*.gif static/stickers/digimon/
#   rm static/stickers/digimon/*.png
#   rm -rf static/stickers/digimon/_frames
#   node scripts/generate-sticker-manifest.js

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STICKER_DIR="$SCRIPT_DIR/../static/stickers/digimon"
ORIGINALS_DIR="$STICKER_DIR/_originals"
FRAMES_DIR="$STICKER_DIR/_frames"

if ! command -v magick &>/dev/null; then
	echo "Error: ImageMagick (magick) is required but not found."
	echo "Install with: brew install imagemagick"
	exit 1
fi

# Move any top-level GIFs to _originals/ first
mkdir -p "$ORIGINALS_DIR"
for gif in "$STICKER_DIR"/*.gif; do
	[ -f "$gif" ] || continue
	mv "$gif" "$ORIGINALS_DIR/"
	echo "Moved $(basename "$gif") to _originals/"
done

# Create _frames directory
mkdir -p "$FRAMES_DIR"

extracted=0
manifest="{"

first_entry=true

for gif in "$ORIGINALS_DIR"/*.gif; do
	[ -f "$gif" ] || continue

	name="$(basename "$gif" .gif)"
	frame_dir="$FRAMES_DIR/$name"
	mkdir -p "$frame_dir"

	# Count frames in this GIF
	frame_count=$(magick identify "$gif" 2>/dev/null | wc -l | tr -d ' ')

	# Extract all frames
	for i in $(seq 0 $((frame_count - 1))); do
		magick "$gif[$i]" "$frame_dir/$i.png"
	done

	# Copy frame 0 as the top-level default display image
	cp "$frame_dir/0.png" "$STICKER_DIR/$name.png"

	echo "  OK: $name — $frame_count frames"
	extracted=$((extracted + 1))

	# Build manifest JSON entry
	if [ "$first_entry" = true ]; then
		first_entry=false
	else
		manifest="$manifest,"
	fi
	manifest="$manifest \"$name\": $frame_count"
done

manifest="$manifest }"

# Write frames manifest (both in _frames/ and in src/data/ for imports)
echo "$manifest" | python3 -m json.tool > "$FRAMES_DIR/manifest.json"
cp "$FRAMES_DIR/manifest.json" "$SCRIPT_DIR/../src/data/digimon-frames.json"

echo ""
echo "Done! Extracted all frames for $extracted digimon into _frames/"
echo "Generated _frames/manifest.json"
echo ""
echo "Next step: regenerate the sticker manifest:"
echo "  node scripts/generate-sticker-manifest.js"
