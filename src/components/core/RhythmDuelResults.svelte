<script lang="ts">
	import classNames from 'classnames';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { RhythmGameState, DuelWinner } from '$types/rhythm.type';
	import { beatsaverAdapter } from '$adapters/classes/beatsaver.adapter';

	interface Props {
		player1State: RhythmGameState;
		player2State: RhythmGameState;
		winner: DuelWinner;
		songName?: string;
		difficulty?: string;
		onplayAgain?: () => void;
		onbrowse?: () => void;
	}

	let {
		player1State,
		player2State,
		winner,
		songName = '',
		difficulty = '',
		onplayAgain,
		onbrowse
	}: Props = $props();

	let p1Grade = $derived(beatsaverAdapter.calculateGrade(player1State.perfect, player1State.good, player1State.miss));
	let p2Grade = $derived(beatsaverAdapter.calculateGrade(player2State.perfect, player2State.good, player2State.miss));

	let p1Total = $derived(player1State.perfect + player1State.good + player1State.miss);
	let p2Total = $derived(player2State.perfect + player2State.good + player2State.miss);
	let p1Accuracy = $derived(p1Total > 0 ? Math.round(((player1State.perfect + player1State.good * 0.5) / p1Total) * 100) : 0);
	let p2Accuracy = $derived(p2Total > 0 ? Math.round(((player2State.perfect + player2State.good * 0.5) / p2Total) * 100) : 0);

	const gradeColors: Record<string, string> = {
		S: 'text-warning',
		A: 'text-success',
		B: 'text-info',
		C: 'text-primary',
		D: 'text-error'
	};

	const winnerLabels: Record<DuelWinner, string> = {
		player1: 'Player 1 Wins!',
		player2: 'Player 2 Wins!',
		draw: 'Draw!'
	};
</script>

<div class="mx-auto flex max-w-2xl flex-col items-center gap-6 py-8">
	<h2 class="text-2xl font-bold">Duel Results</h2>

	{#if songName}
		<p class="text-lg opacity-70">{songName} — {difficulty}</p>
	{/if}

	<!-- Winner banner -->
	<div class={classNames('text-3xl font-black', {
		'text-warning': winner !== 'draw',
		'text-base-content': winner === 'draw'
	})}>
		{winnerLabels[winner]}
	</div>

	<!-- Player cards -->
	<div class="flex w-full gap-4">
		<!-- Player 1 -->
		<div class={classNames(
			'card flex-1 bg-base-100 shadow-lg',
			{ 'border-2 border-warning': winner === 'player1' }
		)}>
			<div class="card-body items-center p-4">
				<h3 class="card-title text-sm uppercase tracking-wide opacity-60">Player 1</h3>
				<div class={classNames('text-6xl font-black', gradeColors[p1Grade] || 'text-base-content')}>
					{p1Grade}
				</div>
				<div class="text-2xl font-bold tabular-nums">{player1State.score.toLocaleString()}</div>
				<div class="mt-2 flex w-full flex-col gap-1 text-sm">
					<div class="flex justify-between">
						<span class="opacity-60">Perfect</span>
						<span class="font-semibold text-warning">{player1State.perfect}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Good</span>
						<span class="font-semibold text-success">{player1State.good}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Miss</span>
						<span class="font-semibold text-error">{player1State.miss}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Max Combo</span>
						<span class="font-semibold">{player1State.maxCombo}x</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Accuracy</span>
						<span class="font-semibold">{p1Accuracy}%</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Player 2 -->
		<div class={classNames(
			'card flex-1 bg-base-100 shadow-lg',
			{ 'border-2 border-warning': winner === 'player2' }
		)}>
			<div class="card-body items-center p-4">
				<h3 class="card-title text-sm uppercase tracking-wide opacity-60">Player 2</h3>
				<div class={classNames('text-6xl font-black', gradeColors[p2Grade] || 'text-base-content')}>
					{p2Grade}
				</div>
				<div class="text-2xl font-bold tabular-nums">{player2State.score.toLocaleString()}</div>
				<div class="mt-2 flex w-full flex-col gap-1 text-sm">
					<div class="flex justify-between">
						<span class="opacity-60">Perfect</span>
						<span class="font-semibold text-warning">{player2State.perfect}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Good</span>
						<span class="font-semibold text-success">{player2State.good}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Miss</span>
						<span class="font-semibold text-error">{player2State.miss}</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Max Combo</span>
						<span class="font-semibold">{player2State.maxCombo}x</span>
					</div>
					<div class="flex justify-between">
						<span class="opacity-60">Accuracy</span>
						<span class="font-semibold">{p2Accuracy}%</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex gap-3">
		<Button
			label="Play Again"
			color={ThemeColors.Primary}
			size={ThemeSizes.Medium}
			on:click={() => onplayAgain?.()}
		/>
		<Button
			label="Back to Browse"
			color={ThemeColors.Neutral}
			outline
			size={ThemeSizes.Medium}
			on:click={() => onbrowse?.()}
		/>
	</div>
</div>
