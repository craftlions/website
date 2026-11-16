// WCAG 2.2 contrast of the role tokens against the requirements in the DESIGN.md
// `contrast:` map, shared by `aubr design:lint`, which fails below a minimum,
// and the design reference at /brand/system. Node runs this file directly, so
// it uses only erasable TypeScript.

export type Token = { name: string; light: string; dark: string };

export const parseTokens = (css: string): Token[] =>
	[...css.matchAll(/--([\w-]+): light-dark\((#\w+), (#\w+)\)/g)].map(
		([, name = "", light = "", dark = ""]) => ({ name, light, dark }),
	);

// A token's requirement from the DESIGN.md `contrast:` map: a minimum ratio on
// the listed surfaces, a surface itself, or exempt because it is decorative.
export type Requirement = { min: number; on: string[] } | "surface" | "exempt";

export const parseContrast = (designMd: string) =>
	new Map<string, Requirement>(
		[
			...((designMd.split("---\n")[1] ?? "")
				.split(/^contrast:\n/m)[1]
				?.split(/^\S/m)[0]
				?.matchAll(
					/^ {2}([\w-]+): (?:\{ min: ([\d.]+), on: \[([^\]]*)\] \}|(surface|exempt))$/gm,
				) ?? []),
		].map(([, name = "", min, on = "", kind]) => [
			name,
			kind === "surface" || kind === "exempt"
				? kind
				: { min: Number(min), on: on.split(", ") },
		]),
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

// Every token's ratios in one scheme: on the surfaces its requirement names, or
// on canvas and panel for an exempt token, which are shown but never fail. A
// translucent surface is measured as it appears over canvas.
export const contrastChecks = (
	tokens: Token[],
	requirements: Map<string, Requirement>,
	scheme: "light" | "dark",
) => {
	const value = (name: string) =>
		tokens.find((token) => token.name === name)?.[scheme] ?? "#000000";
	return tokens.map((token) => {
		const requirement = requirements.get(token.name);
		return {
			name: token.name,
			value: token[scheme],
			minimum: typeof requirement === "object" ? requirement.min : undefined,
			checks:
				requirement === "surface"
					? []
					: (typeof requirement === "object"
							? requirement.on
							: ["canvas", "panel"]
						).map((surface) => ({
							surface,
							ratio: contrast(
								token[scheme],
								flatten(value(surface), value("canvas")),
							),
						})),
		};
	});
};
