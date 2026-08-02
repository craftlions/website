# D-uuidv7-primary-keys

Application tables use uuidv7 primary keys; the timestamp embedded in an id means row creation time and nothing else. Domain moments — when an invoice was issued, paid, due — live in dedicated columns, because back-stamping ids from domain dates overloads the key with business meaning and misdates rows recorded late (a December invoice recorded in January lands in the wrong year).

**Alternatives considered** — Deriving domain dates from ids (`getUuidV7Date`, import back-stamping via `uuidV7FromDate`): zero schema cost, but wrong at year boundaries and couples key generation to external data.

**Revisit when** — a table's row creation time and its domain moment provably always coincide.
