import { invoke } from '@tauri-apps/api/core';

export const stickersApi = {
	async deleteCharacter(collectionBase: string, characterPath: string): Promise<void> {
		return invoke('sticker_delete_character', {
			collectionBase,
			characterPath
		});
	}
};
