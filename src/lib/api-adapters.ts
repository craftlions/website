export const problem = (status: number, title: string, detail: string) =>
	new Response(
		JSON.stringify({
			type: "about:blank",
			title,
			status,
			detail,
		}),
		{ status, headers: { "Content-Type": "application/problem+json" } },
	);
