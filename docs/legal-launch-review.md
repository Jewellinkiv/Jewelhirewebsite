# Legal Launch Review

The application now publishes versioned Privacy Policy and Terms of Service pages, requires explicit
acceptance for public applications and both signup paths, and stores acceptance evidence in
`legal_consents` via migration `0012_legal_consents.sql`.

Before broad launch, the product owner and qualified counsel should verify:

- the operating legal entity and public contact information;
- applicable governing-law, dispute, subscription, refund, and cancellation terms;
- employment-screening and anti-discrimination disclosures for every launch jurisdiction;
- data retention/deletion periods and the process for privacy requests;
- subprocessors and cross-border processing disclosures;
- accessibility requirements and any age restrictions;
- whether any state-specific applicant notice or consent language is required.

The current policy contact is `william@jewellink.com`. Replace it before launch if a dedicated,
monitored privacy/support address is available.
