# D-drive-access

Client files live in one private R2 bucket (`craftlions-website`, EU jurisdiction) that the Worker reaches through its `DRIVE` binding. The bucket has no public URL and no S3 credentials exist for it. A download is a Worker route that loads the `files` row and only then streams the object. Under `/dash` the query itself checks that the caller is a member of the file's organization; a file another organization owns answers 404, as if it did not exist. Under `/admin` the middleware lets only admins in, and the route then only matches the file to the organization in the URL, so it is not safe to reuse outside that gate.

Keys are `org/<organization id>/<file id>`, made by the server. A filename never becomes part of a key, and an organization's objects share one prefix. Public ids are `file_` plus 12 characters: they are not secrets, but they do not tell an outsider that a file exists.

Uploads are admin only and go through the Worker in 16 MiB multipart parts, so a large file passes under the request body limit. R2 takes at most 10,000 parts, so one file holds up to about 167.8 GB (156 GiB); the upload form refuses a larger file before it sends anything. An upload that stops is aborted by the page, and R2 removes incomplete multipart uploads after 7 days by default.

Only the types in the `inlineTypes` allowlist in `src/lib/files.ts` open inline: PDF, MP3, Ogg and WAV audio, AVIF, GIF, JPEG, PNG and WebP images, plain text, and MP4 and WebM video. Every other type downloads, SVG, HTML and CSV included. Every response gets `nosniff`, and every type but PDF gets a sandbox policy, so an uploaded file never runs as a page of this site. A PDF gets only `frame-ancestors 'self'`, because Chromium's PDF viewer does not open in a sandboxed document; a PDF runs no script of this site's origin.

**Alternatives considered:** Presigned R2 URLs. They need S3 credentials as a new secret. Anyone who holds a link can use it until it expires, and removing a member does not end that access.

**Revisit when:** people without an account need a file, or clients upload. Both would need short-lived links signed by the Worker, and client uploads also need quotas and type checks.
