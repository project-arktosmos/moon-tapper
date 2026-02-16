import { ObjectServiceClass } from '$services/classes/object-service.class';
import type { RhythmSettings } from '$types/rhythm.type';
import { DEFAULT_RHYTHM_SETTINGS } from '$types/rhythm.type';

export const rhythmSettingsService = new ObjectServiceClass<RhythmSettings>(
	'rhythm-settings',
	DEFAULT_RHYTHM_SETTINGS
);
