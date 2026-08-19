/*
    Copyright (C) 2026 valitool GmbH

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
 * Format-preserving anonymization for structured identifiers.
 *
 * The guiding rule is "preserve validity, never establish it": an identifier is
 * only replaced by a rule-conforming one when the *original* already conformed.
 * A broken IBAN stays broken (just anonymized), because ZEBRA is used to prepare
 * faulty invoices for analysis — silently repairing a value would delete the very
 * defect someone is trying to diagnose.
 */

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const randomFrom = (chars: string): string => chars[Math.floor(Math.random() * chars.length)];
const randomDigit = (): string => randomFrom(DIGITS);
const randomLetter = (): string => randomFrom(LETTERS);
const randomDigits = (n: number): string => Array.from({ length: n }, randomDigit).join('');

/* ------------------------------------------------------------------ IBAN */

// ISO 13616 registry lengths, needed to validate the source value.
const IBAN_LENGTHS: Record<string, number> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BY: 28, BE: 16, BA: 20, BR: 29,
  BG: 22, BI: 27, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DJ: 27, DO: 28,
  TL: 23, EG: 29, SV: 28, EE: 20, FK: 18, FO: 18, FI: 18, FR: 27, GE: 22,
  DE: 22, GI: 23, GR: 27, GL: 18, GT: 28, HN: 28, HU: 28, IS: 26, IQ: 23,
  IE: 22, IL: 23, IT: 27, JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21, LB: 28,
  LY: 25, LI: 21, LT: 20, LU: 20, MT: 31, MR: 27, MU: 30, MC: 27, MD: 24,
  MN: 20, ME: 22, NL: 18, NI: 28, MK: 19, NO: 15, OM: 23, PK: 24, PS: 29,
  PL: 28, PT: 25, QA: 29, RO: 24, RU: 33, LC: 32, SM: 27, ST: 25, SA: 24,
  RS: 22, SC: 31, SK: 24, SI: 19, SO: 23, ES: 24, SD: 18, SE: 24, CH: 21,
  TN: 24, TR: 26, UA: 29, AE: 23, GB: 22, VA: 22, VG: 24, YE: 30,
};

