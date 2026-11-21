import type { SafeResult } from "astro:actions";

export type BannerMessage =
	| string
	| { text: string; link?: { label: string; href: string } | undefined };

export const successMessage = <TData>(
	result: SafeResult<Record<string, unknown>, TData> | undefined,
	message: (data: TData) => BannerMessage,
) => [result, result && !result.error ? message(result.data) : ""] as const;

export const phaseTransitionMessage = {
	planned: "Phase sent to client.",
	approved: "Approved for client.",
	in_progress: "Work started.",
	accepted: "Acceptance recorded for client.",
	cancelled: "Phase cancelled.",
} as const;

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

export const sameOriginPath = (path: string, url: URL) => {
	if (!path.startsWith("/")) {
		return undefined;
	}

	const target = new URL(path, url);

	return target.origin === url.origin && !target.pathname.startsWith("//")
		? `${target.pathname}${target.search}${target.hash}`
		: undefined;
};

export const nextPath = (data: unknown, url: URL) =>
	typeof data === "object" &&
	data !== null &&
	"next" in data &&
	typeof data.next === "string"
		? sameOriginPath(data.next, url)
		: undefined;
