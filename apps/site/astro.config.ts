import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	build: {
		inlineStylesheets: 'auto',
	},
	scopedStyleStrategy: 'attribute',
	base: '/',
	devToolbar: {
		enabled: true,
	},
	site: 'https://nbhr.io/',
	prefetch: {
		prefetchAll: false,
		defaultStrategy: 'hover',
	},
	experimental: {
		clientPrerender: true,
		globalRoutePriority: true,
		contentCollectionJsonSchema: true,
	},
	// i18n: {
	// 	defaultLocale: 'en',
	// 	locales: ['en', 'de'],
	// 	fallback: {
	// 		de: 'en',
	// 	},
	// 	routing: {
	// 		prefixDefaultLocale: true,
	// 		redirectToDefaultLocale: false,
	// 		strategy: 'pathname',
	// 	},
	// },
	// markdown: {
	// 	shikiConfig: {

	// 	}
	// }
	integrations: [
		icon({
			include: {
				ph: [
					'map-pin-duotone',
					'translate-duotone',
					'clock-duotone',
					'calendar-dots-duotone',
					'download-duotone',
					'plus-bold',
					'currency-dollar-duotone',
					'twitter-logo-fill',
					'linkedin-logo-fill',
				],
				solar: [
					'stars-minimalistic-line-duotone',
					'double-alt-arrow-right-line-duotone',
					'infinity-bold-duotone',
					'scale-bold-duotone',
					'dollar-line-duotone',
					'heart-line-duotone',
					'globus-line-duotone',
					'users-group-rounded-line-duotone',
					'stars-line-line-duotone',
					'settings-line-duotone',
					'close-circle-line-duotone',
					'check-circle-bold',
					'question-circle-bold-duotone',
				],
				octicon: ['mark-github-24'],
				'vscode-icons': ['file-type-astro', 'file-type-typescript-official'],
				'fluent-emoji': ['green-circle'],
				'emojione-monotone': ['lion-face'],
			},
		}),
		react(),
	],
	output: 'server',
	adapter: cloudflare({
		imageService: 'passthrough',
	}),
	vite: {
		css: {
			transformer: 'lightningcss',
			lightningcss: {
				drafts: {
					customMedia: true,
				},
			},
		},
		build: {
			minify: false,
			cssMinify: false,
		},
	},
});