// ISO 7064 MOD 97-10, computed digit by digit to avoid big integers.
const mod97 = (value: string): number => {
  let remainder = 0;
  for (const c of value) {
    const part = c >= '0' && c <= '9' ? c : (c.charCodeAt(0) - 55).toString();
    for (const d of part) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder;
};

const normalize = (value: string): string => value.replace(/\s+/g, '').toUpperCase();

/** True if `value` is a well-formed IBAN with correct length and check digits. */
export function isValidIban(value: string): boolean {
  const iban = normalize(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.length !== IBAN_LENGTHS[iban.slice(0, 2)]) return false;
  return mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

/**
 * Replaces the BBAN with random characters of the same kind and recomputes the
 * check digits. Only meaningful for input that already passed `isValidIban`,
 * so country and length are simply carried over.
 *
 * National check digits *inside* the BBAN (FR, IT, ES, BE, MC, ...) are not
 * recomputed — there is no single published algorithm, and the common e-invoice
 * validators only verify the ISO 13616 check digits.
 */
export function anonymizeIban(value: string): string {
  const iban = normalize(value);
  const country = iban.slice(0, 2);

  const bban = Array.from(iban.slice(4), c => (c >= 'A' && c <= 'Z' ? randomLetter() : randomDigit())).join('');
  const check = String(98 - mod97(bban + country + '00')).padStart(2, '0');
  const result = country + check + bban;

  // Restore grouped formatting if the source used it (e.g. "DE89 3704 0044 ...").
  return /\s/.test(value) ? (result.match(/.{1,4}/g) ?? [result]).join(' ') : result;
}

/* ------------------------------------------------------------------- BIC */

/*
 * ISO 9362 / ISO 20022 pattern. Positions 1-4 bank code, 5-6 ISO 3166 country,
 * 7-8 location, 9-11 optional branch. Note the exclusions: position 7 rejects
 * 0 and 1, position 8 rejects O.
 */
const BIC_PATTERN = /^[A-Z]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?$/;

/** True if `value` matches the ISO 9362 BIC pattern. */
export function isValidBic(value: string): boolean {
  return BIC_PATTERN.test(normalize(value));
}

/**
 * Replaces a BIC with a random one matching the same pattern. The country code
 * is kept, because a random letter pair is rarely a valid ISO 3166 code.
 */
export function anonymizeBic(value: string): string {
  const bic = normalize(value);
  const bank = Array.from({ length: 4 }, randomLetter).join('');
  const location = randomFrom(LETTERS + '23456789') + randomFrom('ABCDEFGHIJKLMNPQRSTUVWXYZ' + DIGITS);
  const branch = bic.length === 11 ? Array.from({ length: 3 }, () => randomFrom(LETTERS + DIGITS)).join('') : '';

  return bank + bic.slice(4, 6) + location + branch;
}

/* ---------------------------------------------------------------- VAT ID */

/*
 * There is no EU-wide VAT check-digit algorithm — every member state defines its
 * own rule. Only countries with a published, unambiguous rule are handled here;
 * anything else falls back to plain scrambling. Spain is deliberately omitted:
 * NIF/CIF/NIE use three competing schemes with letter check characters.
 *
 * Each rule is expressed as a body (everything except the check characters) plus
 * a function computing those characters, which yields validation and generation
 * from the same definition — so the two can never drift apart.
 */

const luhnDouble = (d: number): number => Math.floor(d / 5) + (d * 2) % 10;
const toDigits = (s: string): number[] => s.split('').map(Number);
const weighted = (s: string, weights: number[]): number =>
  toDigits(s).reduce((acc, d, i) => acc + d * weights[i], 0);

type VatRule = {
  /** Matches the national number, i.e. the part after the country prefix. */
  pattern: RegExp;
  /** Index at which the check characters sit inside the national number. */
  checkAt: number;
  /** Number of check characters. */
  checkLength: number;
  /** Builds a random body (national number without its check characters). */
  randomBody: () => string;
  /** Check characters for a body, or null when the body admits none. */
  check: (body: string) => string | null;
};

const VAT_RULES: Record<string, VatRule> = {
  // ISO 7064 MOD 11,10 over the first 8 digits.
  DE: {
    pattern: /^[0-9]{9}$/, checkAt: 8, checkLength: 1,
    randomBody: () => randomDigits(8),
    check: body => {
      let p = 10;
      for (const d of toDigits(body)) p = (2 * ((d + p) % 10 || 10)) % 11;
      return String(11 - p === 10 ? 0 : 11 - p);
    },
  },

  // "U" + 8 digits; alternating weights over the 7 digits before the check digit.
  AT: {
    pattern: /^U[0-9]{8}$/, checkAt: 8, checkLength: 1,
    randomBody: () => 'U' + randomDigits(7),
    check: body => {
      const d = toDigits(body.slice(1));
      const sum = d[0] + luhnDouble(d[1]) + d[2] + luhnDouble(d[3]) + d[4] + luhnDouble(d[5]) + d[6];
      return String((((96 - sum) % 10) + 10) % 10);
    },
  },

  // 9 digits + "B" + 2-digit sub-number; weights 9..2 over the first 8 digits.
  NL: {
    pattern: /^[0-9]{9}B[0-9]{2}$/, checkAt: 8, checkLength: 1,
    randomBody: () => randomDigits(8) + 'B' + randomDigits(2),
    check: body => {
      const rest = weighted(body.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]) % 11;
      return rest === 10 ? null : String(rest);
    },
  },

  // 10 digits: first 8 as a number, check = 97 - (n mod 97).
  BE: {
    pattern: /^[0-9]{10}$/, checkAt: 8, checkLength: 2,
    randomBody: () => randomFrom('01') + randomDigits(7),
    check: body => String(97 - (Number(body) % 97)).padStart(2, '0'),
  },

  // 2 check digits followed by a 9-digit SIREN; key = (12 + 3 * (SIREN mod 97)) mod 97.
  FR: {
    pattern: /^[0-9]{11}$/, checkAt: 0, checkLength: 2,
    randomBody: () => randomDigits(9),
    check: body => String((12 + 3 * (Number(body) % 97)) % 97).padStart(2, '0'),
  },

  // 11 digits, Luhn over the first 10.
  IT: {
    pattern: /^[0-9]{11}$/, checkAt: 10, checkLength: 1,
    randomBody: () => randomDigits(10),
    check: body => {
      const sum = toDigits(body).reduce((acc, d, i) => acc + (i % 2 === 0 ? d : luhnDouble(d)), 0);
      return String((10 - sum % 10) % 10);
    },
  },

  // 8 digits, last two = first six mod 89.
  LU: {
    pattern: /^[0-9]{8}$/, checkAt: 6, checkLength: 2,
    randomBody: () => randomDigits(6),
    check: body => String(Number(body) % 89).padStart(2, '0'),
  },

  // 8 digits, weights 2,7,6,5,4,3,2,1 — weighted sum must be 0 mod 11.
  DK: {
    pattern: /^[0-9]{8}$/, checkAt: 7, checkLength: 1,
    randomBody: () => randomDigits(7),
    check: body => {
      const rest = (11 - weighted(body, [2, 7, 6, 5, 4, 3, 2]) % 11) % 11;
      return rest === 10 ? null : String(rest);
    },
  },

  // 10 digits, weights 6,5,7,2,3,4,5,6,7 over the first 9.
  PL: {
    pattern: /^[0-9]{10}$/, checkAt: 9, checkLength: 1,
    randomBody: () => randomDigits(9),
    check: body => {
      const rest = weighted(body, [6, 5, 7, 2, 3, 4, 5, 6, 7]) % 11;
      return rest === 10 ? null : String(rest);
    },
  },
};

const stripVat = (value: string): string => value.replace(/[\s.-]/g, '').toUpperCase();

/** Inserts the computed check characters into a body, yielding a full number. */
const compose = (rule: VatRule, body: string): string | null => {
  const check = rule.check(body);
  return check === null ? null : body.slice(0, rule.checkAt) + check + body.slice(rule.checkAt);
};

/** True if `value` is a VAT ID whose country rule this module implements. */
export function isKnownVatCountry(value: string): boolean {
  const vat = stripVat(value);
  const rule = VAT_RULES[vat.slice(0, 2)];
  return rule !== undefined && rule.pattern.test(vat.slice(2));
}

/** True if `value` is a VAT ID with a correct check digit. */
export function isValidVatId(value: string): boolean {
  const vat = stripVat(value);
  const rule = VAT_RULES[vat.slice(0, 2)];
  if (!rule) return false;

  const national = vat.slice(2);
  if (!rule.pattern.test(national)) return false;

  const body = national.slice(0, rule.checkAt) + national.slice(rule.checkAt + rule.checkLength);
  return compose(rule, body) === national;
}

/**
 * Returns a random VAT ID for the same country with a valid check digit.
 * The country prefix is kept — without it no check digit is defined.
 */
export function anonymizeVatId(value: string): string {
  const country = stripVat(value).slice(0, 2);
  const rule = VAT_RULES[country];

  // A few rules reject some bodies (no digit satisfies them); retry in that case.
  for (;;) {
    const national = compose(rule, rule.randomBody());
    if (national !== null) return country + national;
  }
}
