import { writable, get } from 'svelte/store';
import { isTauri } from '$utils/isTauri';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/** Shared LazyStore singleton — all keys live in one `app-data.json` file. */
let tauriStorePromise: Promise<import('@tauri-apps/plugin-store').LazyStore> | null = null;

function getTauriStore(): Promise<import('@tauri-apps/plugin-store').LazyStore> {
	if (!tauriStorePromise) {
		tauriStorePromise = import('@tauri-apps/plugin-store').then(({ LazyStore }) => {
			return new LazyStore('app-data.json');
		});
	}
	return tauriStorePromise;
}

export default function localStorageWritableStore<T>(key: string, initialValue: T) {
	// SSR: no persistence
	if (!isBrowser) {
		return writable(initialValue);
	}

	// Tauri: use plugin-store for reliable file-backed persistence
	if (isTauri()) {
		const store = writable<T>(initialValue);
		let hydrated = false;

		// Async hydration: load persisted value, then enable write-through
		getTauriStore().then(async (tauriStore) => {
			const persisted = await tauriStore.get<T>(key);
			if (persisted !== undefined && persisted !== null) {
				store.set(persisted);
			}
			hydrated = true;

			// Flush current value to capture any mutations that happened
			// before hydration (e.g. module-level service init code)
			await tauriStore.set(key, get(store));
		});

		// Write-through: persist every change after hydration completes
		store.subscribe((value) => {
			if (!hydrated) return;
			getTauriStore().then((tauriStore) => tauriStore.set(key, value));
		});

		return store;
	}

	// Web browser: use localStorage
	const storedValue = localStorage.getItem(key);
	const parsedValue = storedValue ? JSON.parse(storedValue) : initialValue;
	const store = writable<T>(parsedValue);
	store.subscribe((value) => {
		localStorage.setItem(key, JSON.stringify(value));
	});
	return store;
}
