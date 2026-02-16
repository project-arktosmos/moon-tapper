import localStorageWritableStore from '$utils/localStorageWritableStore';

/**
 * Persists user-chosen thumbnail overrides for sticker characters.
 * Key: "{collectionId}:{characterPath}" → Value: sprite filename relative to character path
 */
export const stickerThumbnailsStore = localStorageWritableStore<Record<string, string>>(
	'sticker-thumbnails',
	{}
);

export function setThumbnail(collectionId: string, characterPath: string, sprite: string): void {
	stickerThumbnailsStore.update((map) => ({
		...map,
		[`${collectionId}:${characterPath}`]: sprite
	}));
}

export function getThumbnailKey(collectionId: string, characterPath: string): string {
	return `${collectionId}:${characterPath}`;
}
