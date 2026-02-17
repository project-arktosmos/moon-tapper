import { ObjectServiceClass } from '$services/classes/object-service.class';
import type { RhythmSettings, LaneModeBindings, LaneBinding } from '$types/rhythm.type';
import { DEFAULT_RHYTHM_SETTINGS, DEFAULT_LANE_MODE_BINDINGS, DEFAULT_DUEL_LANE_MODE_BINDINGS } from '$types/rhythm.type';

export const rhythmSettingsService = new ObjectServiceClass<RhythmSettings>(
	'rhythm-settings',
	DEFAULT_RHYTHM_SETTINGS
);

function isLaneBinding(value: unknown): value is LaneBinding {
	return typeof value === 'object' && value !== null && 'keyboard' in value;
}

function migrateStringBindings(
	old: Record<number, string>,
	defaults: Record<number, LaneBinding>
): Record<number, LaneBinding> {
	const result: Record<number, LaneBinding> = {};
	for (const [lane, code] of Object.entries(old)) {
		const laneNum = Number(lane);
		if (code.startsWith('GP')) {
			result[laneNum] = { keyboard: defaults[laneNum]?.keyboard ?? 'KeyD', gamepad: code };
		} else {
			result[laneNum] = { keyboard: code, gamepad: null };
		}
	}
	return result;
}

// Migration: ensure laneModeBindings exists and uses LaneBinding format
const current = rhythmSettingsService.get();
if (!current.laneModeBindings) {
	// v1 migration: no laneModeBindings at all
	const oldKeyBindings = current.keyBindings || { 0: 'KeyD', 1: 'KeyF', 2: 'KeyJ', 3: 'KeyK' };
	rhythmSettingsService.set({
		...current,
		laneModeBindings: {
			...structuredClone(DEFAULT_LANE_MODE_BINDINGS),
			4: migrateStringBindings(oldKeyBindings, DEFAULT_LANE_MODE_BINDINGS[4])
		}
	});
} else {
	// v2 migration: laneModeBindings exists but may have old string format
	const sample = current.laneModeBindings[4]?.[0];
	if (sample !== undefined && !isLaneBinding(sample)) {
		const old = current.laneModeBindings as unknown as Record<2 | 3 | 4, Record<number, string>>;
		const migrated: LaneModeBindings = {
			2: migrateStringBindings(old[2] || { 0: 'KeyF', 1: 'KeyJ' }, DEFAULT_LANE_MODE_BINDINGS[2]),
			3: migrateStringBindings(old[3] || { 0: 'KeyF', 1: 'Space', 2: 'KeyJ' }, DEFAULT_LANE_MODE_BINDINGS[3]),
			4: migrateStringBindings(old[4] || { 0: 'KeyD', 1: 'KeyF', 2: 'KeyJ', 3: 'KeyK' }, DEFAULT_LANE_MODE_BINDINGS[4])
		};
		rhythmSettingsService.set({ ...current, laneModeBindings: migrated });
	}
}

// v3 migration: ensure duelLaneModeBindings exists
const afterMigration = rhythmSettingsService.get();
if (!afterMigration.duelLaneModeBindings) {
	rhythmSettingsService.set({
		...afterMigration,
		duelLaneModeBindings: structuredClone(DEFAULT_DUEL_LANE_MODE_BINDINGS)
	});
}
