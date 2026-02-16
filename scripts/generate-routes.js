import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const routesDir = join(__dirname, '../src/routes');
const outputPath = join(__dirname, '../src/lib/routes.json');

/**
 * Convert a route path to a display name
 * e.g., '/settings' -> 'Settings', '/user-profile' -> 'User Profile'
 */
function pathToName(routePath) {
	if (routePath === '/') return 'Home';

	const segment = routePath.split('/').pop() || '';
	return segment
		.replace(/[-_]/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Recursively scan routes directory for +page.svelte files
 */
function scanRoutes(dir, basePath = '') {
	const routes = [];

	if (!existsSync(dir)) {
		return routes;
	}

	const entries = readdirSync(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			// Skip special SvelteKit directories
			if (entry.startsWith('(') || entry.startsWith('[')) {
				// For group routes like (app), scan inside but don't add to path
				if (entry.startsWith('(')) {
					routes.push(...scanRoutes(fullPath, basePath));
				}
				// For dynamic routes like [id], we could handle them differently
				// For now, skip them in the menu
				continue;
			}

			// Scan subdirectory
			const subPath = basePath ? `${basePath}/${entry}` : `/${entry}`;
			routes.push(...scanRoutes(fullPath, subPath));
		} else if (entry === '+page.svelte') {
			// Found a route
			const routePath = basePath || '/';
			routes.push({
				path: routePath,
				name: pathToName(routePath)
			});
		}
	}

	return routes;
}

/**
 * Sort routes: Home first, then alphabetically
 */
function sortRoutes(routes) {
	return routes.sort((a, b) => {
		if (a.path === '/') return -1;
		if (b.path === '/') return 1;
		return a.name.localeCompare(b.name);
	});
}

try {
	console.log('Scanning routes...');
	const routes = scanRoutes(routesDir);
	const sortedRoutes = sortRoutes(routes);

	writeFileSync(outputPath, JSON.stringify(sortedRoutes, null, '\t'));

	console.log(`✓ Generated routes.json with ${sortedRoutes.length} routes:`);
	sortedRoutes.forEach((r) => console.log(`  ${r.path} -> ${r.name}`));
} catch (error) {
	console.error('Error generating routes.json:', error);
	process.exit(1);
}
