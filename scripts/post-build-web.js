import { copyFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');

// SPA routing: GitHub Pages serves 404.html for unknown paths
copyFileSync(join(distDir, 'index.html'), join(distDir, '404.html'));

// Prevent Jekyll from ignoring _-prefixed files (like _app/)
writeFileSync(join(distDir, '.nojekyll'), '');

console.log('Web post-build: created 404.html and .nojekyll in dist/');
