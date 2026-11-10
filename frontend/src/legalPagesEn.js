// English legal pages for the US launch. DRAFT: must be reviewed by qualified
// counsel and checked against the real data-processing setup before publication.
const OPERATOR = 'FitNova Operator (individual operator)';
const EMAIL = 'fitnova@naver.com';

export default {
  '/privacy': {
    eyebrow: 'PRIVACY & DATA',
    title: 'Privacy Policy',
    updated: 'Effective date: to be announced when the service launches',
    intro: `FITNOVA (operated by an individual: ${OPERATOR}) provides workout logging and community features. Privacy questions: ${EMAIL}. This draft must be checked against actual service operations and data processing before it takes effect.`,
    sections: [
      ['1. Information we collect', 'Account and sign-in: name, username, email address, a hashed password, and information related to email verification and security codes.\nProfile and community: profile details, follow relationships, posts, photos and videos, exercises and workout records, likes, comments, saved items, hashtag searches and reports.\nMessages and settings: direct message content and sent/read status, notifications and push tokens (if you turn push on), private-account, message and activity-visibility settings, and block/hide lists.\nService operation: request and access information needed for authentication, security and error prevention may be processed. The exact server-log fields must be confirmed against the deployed environment.\nStep count: the Android step counter uses your device sensors. The app tells you step records are stored on your device; behavior on specific devices and any backups must be confirmed before launch.'],
      ['2. How we use information', 'To create accounts and verify identity, sign you in and recover accounts, provide profiles, workout records and posts, enable messages and interactions between members, send notifications, apply your privacy and visibility settings, handle reports and keep the community safe, and prevent abuse and keep the service reliable.'],
      ['3. Retention', 'Account information and user content are kept while your account is active. The app describes a 30-day grace period after you request account deletion and is designed to delete the related account data when that period ends. It must be verified in the live environment that all data and backups are removed in line with this process.\nEmail verification, sign-in and password-reset codes are valid for 10 minutes. Specific retention periods for security logs, reports and backups must be defined in operating policy and stated here.'],
      ['4. Service providers and international processing', 'Web hosting, API hosting, database, email delivery and push-notification providers may be involved in running the service. Each provider’s legal name, the work it performs, where data is processed and whether data is transferred internationally (including to the United States or other countries) must be confirmed against the actual deployment and contracts before this section is finalized. This draft does not guess provider names or countries.'],
      ['5. Sharing', 'We do not sell your personal information, and we do not share it with third parties except where required by law, where you have given valid consent, or with service providers that process it on our behalf as described in Section 4.'],
      ['6. Your choices and rights', 'You can request access to, correction of, or deletion of your personal information, or ask us to stop processing it. In the app you can manage some visibility settings, change your email and delete your account; other requests can be sent to the contact below. Depending on where you live (for example under certain US state privacy laws), you may have additional rights, such as to know what we collect or to opt out of a sale or sharing of personal information. We may be unable to delete information we are legally required to keep. Information required to be retained by law may stay for that period.'],
      ['7. Security', 'The service uses password hashing, token-based access, email-code verification, authorization checks, and report and block features. Encryption, secret management, access logs, backup and recovery, and vulnerability review in the live environment need separate verification. No online service can guarantee absolute security.'],
      ['8. Age requirement and children', 'FITNOVA is intended for people aged 14 and over. At sign-up you must confirm you are at least 14; people under 14 may not create an account or use the service. Age confirmation is self-declared and is not identity or document verification. We do not knowingly collect personal information from children under 13, and will delete it if we learn we have.'],
      ['9. Contact', `Privacy questions and requests to access, correct or delete data: ${EMAIL}\nPrivacy contact: ${OPERATOR}`],
      ['10. Changes', 'If laws, features or data-processing practices change, we will update this policy and announce the effective date and what changed.']
    ]
  },
  '/terms': {
    eyebrow: 'SERVICE TERMS',
    title: 'Terms of Service',
    updated: 'Effective date: to be announced when the service launches',
    intro: `These terms set the basic rules for using FITNOVA’s workout logging and social community features, provided by ${OPERATOR}. Contact: ${EMAIL}.`,
    sections: [
      ['1. Purpose', 'These terms set out the conditions for using the workout logging, post sharing, follow, messaging, notification and related features of FITNOVA (the “Service”) and the rights and responsibilities of users and the operator.'],
      ['2. Eligibility, accounts and information', 'You must be at least 14 years old to use FITNOVA. You must confirm this when you sign up; people under 14 may not create an account or use the Service. Provide accurate account information, keep your credentials secure, and do not use someone else’s account or identity or use an account for improper purposes. Some features require email verification and security steps.'],
      ['3. User content', 'You must have the legal right to the text, photos, videos, workout records and messages you post. Do not post content that infringes others’ copyright, publicity or privacy rights, or that is illegal. You keep the rights you have in your content under applicable law; you grant the operator only the permission needed to host, display and transmit it as part of the Service.'],
      ['4. Prohibited conduct', 'Posting illegal, threatening, harassing, hateful or sexually exploitative content; spam, fraud and phishing; exposing others’ personal information; infringing copyright; interfering with the Service or its security features; excessive automated requests; abusing report and block features; impersonating others; and violating the law are prohibited.'],
      ['5. Reports and enforcement', 'The Service may provide reporting, blocking, post-hiding and administrator review. Depending on the seriousness of a violation and applicable law, we may remove content, restrict features or suspend accounts. Where possible we will tell you why. The appeal process and response times must be set in operating policy and published.'],
      ['6. Changes and interruptions', 'The operator may change or suspend parts of the Service for security, maintenance, outages, legal requirements or improvements. We will take reasonable steps to limit interruptions and data loss, but liability may be limited to the extent permitted by law.'],
      ['7. Account deletion and data', 'You can request account deletion in Settings. The app describes a 30-day grace period after a deletion request. Whether and how an account can be restored during that period must be confirmed against the actual implementation and communicated separately; after the period ends, data deletion follows the Privacy Policy.'],
      ['8. Health information and disclaimer', 'FITNOVA’s workout records and analysis are for general logging and information only and are not medical advice or diagnosis. Exercise according to your own health and circumstances, and consult a professional if unsure. The Service is provided “as is” to the extent permitted by law; the operator is not responsible for problems caused by your device or network or for disputes between users, except for liability that cannot be excluded by law.'],
      ['9. Changes to these terms; governing law', 'If we change these terms we will give reasonable advance notice of the changes and their effective date. The governing law, venue and dispute-resolution process must be determined with legal counsel before launch.'],
      ['10. Operator and contact', `Operator: ${OPERATOR}\nContact: ${EMAIL}\nEffective date: to be announced separately when the Service launches.`]
    ]
  },
  '/community-guidelines': {
    eyebrow: 'COMMUNITY SAFETY',
    title: 'Community Guidelines',
    updated: 'Draft: October 19, 2026',
    intro: 'FITNOVA is a place to log workouts and cheer each other on. These rules apply so everyone can take part safely.',
    sections: [
      ['1. Respect each other', 'Insults, harassment, threats, hate speech, stalking, repeated unwanted contact, and demeaning others for their fitness level, body, gender, disability or similar traits are not allowed.'],
      ['2. Safe and lawful content', 'Do not post illegal activity, threats of violence, sexual exploitation, content that encourages self-harm, scams or phishing, or content that recklessly promotes dangerous training methods. Fitness information may apply differently depending on each person’s health.'],
      ['3. Privacy and consent', 'Do not post your own or others’ address, phone number, live location, private conversations, ID documents or other sensitive information without consent. If other people are identifiable in your photos or videos, make sure you have the right to post them and their consent.'],
      ['4. Copyright and honesty', 'Only upload content you made or have the right to use. Do not impersonate others or mislead other users with fake accounts or false workout records. Ads and promotional posts must follow applicable law.'],
      ['5. Spam and misuse of the platform', 'Mass messaging, repeated posting, automated account activity, exploiting vulnerabilities, and retaliating or filing false reports through the report and block features are prohibited.'],
      ['6. Report, block and hide', 'If you see a violation, use the in-app report feature. Use block and hide to manage unwanted interactions. Include only the facts needed for review in a report, and do not retaliate against the person you reported.'],
      ['7. Enforcement and appeals', 'Considering severity, repetition, user safety and legal obligations, the operator may remove content, warn, restrict features or suspend accounts. How to appeal and target response times will be published once the operator confirms a contact channel.'],
      ['8. Emergencies', 'If you suspect immediate physical danger or a crime, do not rely on an in-app report — contact local emergency services (in the US, call 911). FITNOVA is not an emergency service.'],
      ['Contact and effective date', `Community reports and appeals: ${EMAIL}\nOperator: ${OPERATOR}. The effective date will be announced when the Service launches.`]
    ]
  }
};
