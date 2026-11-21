import { drizzle } from "drizzle-orm/postgres/cf";
import { relations } from "./relations.ts";

export function createDb(env: Cloudflare.Env) {
	return drizzle({
		connection: env.HYPERDRIVE.connectionString,
		relations: relations,
	});
}

export type Db = ReturnType<typeof createDb>;

type Settled = PromiseFulfilledResult<unknown> | PromiseRejectedResult;

export function fulfilled<T extends readonly Settled[]>(
	results: T,
): {
	-readonly [K in keyof T]: Extract<T[K], { status: "fulfilled" }>["value"];
} {
	const rejected = results.find(
		(result): result is PromiseRejectedResult => result.status === "rejected",
	);
	if (rejected) throw rejected.reason;
	return results.map(
		(result) => (result as PromiseFulfilledResult<unknown>).value,
	) as never;
}
