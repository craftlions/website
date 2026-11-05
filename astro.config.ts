import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

export default defineConfig({
	site: "https://craftlions.com",
	output: "server",
	adapter: cloudflare({
		imageService: { build: "compile", runtime: "cloudflare-binding" },
	}),
	cache: {
		provider: cacheCloudflare(),
	},
	compressHTML: "jsx",
	experimental: {
		clientPrerender: true,
		contentIntellisense: true,
	},
	prefetch: {
		defaultStrategy: "hover",
	},
	integrations: [
		sitemap(),
		{
			// Registered only in dev so production never contains the page.
			name: "design-page",
			hooks: {
				"astro:config:setup": ({ command, injectRoute }) => {
					if (command === "dev") {
						injectRoute({
							pattern: "/design",
							entrypoint: "./src/pages/_design.astro",
						});
					}
				},
			},
		},
	],
	devToolbar: {
		enabled: false,
	},
	markdown: {
		processor: satteri({
			features: {
				frontmatter: true,
				gfm: true,
			},
		}),
	},
	vite: {
		css: {
			transformer: "lightningcss",
			lightningcss: {
				targets: browserslistToTargets(
					browserslist([
						"> 0.5%",
						"last 2 versions",
						"Firefox ESR",
						"not dead",
						"cover 80% in CN",
						"unreleased versions",
					]),
				),
			},
		},
		build: {
			minify: false,
			cssMinify: false,
		},
		plugins: [tailwindcss()],
	},
});
