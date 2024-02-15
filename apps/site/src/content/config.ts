import { defineCollection, z } from 'astro:content';

// schema: z.object({
//   title: z.string(),
//   tags: z.array(z.string()),
//   image: z.string().optional(),
// }),

const featureCollection = defineCollection({
	type: 'data',
	schema: z.object({
		title: z.string(),
		help: z.string(),
		map: z.object({
			lite: z.boolean(),
			plus: z.boolean(),
			pro: z.boolean(),
		}),
	}),
});

const faqCollection = defineCollection({
	type: 'data',
	schema: z.object({
		category: z.string(),
		position: z.number(),
		question: z.string(),
		answer: z.string(),
	}),
});

export const collections = {
	features: featureCollection,
	faqs: faqCollection,
};
