export type GamepadCaptureCallback = (code: string) => void;

export function startGamepadCapture(onCapture: GamepadCaptureCallback): () => void {
	let running = true;
	let prevButtons: boolean[][] = [];

	function poll() {
		if (!running) return;

		const gamepads = navigator.getGamepads();
		for (let gi = 0; gi < gamepads.length; gi++) {
			const gp = gamepads[gi];
			if (!gp) continue;

			if (!prevButtons[gi]) {
				prevButtons[gi] = gp.buttons.map((b) => b.pressed);
				continue;
			}

			for (let bi = 0; bi < gp.buttons.length; bi++) {
				const pressed = gp.buttons[bi].pressed;
				if (pressed && !prevButtons[gi][bi]) {
					onCapture(`GPBtn:${bi}`);
					running = false;
					return;
				}
			}

			for (let ai = 0; ai < gp.axes.length; ai++) {
				const val = gp.axes[ai];
				if (Math.abs(val) > 0.7) {
					const dir = val > 0 ? '+' : '-';
					onCapture(`GPAxis:${ai}${dir}`);
					running = false;
					return;
				}
			}

			prevButtons[gi] = gp.buttons.map((b) => b.pressed);
		}

		requestAnimationFrame(poll);
	}

	requestAnimationFrame(poll);
	return () => {
		running = false;
	};
}
