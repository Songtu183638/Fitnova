import React from 'react';
import { Activity, ArrowLeft, ShieldCheck, FileText, Users } from 'lucide-react';
import './legal-pages.css';

const pages = {
  '/privacy': {
    icon: ShieldCheck,
    eyebrow: 'PRIVACY & DATA',
    title: 'Privacy Policy',
    updated: 'Effective date: To be announced before launch',
    intro: 'FITNOVA is independently operated and provides workout tracking and social community features. Privacy contact: fitnova@naver.com. This policy must be checked against actual production data practices before it takes effect.',
    sections: [
      ['1. Personal Information We Collect', 'Registration and sign-in: name, username, email address, password hash, and email verification/security-code information.\nProfile and community: profile details, follows, posts, photos, videos, workout details, likes, comments, saved items, hashtag searches, and reports.\nMessages and settings: direct-message content and delivery/read status, notifications and push tokens (if enabled), privacy and messaging preferences, and block/mute lists.\nService operations: request and access-log information may be processed for authentication, security, and troubleshooting. Actual production logs must be verified.\nStep count: The Android step counter uses the device sensor. Confirm device behavior, storage, and backup handling before launch.'],
      ['2. How We Use Information', 'We use information to create and verify accounts; provide sign-in and account recovery; operate profiles, workout logs, posts, messaging, and interactions; deliver notifications; apply privacy settings; review reports; maintain community safety; prevent abuse; and keep the service reliable.'],
      ['3. Data Retention', 'Account information and user content are retained while an account is active. The app currently describes a 30-day grace period after an account-deletion request, after which account data is designed to be deleted. Production deletion and backup handling must be verified.\nEmail verification, sign-in, and password-reset codes are stated to expire after 10 minutes. Retention periods for security logs, reports, and backups must be finalized and disclosed before launch.'],
      ['4. Service Providers and International Transfers', 'Service delivery may involve web hosting, API hosting, database, email, and push-notification providers. Before launch, verify production settings and contracts, then disclose each provider’s legal name, service, processing location, and any international transfer. This draft does not guess provider names or countries.'],
      ['5. Sharing with Third Parties', 'FITNOVA does not disclose personal information to third parties except where legally permitted or with valid user consent. Service-provider processing, such as hosting and email delivery, must be disclosed in Section 4.'],
      ['6. Your Rights', 'You may request access to, correction of, deletion of, or restriction of your personal information. You can manage certain visibility settings, change your email, and request account deletion in the app. For other requests, contact us below. Information that must be retained by law may not be deleted until the required period ends.'],
      ['7. Security', 'The service uses password hashing, token-based access, email verification codes, authorization checks, and report/block tools. Production encryption, secret management, access logging, backup/recovery, and vulnerability testing must be independently verified.'],
      ['8. Age Requirements and Children’s Privacy', 'FITNOVA is intended for people aged 14 and older. During registration, users must confirm they meet this minimum age; anyone under 14 may not create an account or use the service. This is a self-attestation, not identity-document age verification. Required protections for minors will be applied under applicable law.'], 
      ['9. Privacy Contact', '개인정보 관련 문의·열람·정정·삭제 요청: fitnova@naver.com\n개인정보 처리 담당: FitNova운영자(개인 운영)'], 
      ['10. Changes', '법령, 서비스 기능 또는 데이터 처리 방식이 변경되면 이 방침을 수정하고 적용일과 변경 내용을 공지합니다.']
    ]
  },
  '/terms': {
    icon: FileText,
    eyebrow: 'SERVICE TERMS',
    title: 'Terms of Service',
    updated: 'Effective date: To be announced before launch',
    intro: '이 약관은 개인 운영자 FitNova운영자가 제공하는 FITNOVA의 운동 기록 및 소셜 커뮤니티 기능 이용에 관한 기본 규칙을 정합니다. 문의: fitnova@naver.com.',
    sections: [
      ['Section 1. Purpose', '본 약관은 FITNOVA(이하 “서비스”)가 제공하는 운동 기록, 게시물 공유, 팔로우, 메시지, 알림 및 관련 기능의 이용 조건과 이용자·운영자의 권리와 책임을 정하는 것을 목적으로 합니다.'],
      ['Section 2. Eligibility, Accounts, and Information', 'FITNOVA는 만 14세 이상만 이용할 수 있습니다. 회원가입자는 만 14세 이상임을 확인해야 하며, 만 14세 미만은 계정을 만들거나 이용할 수 없습니다. 이용자는 정확한 계정 정보를 제공하고 접근 정보를 안전하게 관리해야 하며, 타인의 계정이나 신원을 도용하거나 계정을 부정한 목적으로 이용해서는 안 됩니다. 이메일 인증과 보안 절차를 통과해야 이용할 수 있는 기능이 있습니다.'], 
      ['Section 3. User Content', 'You must have the rights needed to post your text, photos, videos, workout records, and messages. Do not infringe others’ copyrights, publicity rights, or privacy, or post unlawful content. You retain your rights in your content and grant only the limited permissions needed to host, display, and transmit it as part of the service.'],
      ['Section 4. Prohibited Conduct', 'You may not post unlawful, threatening, harassing, hateful, or exploitative content; spam, scams, or phishing; expose another person’s private information; infringe intellectual property; interfere with service or security features; make excessive automated requests; abuse reporting/blocking tools; impersonate others; or violate applicable law.'],
      ['Section 5. Reports and Enforcement', 'The service may provide reporting, blocking, post-hiding, and moderation tools. Depending on severity and applicable law, we may remove content, restrict features, or suspend accounts. Where appropriate, we will explain the reason. An appeal process and response timeline must be finalized and published before launch.'],
      ['Section 6. Changes and Availability', '운영자는 보안, 유지보수, 장애, 법적 요구 또는 기능 개선을 위해 서비스 일부를 변경·중단할 수 있습니다. 서비스 중단이나 데이터 손실 가능성을 줄이기 위해 합리적인 조치를 취하되, 법령상 허용되는 범위에서 책임이 제한될 수 있습니다.'],
      ['Section 7. Account Deletion', '이용자는 설정에서 회원탈퇴를 요청할 수 있습니다. 앱은 탈퇴 요청 후 30일 유예 기간을 안내합니다. 유예 기간 중 복구 가능 여부와 복구 절차는 실제 구현 상태를 확인해 별도로 안내해야 하며, 유예 종료 후 데이터 삭제가 완료되는 범위는 개인정보 처리방침에 따릅니다.'],
      ['Section 8. Disclaimers and Fitness Information', 'FITNOVA’s workout logs and analytics are for general informational purposes and are not medical diagnoses or professional medical advice. Exercise according to your own health and circumstances. Nothing in these Terms excludes liability that cannot be excluded by law.'],
      ['Section 9. Changes and Governing Law', '약관을 변경하는 경우 변경 내용과 시행일을 합리적인 방법으로 사전에 공지합니다. 적용 법률과 분쟁 해결 절차는 관련 법령에 따릅니다.'],
      ['Section 10. Operator and Contact', '서비스 운영자: FitNova운영자(개인 운영)\n문의처: fitnova@naver.com\n시행일: 실제 서비스 공개일에 맞춰 별도 공지합니다.']
    ]
  },
  '/community-guidelines': {
    icon: Users,
    eyebrow: 'COMMUNITY SAFETY',
    title: 'Community Guidelines',
    updated: 'Draft updated October 19, 2026',
    intro: 'FITNOVA is a place to track workouts and encourage one another. These rules help keep the community safe for everyone.',
    sections: [
      ['1. Treat Others with Respect', 'No insults, harassment, threats, hate speech, stalking, repeated unwanted contact, or degrading comments about another person’s fitness, body, gender, disability, or other characteristics.'],
      ['2. Safe and Lawful Content', 'Do not post illegal content, threats of violence, sexual exploitation, content encouraging self-harm, scams, phishing, or reckless recommendations for dangerous exercise. Fitness information may not be appropriate for everyone’s health circumstances.'],
      ['3. Privacy and Consent', 'Do not share addresses, phone numbers, real-time locations, private conversations, identity documents, or other sensitive information without consent. Make sure you have permission to post photos or videos in which other people are identifiable.'],
      ['4. Copyright and Authenticity', 'Only post content you created or have permission to use. Do not impersonate others or deceive users with fake accounts or fabricated workout records. Advertising and promotional posts must comply with applicable law.'],
      ['5. Spam and Platform Abuse', 'Do not send bulk messages, repeatedly post the same content, automate abusive account activity, exploit vulnerabilities, retaliate through reporting/blocking tools, or submit knowingly false reports.'],
      ['6. Reporting, Blocking, and Hiding', 'Use the in-app report feature when you see a violation. Use blocking and muting tools to manage unwanted interactions. Include only relevant facts in reports and do not retaliate against reported users.'],
      ['7. Moderation and Appeals', 'The operator may remove content, issue warnings, restrict features, or suspend accounts based on severity, repetition, user safety, and legal obligations. Appeal instructions and target response times must be published once the support process is finalized.'],
      ['8. Emergencies', 'If someone is in immediate physical danger or a crime may be occurring, contact local emergency services rather than relying on an in-app report. FITNOVA is not an emergency-response service.'],
      ['Contact and Effective Date', '커뮤니티 신고·이의 제기 문의: fitnova@naver.com\n운영자: FitNova운영자(개인 운영). 실제 시행일은 서비스 공개일에 맞춰 공지합니다.']
    ]
  }
};

