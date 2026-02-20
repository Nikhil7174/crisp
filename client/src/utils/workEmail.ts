/**
 * List of common free/personal email provider domains.
 * Interviewers (company users) must NOT use these — they must use a work email.
 * Candidates are not restricted.
 */
const FREE_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.co.uk',
    'yahoo.co.in',
    'ymail.com',
    'hotmail.com',
    'hotmail.co.uk',
    'hotmail.fr',
    'outlook.com',
    'outlook.co.uk',
    'live.com',
    'live.co.uk',
    'msn.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'protonmail.com',
    'proton.me',
    'pm.me',
    'aol.com',
    'aim.com',
    'mail.com',
    'zohomail.com',
    'qq.com',
    '163.com',
    '126.com',
    'rediffmail.com',
    'tutanota.com',
    'tutamail.com',
    'guerrillamail.com',
    'temp-mail.org',
    'mailinator.com',
]);

/**
 * Returns true if the given email is from a work/corporate domain.
 * Returns false if it's from a known free/personal provider.
 *
 * @example
 * isWorkEmail('john@company.com')   // true  ✅
 * isWorkEmail('john@gmail.com')     // false ❌
 */
export function isWorkEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const parts = email.toLowerCase().split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1].trim();
    return !FREE_EMAIL_DOMAINS.has(domain);
}
