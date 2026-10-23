// DRAFT legal text. Have a lawyer review both documents and fill in the placeholders before the store submission.
// The same text should be published on the website, because both stores ask for a privacy policy URL.

export const OPERATOR = 'Raul Ezequias Aramburu';
export const CONTACT_EMAIL = 'support@swipefordinner.app'
export const LAST_UPDATED = '14 October 2026';

export type LegalDoc = 'terms' | 'privacy';

type Section = { heading: string; body: string[] };

export const LEGAL: Record<LegalDoc, { title: string; sections: Section[] }> = {
  terms: {
    title: 'Terms of Use',
    sections: [
      {
        heading: 'The short version',
        body: [
          `Swipe for Dinner is run by ${OPERATOR}. By creating an account you agree to these terms. If you don't agree, please don't use the app.`,
        ],
      },
      {
        heading: 'Who can use it',
        body: [
          'You must be at least 16 years old. The app is for two people deciding what to cook together; each person needs their own account, and an account belongs to one couple at a time.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'Keep your sign-in email secure. You are responsible for what happens under your account. You can delete your account at any time in Settings, and everything linked to it is removed.',
        ],
      },
      {
        heading: 'Recipes and food safety',
        body: [
          'Recipes come from third-party catalogs and, in the future, from other people. We do our best, but we cannot guarantee that a recipe is accurate, complete or safe for you.',
          'Allergy and diet filters are a convenience, not medical advice. Always read the ingredient list yourself and check labels. If you have a serious allergy, do not rely on the app alone.',
        ],
      },
      {
        heading: 'Content you share',
        body: [
          'If you submit a recipe, you confirm you wrote it yourself, that you have the right to share any photo you attach, and that it contains nothing unlawful, hateful, harassing or misleading. You keep ownership of your content and give us a licence to store, review, modify for presentation and show it to other users of the app.',
          'We review submissions before they are published and may remove any content, or suspend accounts that break these rules. You can report a recipe from its menu, and we aim to act on reports within 24 hours.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: [
          'Do not misuse the app: no attempts to access other accounts, guess invite codes, overload the service or reverse engineer it.',
        ],
      },
      {
        heading: 'Subscriptions',
        body: [
          'One person in a couple may pay for a subscription that covers both of you. Prices, renewal and cancellation are handled by the App Store or Google Play and are shown before you buy.',
        ],
      },
      {
        heading: 'Our responsibility',
        body: [
          'The app is provided as is. To the extent the law allows, we are not liable for indirect losses or for anything that results from cooking or eating a dish. Nothing here limits rights you have by law as a consumer.',
        ],
      },
      {
        heading: 'Changes and contact',
        body: [
          `We may update these terms; for important changes we will tell you in the app. Questions or reports: ${CONTACT_EMAIL}.`,
          `Last updated ${LAST_UPDATED}.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'Who we are',
        body: [
          `${OPERATOR} runs Swipe for Dinner and is responsible for your data. Contact: ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'What we collect',
        body: [
          'Account: your email address and the first name you choose.',
          'What you tell us: food preferences (diet, allergies, dislikes, cuisines), your swipes, and your couple settings such as match goal and reveal time.',
          'Your couple: the time zone of the phone that created it, and who your partner is.',
          'Recipes you submit, if you do, including any photo, and the reports and blocks you make about other people\'s recipes.',
          'Notifications: a reminder at the reveal time is scheduled on your phone itself; nothing is sent from a server for it.',
          'We do not use advertising or analytics trackers, and we do not sell data.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To run the app: sign you in, pair you with your partner, build your shared dish queue, work out your matches, and show them to both of you. Your partner sees your name and whether you have finished your preferences. Your swipes are only used to find matches; your partner sees the matches, not which dishes you passed on.',
          'Your allergies and dislikes are only used to filter dishes. They are not shown to your partner as text.',
        ],
      },
      {
        heading: 'Who processes it',
        body: [
          'Our backend and database are provided by Supabase. Recipe data comes from TheMealDB, and recipe photos load directly from their servers, which means their servers can see your device address when a photo loads. If you subscribe, payments are handled by Apple or Google, with RevenueCat managing the subscription status.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'For as long as you have an account. When you delete your account in Settings, your profile, preferences, swipes, notices and any recipes you wrote are deleted straight away. If you created the couple, it ends and your partner keeps their own account; if you were invited, your partner keeps the couple without your data.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          `You can see and change your preferences in the app and delete your account in Settings. You can also email ${CONTACT_EMAIL} to ask for a copy of your data or to complain; you may also contact your local data protection authority.`,
        ],
      },
      {
        heading: 'Children',
        body: ['The app is not for anyone under 16, and we do not knowingly collect their data.'],
      },
      {
        heading: 'Changes',
        body: [`If this policy changes, we will update this page. Last updated ${LAST_UPDATED}.`],
      },
    ],
  },
};
