# App Icons

Generate app icons using the Tauri CLI:

```bash
pnpm tauri icon path/to/your/icon.png
```

This will generate all required icon sizes for all platforms from a single source image.

**Recommended source image:**
- Size: 1024x1024 pixels minimum
- Format: PNG with transparency
- Square aspect ratio

The following icons will be generated:
- 32x32.png
- 128x128.png
- 128x128@2x.png
- icon.icns (macOS)
- icon.ico (Windows)
- Android icons (in gen/android/)
- iOS icons (in gen/ios/)
