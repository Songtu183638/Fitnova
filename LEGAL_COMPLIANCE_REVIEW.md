# FITNOVA — Legal and privacy launch review

Review date: 2026-11-17  
Scope: current repository code and draft policy pages for a South Korea-based individual operator planning a U.S. Google Play release.

> This is an engineering readiness review, not legal advice or a certification of compliance. Do not publish the draft policies as final until the operator has checked the real hosting, data flows, retention, and applicable laws with qualified counsel.

## Implemented in this code review

- Sign-up now requires separate user actions for minimum-age confirmation, acceptance of the Terms of Service, and acknowledgement of the Privacy Policy.
- The API rejects registration if any of those three items is missing.
- The API records the acceptance/acknowledgement timestamps and policy version identifiers with the pending registration and verified account.
- Account-deletion cleanup now also removes workout analysis records, authored comments, comment likes, notifications, blocks/mutes, report records associated with the deleted account, and account-related authentication challenges, in addition to posts, DMs, follows, push tokens and settings.
- DM conversation refresh now merges recent local outgoing messages with server results instead of replacing the message list blindly. Polling is paused while a send is in progress.

The policy version identifiers are currently 2026-11-17. Increase them whenever the corresponding policy is materially changed. Existing accounts do not have retroactive acceptance records.

## Launch blockers — must be completed by the operator

### 1. Finalize the privacy policy against the actual service

The repository policy page is deliberately marked as a draft. Do not remove that warning or claim the policy is final until all items below are verified.

- [ ] Confirm every collected field and source: account/email, password hash, profile, posts, photos/videos, workout records, step/activity sensor data, DMs, reports, push tokens, access/security logs, and any analytics/advertising identifiers.
- [ ] Confirm whether GPS/location is actually collected, when it is collected, whether it is stored, and whether it is shared. Do not describe GPS collection as absent unless verified in the shipped build.
- [ ] Identify each actual provider and legal entity: web hosting, API hosting, database, object/media storage, email delivery, push notifications, crash/analytics tools, and any other SDK.
- [ ] For each provider, document its purpose, data categories, processing country/region, retention, subprocessors, and whether it acts as a processor or independent controller.
- [ ] Determine the lawful basis and required notice/consent mechanism for each transfer outside Korea. Korea's Personal Information Protection Act Article 28-8 regulates overseas transfers; Article 30 sets privacy-policy disclosure requirements.
- [ ] Define retention periods for security/access logs, reports/moderation evidence, email challenges, backups, and deleted-account data. The current code uses 10-minute verification challenges and a 30-day account-deletion grace period; other retention periods must not be guessed.
- [ ] Name the privacy contact/responsible person and confirm that fitnova@naver.com is monitored and requests are handled.
- [ ] Set a real effective date, version history, and change-notice process.

### 2. Account deletion and user rights

- [ ] Test the in-app deletion flow and external /delete-account page from a clean device and a logged-out browser.
- [ ] Enter the exact external deletion URL in Google Play Console.
- [ ] Confirm that the external request channel is actually monitored and that identity verification does not ask users to send passwords or one-time codes.
- [ ] Verify the 30-day grace period and background purge in the production database, including posts, comments, likes, DMs, workout analysis, notifications, reports, push tokens, blocks/mutes, authentication challenges and backups.
- [ ] Confirm whether a 30-day deactivation period meets the current Google Play account-deletion requirement for this app. Google says freezing/deactivating an account alone is not deletion; retained data needs a legitimate reason and clear disclosure.
- [ ] Provide a workable process for access, correction, deletion, and processing-restriction requests; document identity checks and response ownership.

### 3. User-generated content and safety

- [ ] Keep the Terms and Community Guidelines accessible before sign-up and from Settings.
- [ ] Maintain in-app reporting for public posts and accounts, and blocking for direct interactions. Test report receipt, admin review, removal/suspension, and block enforcement with two real accounts.
- [ ] Define a real moderation response process: who checks reports, how often, evidence handling, urgent threats, repeat offenders, appeals, and target response times.
- [ ] Review whether comments and individual direct messages need their own report actions in addition to post/account reporting.
- [ ] Keep moderation records only for a defined, disclosed period and restrict access to the operator/admin.

### 4. U.S. launch: minors, privacy and copyright

- [ ] FITNOVA currently states a minimum age of 14 and uses self-declared age confirmation. This is not age verification. COPPA applies to child-directed services and services with actual knowledge that they collect personal information from children under 13; a 14+ checkbox alone does not settle every U.S. state teen-privacy or age-assurance requirement.
- [ ] Decide, with U.S. counsel, which states and age groups will be supported at launch and whether additional parental consent, age assurance, teen defaults, or feature restrictions are required.
- [ ] Create and operate a copyright complaint/takedown and counter-notice process. If relying on the U.S. DMCA safe-harbor framework, designate and register a DMCA agent with the U.S. Copyright Office; an ordinary support email is not the same as that registration.
- [ ] Keep the fitness disclaimer: workout logs and estimates are not medical advice, diagnosis, or a substitute for professional care. Avoid medical or guaranteed-result claims in store listings and marketing.

### 5. Google Play and production operations

- [ ] Complete the Data safety form from the shipped binary and actual SDK/network behavior, including user content, photos/videos, DMs, email, push tokens, activity recognition/step data, and location if collected.
- [ ] Complete the content rating and app-access declarations accurately.
- [ ] Verify the privacy policy and account-deletion URLs are publicly reachable over HTTPS and are the same URLs entered in Play Console.
- [ ] Review all third-party SDK/provider privacy terms and their data practices; developers remain responsible for SDK behavior under Google Play policy.
- [ ] Establish an incident-response plan, database backup/restore test, administrator access controls, secret rotation, and a process for handling personal-data breach reports and legal requests.
- [ ] Test deletion, report/block, data access, and push-token removal against the production-like database before launch.

## Official references

- Korea Personal Information Protection Act, Article 28-8 (overseas transfers): https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334953
- Korea Personal Information Protection Act, Article 30 (privacy policy): https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=248613
- Korea 2026 Privacy Policy Guidelines: https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20885
- Google Play account deletion requirement: https://support.google.com/googleplay/android-developer/answer/18265346
- Google Play UGC policy: https://support.google.com/googleplay/android-developer/answer/9876937
- FTC COPPA guidance: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- U.S. Copyright Office DMCA Designated Agent Directory: https://copyright.gov/dmca-directory/
- California CCPA overview (applicability depends on statutory scope/thresholds): https://oag.ca.gov/privacy/ccpa

## Current status

**Not ready to claim legal compliance or submit as a final release.** The repository has policy drafts and technical controls, but the provider/country inventory, cross-border transfer basis, retention schedule, actual deletion behavior, moderation operations, U.S. teen-law analysis, and any DMCA agent registration remain operator/legal-review tasks.
