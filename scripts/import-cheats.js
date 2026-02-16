import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_URL = 'https://github.com/libretro/libretro-database.git';
const CHT_SUBDIR = 'cht/Nintendo - Game Boy Advance';
const TEMP_DIR = join(__dirname, '../.tmp-libretro');
const OUTPUT_PATH = join(__dirname, '../src/data/gba-cheats.json');

/**
 * Generate a slug ID from a filename.
 */
function slugify(text) {
	return text
		.toLowerCase()
		.trim()
		.replace(/\.cht$/i, '')
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

/**
 * Parse a .cht filename into game metadata.
 */
function parseFilename(filename) {
	const name = filename.replace(/\.cht$/i, '');

	// Try pattern: Title (Region) (CheatType)
	const match = name.match(/^(.+?)\s*\(([^)]+)\)\s*\(([^)]+)\)\s*$/);
	if (match) {
		return {
			title: match[1].trim(),
			region: match[2].trim(),
			cheatType: match[3].trim()
		};
	}

	// Try pattern: Title (Single Parenthetical)
	const singleMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
	if (singleMatch) {
		const paren = singleMatch[2].trim();
		const isCheatType = /code\s*breaker|gameshark|action\s*replay/i.test(paren);
		return {
			title: singleMatch[1].trim(),
			region: isCheatType ? 'Unknown' : paren,
			cheatType: isCheatType ? paren : 'Code Breaker'
		};
	}

	return {
		title: name.trim(),
		region: 'Unknown',
		cheatType: 'Code Breaker'
	};
}

/**
 * Parse a .cht file's content into an array of cheat objects.
 */
function parseChtContent(content, gameId) {
	const lines = content.split('\n').map((l) => l.trim());
	const cheats = [];

	const countLine = lines.find((l) => l.startsWith('cheats'));
	if (!countLine) return cheats;

	const count = parseInt(countLine.split('=')[1]?.trim() || '0', 10);

	for (let i = 0; i < count; i++) {
		const descLine = lines.find((l) => l.startsWith(`cheat${i}_desc`));
		const codeLine = lines.find((l) => l.startsWith(`cheat${i}_code`));

		if (!descLine || !codeLine) continue;

		const description = descLine
			.split('=')[1]
			?.trim()
			.replace(/^"|"$/g, '');
		const code = codeLine
			.split('=')[1]
			?.trim()
			.replace(/^"|"$/g, '');

		if (description && code) {
			cheats.push({
				id: `${gameId}-${i}`,
				description,
				code
			});
		}
	}

	return cheats;
}

// --- Main ---

try {
	console.log('Importing GBA cheats from libretro-database...\n');

	// Clean up any previous temp directory
	if (existsSync(TEMP_DIR)) {
		rmSync(TEMP_DIR, { recursive: true, force: true });
	}

	// Sparse clone — only the GBA cheats directory
	console.log('Cloning libretro-database (sparse, GBA cheats only)...');
	mkdirSync(TEMP_DIR, { recursive: true });
	execSync(`git clone --depth 1 --filter=blob:none --sparse "${REPO_URL}" "${TEMP_DIR}"`, {
		stdio: 'pipe'
	});
	execSync(`git -C "${TEMP_DIR}" sparse-checkout set "${CHT_SUBDIR}"`, {
		stdio: 'pipe'
	});

	const chtDir = join(TEMP_DIR, CHT_SUBDIR);
	if (!existsSync(chtDir)) {
		throw new Error(`Cheat directory not found: ${chtDir}`);
	}

	const files = readdirSync(chtDir).filter((f) => f.endsWith('.cht'));
	console.log(`Found ${files.length} .cht files\n`);

	const games = [];
	let totalCheats = 0;

	for (const file of files) {
		const content = readFileSync(join(chtDir, file), 'utf-8');
		const gameId = slugify(file);
		const metadata = parseFilename(file);
		const cheats = parseChtContent(content, gameId);

		if (cheats.length === 0) continue;

		totalCheats += cheats.length;
		games.push({
			id: gameId,
			title: metadata.title,
			region: metadata.region,
			cheatType: metadata.cheatType,
			filename: file,
			cheats,
			cheatCount: cheats.length
		});
	}

	// Sort games alphabetically by title
	games.sort((a, b) => a.title.localeCompare(b.title));

	const database = {
		games,
		totalGames: games.length,
		totalCheats,
		generatedAt: new Date().toISOString()
	};

	// Ensure output directory exists
	const outputDir = dirname(OUTPUT_PATH);
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	writeFileSync(OUTPUT_PATH, JSON.stringify(database));
	const sizeMB = (Buffer.byteLength(JSON.stringify(database)) / (1024 * 1024)).toFixed(2);

	console.log(`Generated ${OUTPUT_PATH}`);
	console.log(`  Games: ${games.length}`);
	console.log(`  Cheats: ${totalCheats}`);
	console.log(`  Size: ${sizeMB} MB\n`);

	// Clean up
	rmSync(TEMP_DIR, { recursive: true, force: true });
	console.log('Done! Cleaned up temp directory.');
} catch (error) {
	// Clean up on error too
	if (existsSync(TEMP_DIR)) {
		rmSync(TEMP_DIR, { recursive: true, force: true });
	}
	console.error('Error importing cheats:', error.message);
	process.exit(1);
}
