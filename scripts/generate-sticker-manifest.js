import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const stickersDir = join(__dirname, '../static/stickers');
const outputPath = join(__dirname, '../src/data/sticker-manifest.json');

function slugify(text) {
	return text
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^\w-]+/g, '');
}

function scanDirectory(dir) {
	if (!existsSync(dir)) return { files: [], dirs: [] };

	const entries = readdirSync(dir);
	const files = [];
	const dirs = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			dirs.push(entry);
		} else if (/\.(png|gif)$/i.test(entry)) {
			files.push(entry);
		}
	}

	return { files: files.sort(), dirs: dirs.sort() };
}

/**
 * Find the "1" variant sprite from a list of PNG filenames.
 * Tries patterns: " 1.png", "_1.png", "e1.png" (letter+1), "_01.png", " 01.png",
 * then falls back to the sprite with the lowest numeric suffix.
 */
function findThumbnail(sprites) {
	const images = sprites.filter((s) => /\.(png|gif)$/i.test(s));
	if (images.length === 0) return null;

	// Try "1" patterns (must not match 10, 11, 12...)
	const onePatterns = [
		/[ _]1\.(png|gif)$/i, //  "Name 1.png" or "Name_1.gif"
		/[^0-9]1\.(png|gif)$/i, // "Name1.png" (letter right before 1)
		/[ _]01[.]+(png|gif)$/i, // "Name_01.png" or "Name 01..png" (Jiren edge case)
		/[^0-9]01\.(png|gif)$/i // "Name01.png"
	];

	for (const pattern of onePatterns) {
		const match = images.find((s) => pattern.test(s));
		if (match) return match;
	}

	// Fallback: image with the lowest numeric suffix
	const withNumbers = images
		.map((s) => {
			const m = s.match(/(\d+)\.*\.(png|gif)$/i);
			return { file: s, num: m ? parseInt(m[1]) : Infinity };
		})
		.sort((a, b) => a.num - b.num);

	return withNumbers[0]?.file || images[0];
}

function buildCollection(collectionName, collectionDir, basePath) {
	const { files, dirs } = scanDirectory(collectionDir);
	const categories = [];

	// Include root-level files as an "All" category if present
	if (files.length > 0) {
		categories.push({
			id: 'all',
			name: 'All',
			sprites: files,
			count: files.length
		});
	}

	if (dirs.length > 0) {
		for (const dir of dirs) {
			const catDir = join(collectionDir, dir);
			const catScan = scanDirectory(catDir);

			const category = {
				id: slugify(dir),
				name: dir,
				count: 0
			};

			if (catScan.dirs.length > 0) {
				// Has subcategories (e.g., GOKU fases → Goku, Goku SSJ 1, etc.)
				const subcategories = [];

				for (const subdir of catScan.dirs) {
					const subDir = join(catDir, subdir);
					const subScan = scanDirectory(subDir);

					if (subScan.files.length > 0) {
						subcategories.push({
							id: slugify(subdir),
							name: subdir,
							path: `${dir}/${subdir}`,
							sprites: subScan.files,
							count: subScan.files.length
						});
					}
				}

				// Also include any files directly in the category folder
				if (catScan.files.length > 0) {
					subcategories.unshift({
						id: slugify(dir) + '-base',
						name: dir,
						path: dir,
						sprites: catScan.files,
						count: catScan.files.length
					});
				}

				category.subcategories = subcategories;
				category.count = subcategories.reduce((sum, sc) => sum + sc.count, 0);
			} else {
				// Flat category (files directly inside)
				category.sprites = catScan.files;
				category.path = dir;
				category.count = catScan.files.length;
			}

			if (category.count > 0) {
				categories.push(category);
			}
		}
	}

	const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

	// Build a flat characters list: one entry per leaf group with a thumbnail
	const characters = [];
	for (const cat of categories) {
		if (cat.subcategories) {
			for (const sub of cat.subcategories) {
				const thumb = findThumbnail(sub.sprites);
				if (thumb) {
					characters.push({
						name: sub.name,
						path: sub.path,
						thumbnail: `${sub.path}/${thumb}`
					});
				}
			}
		} else if (cat.sprites) {
			const thumb = findThumbnail(cat.sprites);
			if (thumb) {
				characters.push({
					name: cat.name === 'All' ? collectionName : cat.name,
					path: cat.path || '',
					thumbnail: cat.path ? `${cat.path}/${thumb}` : thumb
				});
			}
		}
	}

	return {
		id: slugify(collectionName),
		name: collectionName
			.replace(/-/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase()),
		basePath,
		categories,
		characters,
		count: totalCount
	};
}

try {
	console.log('Scanning sticker collections...');

	const { dirs } = scanDirectory(stickersDir);
	const collections = [];

	for (const dir of dirs) {
		const collectionDir = join(stickersDir, dir);
		const basePath = `/stickers/${dir}`;
		const collection = buildCollection(dir, collectionDir, basePath);
		collections.push(collection);
		console.log(`  ${collection.name}: ${collection.count} sprites in ${collection.categories.length} categories`);
	}

	const manifest = { collections };
	writeFileSync(outputPath, JSON.stringify(manifest, null, '\t'));

	const total = collections.reduce((sum, c) => sum + c.count, 0);
	console.log(`\nGenerated sticker-manifest.json with ${total} total sprites across ${collections.length} collections`);
} catch (error) {
	console.error('Error generating sticker manifest:', error);
	process.exit(1);
}
