// WCAG 2.2 contrast of the role tokens, as the design reference at
// /brand/system shows it.

export type Token = { name: string; light: string; dark: string };

export const parseTokens = (css: string): Token[] =>
	[...css.matchAll(/--([\w-]+): light-dark\((#\w+), (#\w+)\)/g)].map(
		([, name = "", light = "", dark = ""]) => ({ name, light, dark }),
	);

const channels = (hex: string) =>
	[1, 3, 5, 7].map((start) =>
		Number.parseInt(hex.slice(start, start + 2) || "ff", 16),
	) as [number, number, number, number];

// A translucent color as it appears over an opaque background, as #rrggbb.
export const flatten = (hex: string, background: string) => {
	const [red, green, blue, alpha] = channels(hex);
	const base = channels(background);
	return `#${[red, green, blue]
		.map((channel, index) =>
			Math.round(
				channel * (alpha / 255) + (base[index] ?? 0) * (1 - alpha / 255),
			)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
};

const luminance = (hex: string) => {
	const [red = 0, green = 0, blue = 0] = channels(hex)
		.slice(0, 3)
		.map((channel) => {
			const value = channel / 255;
			return value <= 0.04045
				? value / 12.92
				: ((value + 0.055) / 1.055) ** 2.4;
		});
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

// The ratio of a token over an opaque surface; a translucent token is measured
// as it appears there.
export const contrast = (hex: string, surface: string) => {
	const [lighter = 0, darker = 0] = [
		luminance(flatten(hex, surface)),
		luminance(surface),
	].sort((a, b) => b - a);
	return (lighter + 0.05) / (darker + 0.05);
};
