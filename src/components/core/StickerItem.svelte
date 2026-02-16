<script lang="ts">
	import { onMount } from 'svelte';

	export let url: string;
	export let label: string;

	const SIZE = 512;
	const WHITE_W = 20;
	const BLACK_W = 8;
	const PAD = WHITE_W + BLACK_W;

	let canvas: HTMLCanvasElement;

	/** 1D squared-distance transform (Felzenszwalb & Huttenlocher) */
	function edt1d(f: Float32Array, n: number): Float32Array {
		const d = new Float32Array(n);
		const v = new Int32Array(n);
		const z = new Float32Array(n + 1);
		let k = 0;
		v[0] = 0;
		z[0] = -1e10;
		z[1] = 1e10;

		for (let q = 1; q < n; q++) {
			const fq = f[q] + q * q;
			let s = (fq - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
			while (s <= z[k]) {
				k--;
				s = (fq - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
			}
			k++;
			v[k] = q;
			z[k] = s;
			z[k + 1] = 1e10;
		}

		k = 0;
		for (let q = 0; q < n; q++) {
			while (z[k + 1] < q) k++;
			d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
		}
		return d;
	}

	/** 2D Euclidean distance transform — returns grid of squared distances */
	function edt2d(grid: Float32Array, w: number, h: number) {
		const tmp = new Float32Array(Math.max(w, h));
		// rows
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) tmp[x] = grid[y * w + x];
			const d = edt1d(tmp.subarray(0, w), w);
			for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
		}
		// columns
		for (let x = 0; x < w; x++) {
			for (let y = 0; y < h; y++) tmp[y] = grid[y * w + x];
			const d = edt1d(tmp.subarray(0, h), h);
			for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
		}
	}

	onMount(() => {
		const img = new Image();
		img.onload = () => {
			canvas.width = SIZE;
			canvas.height = SIZE;
			const ctx = canvas.getContext('2d')!;
			ctx.imageSmoothingEnabled = false;

			// Scale image to fit inside the outline zone
			const inner = SIZE - PAD * 2;
			const scale = Math.min(inner / img.width, inner / img.height);
			const sw = Math.round(img.width * scale);
			const sh = Math.round(img.height * scale);
			const sx = Math.round((SIZE - sw) / 2);
			const sy = Math.round((SIZE - sh) / 2);
			ctx.drawImage(img, sx, sy, sw, sh);

			const src = ctx.getImageData(0, 0, SIZE, SIZE);
			const total = SIZE * SIZE;
			const INF = 1e10;

			// Build distance grid: 0 for non-transparent, INF for transparent
			const grid = new Float32Array(total);
			for (let i = 0; i < total; i++) {
				grid[i] = src.data[i * 4 + 3] > 0 ? 0 : INF;
			}

			edt2d(grid, SIZE, SIZE);

			// Paint outline using true Euclidean distance
			const outline = ctx.createImageData(SIZE, SIZE);
			for (let i = 0; i < total; i++) {
				const d = Math.sqrt(grid[i]);
				const pi = i * 4;
				if (d > 0 && d <= WHITE_W) {
					outline.data[pi] = 255;
					outline.data[pi + 1] = 255;
					outline.data[pi + 2] = 255;
					outline.data[pi + 3] = 255;
				} else if (d > WHITE_W && d <= PAD) {
					outline.data[pi] = 0;
					outline.data[pi + 1] = 0;
					outline.data[pi + 2] = 0;
					outline.data[pi + 3] = 255;
				}
			}

			ctx.clearRect(0, 0, SIZE, SIZE);
			ctx.putImageData(outline, 0, 0);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(img, sx, sy, sw, sh);

			// Crop canvas to tight bounding box of visible pixels
			const final_ = ctx.getImageData(0, 0, SIZE, SIZE);
			let minX = SIZE,
				minY = SIZE,
				maxX = 0,
				maxY = 0;
			for (let y = 0; y < SIZE; y++) {
				for (let x = 0; x < SIZE; x++) {
					if (final_.data[(y * SIZE + x) * 4 + 3] > 0) {
						if (x < minX) minX = x;
						if (x > maxX) maxX = x;
						if (y < minY) minY = y;
						if (y > maxY) maxY = y;
					}
				}
			}

			if (maxX >= minX && maxY >= minY) {
				const cropW = maxX - minX + 1;
				const cropH = maxY - minY + 1;
				const cropped = ctx.getImageData(minX, minY, cropW, cropH);
				canvas.width = cropW;
				canvas.height = cropH;
				ctx.putImageData(cropped, 0, 0);
			}
		};
		img.src = url;
	});
</script>

<div class="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-red-500 p-2">
	<canvas bind:this={canvas} class="h-full max-w-full" aria-label={label}></canvas>
</div>
