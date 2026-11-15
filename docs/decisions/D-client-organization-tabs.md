# Client organization tabs

The client organization dashboard stacked the worklist, budget, projects, the full invoice history and the spend chart on one long page. `/dash/org/<slug>` is now an overview, and the invoice list and the spend chart live on organization-level tabs, Invoices at `/dash/org/<slug>/invoices` and Spend by year at `/dash/org/<slug>/spend`, the same Overview / Invoices / Spend by year tabs the admin organization pages use. This supersedes the placement wording of [S-002](../specs/S-002-spend-by-year.md) R5, which puts the Spend section on the organization dashboard, and of [S-003](../specs/S-003-linked-invoice-work-context.md) R3, which names the organization dashboard's invoice table; both requirements now apply on their tabs, and the frozen specs stay unchanged.

**Consequences** — The overview keeps the budget's "Invoiced this year", which still equals the Spend by year tab's current-year total per S-002 R8.
