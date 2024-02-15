import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
	build: {
		inlineStylesheets: 'auto',
	},
	scopedStyleStrategy: 'class',
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
		optimizeHoistedScript: true,
	},
	i18n: {
		defaultLocale: 'en',
		locales: ['en', 'de'],
		fallback: {
			de: 'en',
		},
		routing: {
			prefixDefaultLocale: true,
			redirectToDefaultLocale: true,
			strategy: 'pathname',
		},
	},
	// markdown: {
	// 	shikiConfig: {

	// 	}
	// }
	integrations: [],
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
