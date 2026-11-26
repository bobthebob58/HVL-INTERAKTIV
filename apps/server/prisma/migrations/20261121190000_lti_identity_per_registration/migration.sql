-- Security repairs, step 13 (D-129): a Canvas user's identity text names the platform registration (issuer and
-- client ID), not the issuer alone, so `Identity.subjectHash` of a Canvas launch is now made from
-- `lti|<iss>|<client-id>|<sub>` (DATA-002, LTI-001).
--
-- WHY: a hash of the earlier text can never match a launch again. Left in place, such a row on a Feide account
-- would count as another person's identity from the same platform when that teacher's Canvas identity is linked
-- anew (AUTH-005, D-063). Only test data existed when the text changed (D-129), so the rows are removed. The
-- accounts stay: a learner's account without an identity goes with the yearly purge (DATA-003), and Feide
-- identities are not touched. No table or column changes.

DELETE FROM "Identity" WHERE "provider" = 'lti';
