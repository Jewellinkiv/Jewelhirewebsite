# JewelLink SSO session revalidation

JewelHire does not treat the eight-hour SSO cookie as continuing proof of
authorization. Every protected request first asks JewelLink to introspect the
authorization fingerprint stored in the signed, HttpOnly JewelHire session.

The request is a server-to-server `POST` to
`/api/integrations/jewelhire/sso/introspect`, authenticated with
`JEWELLINK_SSO_SHARED_SECRET` (the same high-entropy value named
`JEWELHIRE_SSO_SHARED_SECRET` in JewelLink). It carries only the upstream user
ID, MFA session ID, and opaque access fingerprint. The call is `no-store`, has a
three-second timeout, and has no positive cache.

Within one mutation handler, authorization helpers carry the already-validated
session through to audit/actor writes. This avoids stacking multiple upstream
timeouts for a single request while preserving next-request revocation (there
is still no cross-request positive cache).

JewelLink recomputes the fingerprint from the current user, credential epoch,
effective role, company, primary location, and accessible location IDs. A role
or scope change, account deactivation, company membership loss, company
pause/cancellation, rollout removal, malformed response, timeout, or upstream
error returns the user to sign-in on the next protected request. A fresh SSO
login then provisions the new least-privileged role and scope.

After that upstream check succeeds, JewelHire rebuilds the local projection but
accepts it only when it is a non-expanding subset of the role, store IDs, store
roles, and location scopes already signed into the session. Local manual scope
rows are excluded from the JewelLink projection, and a linked membership must
belong to the identity's current company. This prevents a local team-management
change from silently elevating an existing SSO cookie. The fingerprint, MFA
timestamps, and upstream session ID are omitted from `/api/me` and remain only
in the signed HttpOnly cookie and server-to-server request.

This validates the current authorization snapshot; it does not detect a user
clicking Logout in JewelLink. JewelLink currently has no durable per-session
revocation ledger. Account deactivation, credential/factor epoch changes, role
changes, membership changes, and company or location-scope changes are covered.

JewelLink must be released before the JewelHire version that requires
introspection. Existing pre-fingerprint SSO cookies are intentionally invalid
after the JewelHire release and require one fresh sign-in. Roll back JewelHire
before rolling back JewelLink.
