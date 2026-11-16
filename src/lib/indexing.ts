// Sign-in, client, admin, and API routes are never useful search results, and
// the design reference stays out of search until /brand exists: the middleware
// sends these with `X-Robots-Tag: noindex`, Shell adds the meta tag that
// prerendered pages need, and the sitemap leaves them out.
const privatePaths = [
	"/admin",
	"/api",
	"/dash",
	"/settings",
	"/login",
	"/forgot-password",
	"/reset-password",
	"/brand/system",
];

export const isPrivatePath = (pathname: string) =>
	privatePaths.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);
