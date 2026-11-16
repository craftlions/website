import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { isPrivatePath } from "./src/lib/indexing.ts";

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
		contentIntellisense: true,
	},
	prefetch: {
		prefetchAll: true,
		defaultStrategy: "hover",
	},
	integrations: [
		sitemap({
			filter: (page) => !isPrivatePath(new URL(page).pathname),
		}),
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
					browserslist("baseline widely available"),
				),
			},
		},
		build: {
			minify: false,
			cssMinify: false,
		},
	},
});
