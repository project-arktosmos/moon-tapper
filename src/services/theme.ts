import { get, type Writable } from 'svelte/store';
import localStorageWritableStore from '$utils/localStorageWritableStore';

export const AVAILABLE_THEMES = [
	'light',
	'dark',
	'cupcake',
	'bumblebee',
	'emerald',
	'corporate',
	'synthwave',
	'retro',
	'cyberpunk',
	'valentine',
	'halloween',
	'garden',
	'forest',
	'aqua',
	'lofi',
	'pastel',
	'fantasy',
	'wireframe',
	'black',
	'luxury',
	'dracula',
	'cmyk',
	'autumn',
	'business',
	'acid',
	'lemonade',
	'night',
	'coffee',
	'winter',
	'dim',
	'nord',
	'sunset'
] as const;

export type Theme = (typeof AVAILABLE_THEMES)[number];

const STORAGE_KEY = 'app-theme';
const DEFAULT_THEME: Theme = 'dark';

export const themeStore: Writable<Theme> = localStorageWritableStore(STORAGE_KEY, DEFAULT_THEME);

export function getTheme(): Theme {
	return get(themeStore);
}

export function setTheme(theme: Theme): void {
	themeStore.set(theme);
	applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
	if (typeof document !== 'undefined') {
		document.documentElement.setAttribute('data-theme', theme);
	}
}

export function initTheme(): void {
	const theme = getTheme();
	applyTheme(theme);
}
