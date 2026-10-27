/**
 * Default Privacy Policy and Terms text for a client site. Plain, honest
 * boilerplate built from the business's own details; the owner can edit it in
 * Settings → Pages. Not legal advice; written to be true for a typical local
 * service website that has a contact form and uses basic analytics.
 */
export interface LegalContext {
  businessName: string;
  domain: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
}

const contactLine = (c: LegalContext) => {
  const bits = [c.phone ? `by phone at ${c.phone}` : null, c.email ? `by email at ${c.email}` : null].filter(Boolean);
  return bits.length ? `You can reach ${c.businessName} ${bits.join(' or ')}.` : `You can reach ${c.businessName} through the contact form on this website.`;
};

export function defaultPrivacyPolicy(c: LegalContext): { h1: string; body: string } {
  const place = [c.city, c.state].filter(Boolean).join(', ');
  return {
    h1: 'Privacy Policy',
    body: [
      `This policy explains what information ${c.businessName}${place ? ` (${place})` : ''} collects through ${c.domain} and how it is used.`,
      `Information you give us. When you fill out a form, request service, or book an appointment, we collect what you enter: typically your name, phone number, email address, service address, and a description of the work you need. We use it to respond to you, schedule and perform the work, and keep records of the job.`,
      `Information collected automatically. Like most websites, this site records basic technical information such as your browser type, device, pages visited, and approximate location derived from your IP address. We use this to keep the site working and to understand which pages are useful. This site may use Google Analytics or similar tools that set cookies for that purpose.`,
      `How we share information. We do not sell your personal information. We share it only with the people and services needed to do the work and run this website: for example, a scheduling or messaging service that sends you confirmations, the hosting provider that runs the site, and payment processors if you pay online. Each is permitted to use your information only to provide its service to us.`,
      `Text messages. If you give us a mobile number, we may text you about your appointment or request. Message and data rates may apply. Reply STOP to any message to opt out.`,
      `Your choices. You can ask us to see, correct, or delete the personal information we hold about you. ${contactLine(c)}`,
      `Children. This website is not directed at children under 13 and we do not knowingly collect information from them.`,
      `Changes. We may update this policy from time to time. The current version is always posted on this page.`,
    ].join('\n\n'),
  };
}

export function defaultTermsOfService(c: LegalContext): { h1: string; body: string } {
  return {
    h1: 'Terms of Service',
    body: [
      `These terms apply to your use of ${c.domain}, operated by ${c.businessName}. By using the site, you agree to them.`,
      `Website content. Descriptions of services, photos of past work, prices, and availability shown on this site are provided for general information. They are not a binding quote. The scope, price, and timing of any job are confirmed with you directly before work begins.`,
      `Requests and bookings. Submitting a form or booking a time slot is a request, not a confirmed appointment, until ${c.businessName} confirms it with you. Please give accurate contact and address details so we can reach you.`,
      `Reviews and photos. Customer reviews shown on this site come from public review platforms and are displayed as written. Photos of completed jobs are of real work performed by ${c.businessName}; identifying details such as house numbers are removed.`,
      `Acceptable use. Do not use this site to send spam, attempt to access systems you are not authorized to use, or submit false information.`,
      `Limitation of liability. The website is provided as is. To the extent permitted by law, ${c.businessName} is not liable for losses arising from your use of the website itself. This does not limit any rights you have under the agreement for work we perform for you or under consumer protection law.`,
      `Contact. Questions about these terms? ${contactLine(c)}`,
    ].join('\n\n'),
  };
}
