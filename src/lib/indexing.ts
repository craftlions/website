// Sign-in, client, admin, and API routes are never useful search results:
// the middleware sends them with `X-Robots-Tag: noindex` and the sitemap
// leaves them out.
const privatePaths = [
	"/admin",
	"/api",
	"/dash",
	"/settings",
	"/login",
	"/forgot-password",
	"/reset-password",
];

export const isPrivatePath = (pathname: string) =>
	privatePaths.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);
