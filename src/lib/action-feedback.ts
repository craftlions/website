import type { SafeResult } from "astro:actions";

// A success message for `ActionBanner`: plain text, or text plus one link to
// where the work continues.
export type BannerMessage =
	| string
	| { text: string; link?: { label: string; href: string } | undefined };

/**
 * A `results` entry whose success message is computed from the action's
 * returned data, e.g.
 * `successMessage(result, (client) => `${client.name} onboarded.`)`.
 * The message is only built for a successful result, so `data` is typed and
 * present; the plain `[result, "text"]` form stays valid next to it.
 */
export const successMessage = <TData>(
	result: SafeResult<Record<string, unknown>, TData> | undefined,
	message: (data: TData) => BannerMessage,
) => [result, result && !result.error ? message(result.data) : ""] as const;

// Success messages are sentences ending in a period, the same on every page
// that reports the action.

// What a successful `transitionPhase` did, by the state it moved to.
export const phaseTransitionMessage = {
	planned: "Phase sent to client.",
	approved: "Approved for client.",
	in_progress: "Work started.",
	accepted: "Acceptance recorded for client.",
	cancelled: "Phase cancelled.",
} as const;

// What a successful `transitionProject` did, by the event it recorded.
export const projectTransitionMessage = {
	activated: "Project activated.",
	completed: "Project completed.",
	reopened: "Project reopened.",
	archived: "Project archived.",
} as const;

export const deliveryRecordedMessage =
	"Delivery recorded. The phase now awaits the client's acceptance.";

export const clientDeletedMessage = (client: { name: string }) =>
	`Client ${client.name} deleted.`;

/**
 * `path` as a redirect target on `url`'s origin, normalised; undefined when
 * it is not a root-relative path or resolves elsewhere. Parsing strips tabs
 * and newlines and reads backslashes as slashes, as browsers do, and the
 * result is checked after that: a pathname that still starts with `//` (from
 * `/.//host` or `/a/..//host`) would be read as another host in a Location
 * header, so it is refused too.
 */
export const sameOriginPath = (path: string, url: URL) => {
	if (!path.startsWith("/")) {
		return undefined;
	}

	const target = new URL(path, url);

	return target.origin === url.origin && !target.pathname.startsWith("//")
		? `${target.pathname}${target.search}${target.hash}`
		: undefined;
};

/**
 * Where the middleware sends the admin after a successful form action: the
 * action's data may name a `next` path (e.g. the project it just created).
 * Only a path on this origin is accepted (see `sameOriginPath`); anything else
 * returns undefined and the middleware falls back to the page the form was
 * posted from.
 */
export const nextPath = (data: unknown, url: URL) =>
	typeof data === "object" &&
	data !== null &&
	"next" in data &&
	typeof data.next === "string"
		? sameOriginPath(data.next, url)
		: undefined;
