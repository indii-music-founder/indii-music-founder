# Phase 16 — RDR-RCC interoperability boundary

This slice adds the published RDR-RCC 1.0 serialization format (`TSV`) to the
canonical DDEX standards registry and supplies tested cell-level escaping,
record splitting, and complete-message framing. The existing adapter checks
the `CHEA`/`CFOO` envelope, record type consistency, fixed RCRR width, RTCR
party-group width, unique record IDs, and footer counts against physical lines.
It consults the registry so it does not claim RDR-RCC is XML or confuse RDR
Part 4 with an ECM Part 4.

RDR-RCC is a narrow DDEX protocol for a music licensing company to notify
claimants of over-claimed rights and for conflicting parties to respond. Its
response records can maintain, update, revoke, or report a pending claim. Those
are legally/business-significant choices. These helpers do not validate the
full DDEX profile or AVS membership, derive values from indii entity IDs,
change canonical rights claims, decide rights, sign, persist, upload, or
transmit anything. Parsed cells remain wire values; callers must preserve
source evidence and provenance and use an explicit, reviewed field mapping
before creating any canonical fact.

Full profile validation, partner/DPID setup, implementation-license approval,
and external message exchange remain separate gates. The release checklist
currently documents unresolved DDEX partner/license setup; this implementation
does not satisfy or bypass those gates.

References:

- [DDEX RDR-RCC standard overview](https://kb.ddex.net/implementing-each-standard/recording-data-and-rights-standards-%28rdr%29/recording-data-and-rights-claim-conflict-%28rdr-rcc%29)
- [RDR-RCC 1.0 message and record definitions](https://rdd-rcc.ddex.net/recording-data-and-rights-rights-claim-conflict/)
- [RDR-RCC 1.0 DDEX data dictionary](https://service.ddex.net/dd/DD-RDR-RCC-10/)
- [RDR-RCC 1.0 response record](https://rdd-rcc.ddex.net/recording-data-and-rights-rights-claim-conflict/9-record-type-definitions/9.4-rcrr-%E2%80%93-resource-conflict-response-record/)
- [RDR-RCC delimiter and escaping rules](https://rdd-rcc.ddex.net/recording-data-and-rights-rights-claim-conflict/8-message-definition/8.4-technical-details/8.4.3-delimiters/)
- [DDEX licensing guidance](https://kb.ddex.net/general-implementation-guidance/licensing-the-standards/)
