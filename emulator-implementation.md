# GBA Emulator Integration — Implementation Tracker

## Overview
Integrating [rustboyadvance-ng](https://github.com/michelhe/rustboyadvance-ng) GBA emulator core into the Tauri v2 + SvelteKit app. The Rust core runs on a dedicated thread; the frontend handles rendering, input, and audio.

## Architecture
- **Rust**: Dedicated emulator thread (GBA is `!Send` due to `Rc<RefCell<Scheduler>>`) communicating via `mpsc` channels
- **Frontend**: `requestAnimationFrame` loop calls `invoke('emu_frame')`, renders framebuffer to `<canvas>`, plays audio via Web Audio API
- **Data flow**: Frontend sends key bitmask → Rust runs frame → returns base64 RGBA framebuffer + audio samples

---

## Implementation Status

### Phase 1: Rust Backend

| Task | Status | File(s) |
|------|--------|---------|
| Add rustboyadvance-core + base64 + ringbuf + utils deps | DONE | `src-tauri/Cargo.toml` |
| Bundle placeholder GBA BIOS (16KB zeros + skip_bios) | DONE | `src-tauri/resources/gba_bios.bin` |
| Create emulator module (thread, channels, frame logic) | DONE | `src-tauri/src/emulator.rs` |
| Register Tauri commands (emu_load_rom, emu_frame, emu_reset) | DONE | `src-tauri/src/lib.rs` |
| Fix main.rs crate name (pre-existing bug) | DONE | `src-tauri/src/main.rs` |
| Verify Rust backend compiles (`cargo check`) | DONE | — |

### Phase 2: Frontend

| Task | Status | File(s) |
|------|--------|---------|
| Create emulator API wrapper | DONE | `src/api/emulator.ts` |
| Create EmulatorScreen component (canvas, rAF loop, input, audio) | DONE | `src/components/core/EmulatorScreen.svelte` |
| Create RomLoader component (file picker / drag-drop) | DONE | `src/components/core/RomLoader.svelte` |
| Create /emulator route page | DONE | `src/routes/emulator/+page.svelte` |
| Update routes.json | DONE | `src/lib/routes.json` |

### Phase 3: Polish

| Task | Status | File(s) |
|------|--------|---------|
| Error handling in UI | DONE | `+page.svelte` (error alerts + dismiss) |
| Pause on page hidden | DONE | `EmulatorScreen.svelte` (visibilitychange) |
| Cleanup on unmount | DONE | `EmulatorScreen.svelte` (onDestroy) |

### Phase 4: Feature-Complete Emulator

| Task | Status | File(s) |
|------|--------|---------|
| Emulator settings type + service | DONE | `src/types/emulator.type.ts`, `src/services/emulator-settings.service.ts` |
| Pause/Resume | DONE | `EmulatorScreen.svelte` (paused prop, P key), `+page.svelte` (pause button) |
| SRAM persistence (in-game saves) | DONE | `emulator.rs` (save_path), `lib.rs` (save_dir setup) |
| Volume control + mute | DONE | `EmulatorScreen.svelte` (GainNode), `+page.svelte` (slider + mute button) |
| Save states (full-stack) | DONE | `emulator.rs` (SaveState/LoadState), `lib.rs` (emu_save_state/emu_load_state), `emulator.ts` (API), `EmulatorScreen.svelte` (F1-F9 shortcuts) |
| Speed control (fast-forward + frame step) | DONE | `EmulatorScreen.svelte` (multi-frame loop, Space/Period keys), `+page.svelte` (speed toggle) |
| Fullscreen mode | DONE | `EmulatorScreen.svelte` (Fullscreen API, F11), `+page.svelte` (fullscreen button) |
| Gamepad support | DONE | `EmulatorScreen.svelte` (Gamepad API polling, standard mapping, analog stick) |
| Configurable key bindings | DONE | `KeyBindingEditor.svelte`, `EmulatorScreen.svelte` (dynamic keyMap prop), settings persistence |
| Mobile touch controls | DONE | `TouchControls.svelte` (virtual D-pad, A/B/Start/Select/L/R overlay) |
| i18n translations | DONE | `en.json` (emulator section) |

---

## Files Created / Modified

### New Files
- `src-tauri/src/emulator.rs` — Emulator thread, channel commands, frame processing, audio drain, save states, SRAM persistence
- `src-tauri/resources/gba_bios.bin` — Placeholder 16KB BIOS (replace with open-source build for full compat)
- `src/api/emulator.ts` — Tauri command wrappers (loadRom, frame, reset, saveState, loadState)
- `src/components/core/EmulatorScreen.svelte` — Canvas renderer, rAF loop, keyboard/gamepad/touch input, Web Audio with GainNode, fullscreen, speed control
- `src/components/core/RomLoader.svelte` — File picker + drag-and-drop ROM loading
- `src/components/core/TouchControls.svelte` — Mobile virtual D-pad + button overlay
- `src/components/core/KeyBindingEditor.svelte` — Key remapping settings panel
- `src/types/emulator.type.ts` — EmulatorSettings interface, GBA_BUTTONS, DEFAULT_KEY_BINDINGS
- `src/services/emulator-settings.service.ts` — ObjectServiceClass for persistent emulator settings
- `src/routes/emulator/+page.svelte` — Emulator page with full controls, volume, speed, settings, touch controls

### Modified Files
- `src-tauri/Cargo.toml` — Added rustboyadvance-core, rustboyadvance-utils, ringbuf, base64
- `src-tauri/src/lib.rs` — Added emulator module, 5 Tauri commands (load_rom, frame, reset, save_state, load_state), EmulatorHandle with save_dir, save state file I/O
- `src-tauri/src/main.rs` — Fixed crate name (tauri_svelte_lib → moon_tapper_lib)
- `src/lib/routes.json` — Added /emulator route
- `src/services/i18n/locales/en.json` — Added emulator translation keys

---

## Key Technical Decisions

- **BIOS**: Placeholder 16KB zero buffer + `skip_bios()`. Replace `src-tauri/resources/gba_bios.bin` with a proper open-source BIOS for better game compatibility.
- **Framebuffer transfer**: Base64-encoded RGBA bytes via Tauri `invoke`. ~205KB per frame at 60fps.
- **Audio**: `SimpleAudioInterface` ring buffer from rustboyadvance-core. Producer in GBA, consumer drained per frame. Web Audio `AudioBufferSourceNode` → `GainNode` → destination for volume control.
- **Threading**: Dedicated `std::thread` with `mpsc::channel`. Tauri async commands use `spawn_blocking` + `SyncSender` response channel.
- **Input**: Active-low u16 bitmask. Three input sources merged via AND: keyboard + gamepad + touch.
- **Save states**: `GameBoyAdvance::save_state()` → bincode `Vec<u8>`, stored to `{app_data_dir}/save_states/slot_N.state`.
- **SRAM persistence**: `GamepakBuilder::save_path(save_dir)` auto-persists `.sav` files to `{app_data_dir}/saves/`.
- **Speed control**: Fast-forward runs N frames per rAF tick (render only last, skip audio).
- **Settings persistence**: `ObjectServiceClass<EmulatorSettings>` stores volume, mute, key bindings to localStorage.

## Keyboard Mapping (Default, Configurable)

| GBA | Default Key | Bit |
|-----|-------------|-----|
| A | Z | 0 |
| B | X | 1 |
| Select | Backspace | 2 |
| Start | Enter | 3 |
| Right | ArrowRight | 4 |
| Left | ArrowLeft | 5 |
| Up | ArrowUp | 6 |
| Down | ArrowDown | 7 |
| R | S | 8 |
| L | A | 9 |

## Emulator Shortcuts

| Key | Action |
|-----|--------|
| P | Toggle pause/resume |
| M | Toggle mute |
| Space | Toggle fast-forward (4x) |
| . (period) | Frame step (while paused) |
| F11 | Toggle fullscreen |
| F1–F9 | Save state to slot |
| Shift+F1–F9 | Load state from slot |

## Gamepad Mapping (Standard Layout)

| Gamepad | GBA |
|---------|-----|
| A / Y (face buttons) | A |
| B / X (face buttons) | B |
| Left bumper | L |
| Right bumper | R |
| Back | Select |
| Start | Start |
| D-pad | D-pad |
| Left stick | D-pad (deadzone 0.3) |

## Known Limitations
- **BIOS**: Placeholder zeros — some games using BIOS SWI calls may not work. Replace with Cult-of-GBA or similar open-source BIOS.
- **Audio**: May have minor clicks between frame batches. AudioWorklet would improve this.
- **Framebuffer IPC**: Base64 encoding adds overhead (~205KB/frame). Could be optimized with `tauri::ipc::Response` raw binary.
- **Touch controls**: Basic layout; advanced multi-touch tracking per-button identifier not yet implemented.

## Remaining Enhancements
- Binary IPC optimization (replace base64 with raw bytes)
- ROM library management in SQLite
- AudioWorklet for click-free audio
- Proper open-source BIOS integration
- Per-game save state slots (currently global)
- Screen filters (CRT, scanlines)
