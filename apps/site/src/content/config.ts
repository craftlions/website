import { defineCollection, z } from 'astro:content';

// schema: z.object({
//   title: z.string(),
//   tags: z.array(z.string()),
//   image: z.string().optional(),
// }),

const tierCollection = defineCollection({
	type: 'data',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		order: z.number(),
		price: z.number().safe().nullable(),
		isActive: z.boolean(),
		benefits: z.object({
			'Number of concurrent requests': z.number(),
			'Number of concurrent active projects': z.string(),
			'Average time to response': z.string(),
			'Included logins': z.string(),
			'Ticket triage': z.string(),
			'Technical advisory': z.string(),
			'Pull-Request reviews': z.string(),
			Consulting: z.string(),
			Coding: z.string(),
			'Refer & Earn': z.string(),
			'Pause your subscription': z.string(),
			'Cancel notice period': z.string(),
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
	tiers: tierCollection,
	faqs: faqCollection,
};
