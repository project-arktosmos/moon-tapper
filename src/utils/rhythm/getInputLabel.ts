export function getInputLabel(code: string): string {
	if (code.startsWith('Key')) return code.slice(3);
	if (code.startsWith('Digit')) return code.slice(5);
	if (code === 'Space') return '\u2423';
	if (code === 'ArrowLeft') return '\u2190';
	if (code === 'ArrowRight') return '\u2192';
	if (code === 'ArrowUp') return '\u2191';
	if (code === 'ArrowDown') return '\u2193';
	if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
	if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
	if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
	if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
	if (code.startsWith('GPBtn:')) return '\uD83C\uDFAE B' + code.slice(6);
	if (code.startsWith('GPAxis:')) return '\uD83C\uDFAE Ax' + code.slice(7);
	return code;
}
