const viewport = { min: 320, max: 1280 };

const type = {
	base: 16,
	ratio: { min: 1.125, max: 1.25 },
	steps: [3, 2, 1, 0],
	fixed: { "-1": 14, "-2": 12 },
};

const space = {
	fixed: { "3xs": 4, "2xs": 8, xs: 12 },
	base: { min: 14, max: 18 },
	steps: { s: 1, m: 1.5, l: 2, xl: 3, "2xl": 4, "3xl": 6 },
	pairs: [
		["s", "m"],
		["m", "l"],
		["l", "xl"],
		["xl", "2xl"],
	],
};

const round = (number) => Math.round(number * 10_000) / 10_000;

const token = (name, min, max) => {
	const slope = (max - min) / (viewport.max - viewport.min);
	const scale = {
		min: round(min / 16),
		intercept: round((min - slope * viewport.min) / 16),
		slope: round(slope * 100),
		max: round(max / 16),
	};
	return {
		name,
		...scale,
		value:
			min === max
				? `${scale.min}rem`
				: `clamp(${scale.min}rem, ${scale.intercept}rem + ${scale.slope}vw, ${scale.max}rem)`,
	};
};

const spaceSteps = Object.entries(space.steps).map(([name, factor]) => ({
	name,
	min: space.base.min * factor,
	max: space.base.max * factor,
}));

export const tokens = [
	...type.steps.map((step) =>
		token(
			`step-${step}`,
			type.base * type.ratio.min ** step,
			type.base * type.ratio.max ** step,
		),
	),
	...Object.entries(type.fixed).map(([step, size]) =>
		token(`step-${step}`, size, size),
	),
	...Object.entries(space.fixed).map(([name, size]) =>
		token(`space-${name}`, size, size),
	),
	...spaceSteps.map(({ name, min, max }) => token(`space-${name}`, min, max)),
	...space.pairs.map(([from, to]) =>
		token(
			`space-${from}-${to}`,
			spaceSteps.find(({ name }) => name === from)?.min ?? 0,
			spaceSteps.find(({ name }) => name === to)?.max ?? 0,
		),
	),
];

export const px = ({ min, intercept, slope, max }, width, root = 16) =>
	Math.min(
		max * root,
		Math.max(min * root, intercept * root + (slope * width) / 100),
	);

export const range = (token) =>
	[
		...new Set(
			[viewport.min, viewport.max].map(
				(width) => Math.round(px(token, width) * 100) / 100,
			),
		),
	]
		.map((size) => `${size}px`)
		.join(" → ");

if (import.meta.main) {
	console.log(
		tokens.map(({ name, value }) => `--${name}: ${value};`).join("\n"),
	);
}
