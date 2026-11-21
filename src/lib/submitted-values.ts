import type { SafeResult } from "astro:actions";

const secretName = /pass|secret|token|key|otp|credential/i;

export const submittedEntries = async (request: Pick<Request, "formData">) => {
	try {
		return [...(await request.formData())].flatMap(
			([name, value]): [name: string, value: string][] =>
				typeof value === "string" && !secretName.test(name)
					? [[name, value]]
					: [],
		);
	} catch {
		return undefined;
	}
};

export const submittedValues = (
	locals: App.Locals,
	result: SafeResult<Record<string, unknown>, unknown> | undefined,
) =>
	result?.error && locals.submittedInput
		? new URLSearchParams(locals.submittedInput)
		: undefined;

const optionTag = /<option\b[^>]*>/g;

const hasValue = (tag: string, values: readonly string[]) => {
	const match = tag.match(/\svalue(?:="([^"]*)")?(?=[\s/>])/);
	return (
		match !== null &&
		values.includes(
			(match[1] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
		)
	);
};

export const selectOptions = (html: string, values: readonly string[]) =>
	[...html.matchAll(optionTag)].some(([tag]) => hasValue(tag, values))
		? html.replace(optionTag, (tag) => {
				const unselected = tag.replace(
					/\sselected(?:="[^"]*")?(?=[\s/>])/g,
					"",
				);
				return hasValue(unselected, values)
					? unselected.replace(/\/?>$/, " selected>")
					: unselected;
			})
		: html;
