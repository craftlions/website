# Budget consumption definition

Product surfaces currently derive “budget used” from incompatible scopes: all phase costs, open invoices, or current-year invoices. “Budget used” means the organization’s invoice total for the current calendar year divided by its yearly budget everywhere, using the invoice scope established by S-002: grouped by `invoicedAt`, with void and uncollectible invoices excluded. Surface-specific definitions are rejected because admins and clients need the same figure without cross-checking another view.
