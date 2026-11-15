import type { SafeResult } from "astro:actions";

// Typed input survives a failed form action. The middleware stores the
// submitted fields next to the action result in one session entry (same
// lifetime) and hands them to the page in `Astro.locals.submittedInput`
// (both typed in src/env.d.ts); `Field` and pages read them back through
// `submittedValues`.

// Field names that may hold a secret are never stored.
const secretName = /pass|secret|token|key|otp|credential/i;

/**
 * The text fields of a form submission, for storing with a failed result.
 * File inputs and fields whose name suggests a secret are left out. Returns
 * undefined when the body is not form data.
 */
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

/**
 * The values submitted with `result`, when that action failed on the
 * previous request; otherwise undefined. A request carries at most one
 * action result, so a failed `result` is always the submission stored.
 *
 * Use `.get(name)` for one value and `.getAll(name)` for repeated names:
 * `submittedValues(Astro.locals, result)?.get("phaseId") === phase.id` tells
 * which of many rows posting the same action failed.
 */
export const submittedValues = (
	locals: App.Locals,
	result: SafeResult<Record<string, unknown>, unknown> | undefined,
) =>
	result?.error && locals.submittedInput
		? new URLSearchParams(locals.submittedInput)
		: undefined;

const optionTag = /<option\b[^>]*>/g;

// Whether a rendered `<option>` tag has one of `values` as its value
// attribute. Astro renders an empty value as a bare `value` and escapes `&`
// and `"`; an option without the attribute never matches.
const hasValue = (tag: string, values: readonly string[]) => {
	const match = tag.match(/\svalue(?:="([^"]*)")?(?=[\s/>])/);
	return (
		match !== null &&
		values.includes(
			(match[1] ?? "").replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
		)
	);
};

/**
 * Moves `selected` in rendered `<option>` HTML to the options whose value is
 * in `values`. Leaves the HTML as it is when no option matches, so a value
 * that no longer exists keeps the page's own default.
 */
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
