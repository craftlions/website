# D-drive-access

Client files live in one private R2 bucket (`craftlions-website`, EU jurisdiction) that the Worker reaches through its `DRIVE` binding. The bucket has no public URL and no S3 credentials exist for it. A download is a Worker route that loads the `files` row with a query that also checks membership (`/dash`) or the admin role (`/admin`), and only then streams the object. A file another organization owns answers 404, as if it did not exist.

Keys are `org/<organization id>/<file id>`, made by the server. A filename never becomes part of a key, and an organization's objects share one prefix. Public ids are `file_` plus 12 characters: they are not secrets, but they do not tell an outsider that a file exists.

Uploads are admin only and go through the Worker in 16 MiB multipart parts, so a file of any size passes under the request body limit. An upload that stops is aborted by the page, and R2 removes incomplete multipart uploads after 7 days by default.

Files of types that browsers render as media (PDF, images, audio, video, plain text) open inline. Every other type downloads, and a response gets `nosniff` and a sandbox policy, so an uploaded HTML or SVG file never runs as a page of this site.

**Alternatives considered:** Presigned R2 URLs. They need S3 credentials as a new secret. Anyone who holds a link can use it until it expires, and removing a member does not end that access.

**Revisit when:** people without an account need a file, or clients upload. Both would need short-lived links signed by the Worker, and client uploads also need quotas and type checks.