export default function LegalPages({ path = window.location.pathname }) {
  // Vercel may normalize extensionless routes with a trailing slash.
  const normalizedPath = path === '/' ? '/' : path.replace(/\/+$/, '');
  const page = pages[normalizedPath] || pages['/privacy'];
  const Icon = page.icon;
  return <main className="legal-shell">
    <header className="legal-topbar">
      <a className="legal-brand" href="/" aria-label="FITNOVA 홈"><span className="legal-mark"><Activity size={21}/></span><span>FIT<span>NOVA</span></span></a>
      <a className="legal-back" href="/"><ArrowLeft size={16}/> 서비스로 돌아가기</a>
    </header>
    <article className="legal-content">
      <div className="legal-hero-icon"><Icon size={24}/></div>
      <span className="legal-eyebrow">{page.eyebrow}</span>
      <h1>{page.title}</h1>
      <p className="legal-updated">{page.updated}</p>
      <p className="legal-intro">{page.intro}</p>
      <aside className="legal-draft-warning" role="note">
        <b>운영 전 최종 확인 필요</b>
        <p>운영자 명칭·문의 이메일·만 14세 이상 이용 정책을 반영했습니다. 다만 실제 데이터 처리업체, 국외 이전, 로그·신고·백업 보유기간과 삭제 절차는 배포 설정과 운영 실태를 대조해야 합니다. 이를 확인하고 법률 검토를 마친 뒤 최종 시행하세요.</p>
      </aside>
      <nav className="legal-tabs" aria-label="정책 문서">
        <a className={normalizedPath==='/privacy'?'active':''} href="/privacy">개인정보 처리방침</a>
        <a className={normalizedPath==='/terms'?'active':''} href="/terms">이용약관</a>
        <a className={normalizedPath==='/community-guidelines'?'active':''} href="/community-guidelines">커뮤니티 운영정책</a>
      </nav>
      <div className="legal-sections">{page.sections.map(([heading, body]) => <section className="legal-section" key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</div>
      <footer className="legal-footer"><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span></footer>
    </article>
  </main>;
}
