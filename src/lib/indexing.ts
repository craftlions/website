// Sign-in, client, admin, and API routes are never useful search results, and
// the component specimen stays out of search as an unlisted page: the middleware
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
	// /brand and the specimen below it, until /brand holds the owner's content;
	// "/brand/specimen" then publishes /brand alone.
	"/brand",
];

export const isPrivatePath = (pathname: string) =>
	privatePaths.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);
