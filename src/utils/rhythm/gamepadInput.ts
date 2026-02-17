const AXIS_THRESHOLD = 0.7;

export interface GamepadInputState {
	prevButtons: boolean[][];
	prevAxes: (string | null)[][];
}

export function createGamepadInputState(): GamepadInputState {
	return { prevButtons: [], prevAxes: [] };
}

function getAxisDirection(value: number): string | null {
	if (value > AXIS_THRESHOLD) return '+';
	if (value < -AXIS_THRESHOLD) return '-';
	return null;
}

export function pollGamepadInputs(state: GamepadInputState): string[] {
	const pressed: string[] = [];
	const gamepads = navigator.getGamepads();

	for (let gi = 0; gi < gamepads.length; gi++) {
		const gp = gamepads[gi];
		if (!gp) continue;

		if (!state.prevButtons[gi]) {
			state.prevButtons[gi] = gp.buttons.map((b) => b.pressed);
			state.prevAxes[gi] = gp.axes.map(getAxisDirection);
			continue;
		}

		for (let bi = 0; bi < gp.buttons.length; bi++) {
			if (gp.buttons[bi].pressed && !state.prevButtons[gi][bi]) {
				pressed.push(`GPBtn:${bi}`);
			}
		}

		for (let ai = 0; ai < gp.axes.length; ai++) {
			const dir = getAxisDirection(gp.axes[ai]);
			const prevDir = state.prevAxes[gi]?.[ai] ?? null;
			if (dir !== null && dir !== prevDir) {
				pressed.push(`GPAxis:${ai}${dir}`);
			}
		}

		state.prevButtons[gi] = gp.buttons.map((b) => b.pressed);
		state.prevAxes[gi] = gp.axes.map(getAxisDirection);
	}

	return pressed;
}

export function getHeldGamepadInputs(): string[] {
	const held: string[] = [];
	const gamepads = navigator.getGamepads();

	for (const gp of gamepads) {
		if (!gp) continue;
		for (let bi = 0; bi < gp.buttons.length; bi++) {
			if (gp.buttons[bi].pressed) held.push(`GPBtn:${bi}`);
		}
		for (let ai = 0; ai < gp.axes.length; ai++) {
			const dir = getAxisDirection(gp.axes[ai]);
			if (dir !== null) held.push(`GPAxis:${ai}${dir}`);
		}
	}

	return held;
}
