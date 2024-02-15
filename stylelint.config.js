// @ts-check

/** @type {import('stylelint').Config} */
export default {
	overrides: [
		{
			files: ['.astro'].flatMap((ext) => [`*${ext}`, `**/*${ext}`]),
			customSyntax: 'postcss-html',
		},
	],
	plugins: ['stylelint-order'],
	extends: ['stylelint-config-standard', 'stylelint-config-idiomatic-order'],
	rules: {},
};
