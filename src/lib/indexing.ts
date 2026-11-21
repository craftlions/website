const privatePaths = [
	"/admin",
	"/api",
	"/dash",
	"/settings",
	"/login",
	"/forgot-password",
	"/reset-password",
	"/brand",
];

export const isPrivatePath = (pathname: string) =>
	privatePaths.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);
