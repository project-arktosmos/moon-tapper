import { ObjectServiceClass } from '$services/classes/object-service.class';

interface ThemeConfig {
	id: string;
	theme: string;
}

const themeService = new ObjectServiceClass<ThemeConfig>('app-theme', {
	id: 'app-theme',
	theme: 'dark'
});

function applyTheme(theme: string): void {
	if (typeof document !== 'undefined') {
		document.documentElement.setAttribute('data-theme', theme);
	}
}

export function initTheme(): void {
	applyTheme(themeService.get().theme);

	// Re-apply when store updates (handles async hydration from Tauri store)
	themeService.store.subscribe((config) => {
		applyTheme(config.theme);
	});
}
