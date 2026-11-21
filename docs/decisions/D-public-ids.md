# Public identifiers

URL-visible identifiers (`publicId` in `src/lib/public-id.ts`) combine a resource prefix and 6 random characters (12 for drive files) drawn from lowercase `nolookalikesSafe`. They are not secrets: authorization is always enforced by the query that loads the row.

Because 6-character random identifiers can collide, inserts (`insertWithPublicId`) target `ON CONFLICT (public_id) DO NOTHING` and retry with a new identifier so a collision keeps the surrounding database transaction usable instead of aborting it.

**Alternatives considered:** Exposing raw UUIDv7 primary keys in URLs, or pre-checking uniqueness with a `SELECT`. Raw UUIDs make URLs long and expose row creation timestamps; pre-checking still races under concurrency.
