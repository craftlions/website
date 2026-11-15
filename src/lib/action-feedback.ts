import type { SafeResult } from "astro:actions";

// A success message for `ActionBanner`: plain text, or text plus one link to
// where the work continues.
export type BannerMessage =
	| string
	| { text: string; link?: { label: string; href: string } | undefined };

/**
 * A `results` entry whose success message is computed from the action's
 * returned data, e.g.
 * `successMessage(result, (client) => `${client.name} onboarded`)`.
 * The message is only built for a successful result, so `data` is typed and
 * present; the plain `[result, "text"]` form stays valid next to it.
 */
export const successMessage = <TData>(
	result: SafeResult<Record<string, unknown>, TData> | undefined,
	message: (data: TData) => BannerMessage,
) => [result, result && !result.error ? message(result.data) : ""] as const;

// What a successful `transitionPhase` did, by the state it moved to.
export const phaseTransitionMessage = {
	planned: "Phase sent to client",
	approved: "Approved for client",
	in_progress: "Work started",
	accepted: "Acceptance recorded for client",
	cancelled: "Phase cancelled",
} as const;

// What a successful `transitionProject` did, by the event it recorded.
export const projectTransitionMessage = {
	activated: "Project activated",
	completed: "Project completed",
	reopened: "Project reopened",
	archived: "Project archived",
} as const;

/**
 * Where the middleware sends the admin after a successful form action: the
 * action's data may name a `next` path (e.g. the project it just created).
 * Only a path on this origin is accepted; anything else returns undefined and
 * the middleware falls back to the page the form was posted from.
 */
export const nextPath = (data: unknown, url: URL) => {
	if (
		typeof data !== "object" ||
		data === null ||
		!("next" in data) ||
		typeof data.next !== "string" ||
		!data.next.startsWith("/")
	) {
		return undefined;
	}

	const next = new URL(data.next, url);

	return next.origin === url.origin
		? `${next.pathname}${next.search}${next.hash}`
		: undefined;
};
