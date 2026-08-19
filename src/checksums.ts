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
 * Plain random replacement destroys check digits and format constraints, which
 * makes downstream validators (Mustang, KoSIT, VeR) reject the anonymized
 * invoice with errors like "IBAN is invalid". The helpers below produce random
 * values that still satisfy the published rules — check digits for IBAN and
 * VAT IDs, and the ISO 9362 character pattern for BICs.
 */

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const randomFrom = (chars: string): string => chars[Math.floor(Math.random() * chars.length)];
const randomDigit = (): string => DIGITS[Math.floor(Math.random() * 10)];
const randomLetter = (): string => LETTERS[Math.floor(Math.random() * 26)];
const randomDigits = (n: number): string => Array.from({ length: n }, randomDigit).join('');

/* ------------------------------------------------------------------ IBAN */

// ISO 13616 registry lengths. Used to normalize the generated IBAN so that
// length checks pass even when the source value had a wrong length.
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

const stripIban = (value: string): string => value.replace(/\s+/g, '').toUpperCase();

/** True if `value` passes the ISO 13616 MOD 97-10 check. */
export function isValidIban(value: string): boolean {
  const iban = stripIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  return mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

/** True if `value` is shaped like an IBAN, regardless of its check digits. */
export function looksLikeIban(value: string): boolean {
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(stripIban(value));
}

/**
 * Replaces the BBAN with random characters of the same kind (digit for digit,
 * letter for letter) and recomputes the two check digits, so the result passes
 * MOD 97-10. The country code and the original spacing style are preserved.
 *
 * Note: national check digits *inside* the BBAN (FR, IT, ES, BE, MC, ...) are
 * not recomputed — there is no single published algorithm for those, and the
 * common e-invoice validators only verify the ISO 13616 check digits.
 */
export function anonymizeIban(value: string): string {
  const iban = stripIban(value);
  const country = iban.slice(0, 2);
  const target = IBAN_LENGTHS[country] ?? iban.length;

  const source = iban.slice(4);
  let bban = '';
  for (let i = 0; i < target - 4; i++) {
    const c = source[i];
    if (c === undefined) bban += randomDigit();
    else if (c >= 'A' && c <= 'Z') bban += randomLetter();
    else bban += randomDigit();
  }

  const check = String(98 - mod97(bban + country + '00')).padStart(2, '0');
  const result = country + check + bban;

  // Restore grouped formatting if the source used it (e.g. "DE89 3704 0044 ...").
  return /\s/.test(value) ? (result.match(/.{1,4}/g) ?? [result]).join(' ') : result;
}

/* ------------------------------------------------------------------- BIC */

/*
 * ISO 9362 / ISO 20022 pattern: [A-Z]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?
 * Positions 1-4 bank code, 5-6 ISO 3166 country, 7-8 location, 9-11 optional
 * branch. Note the exclusions: position 7 rejects 0 and 1, position 8 rejects O.
 */
const BIC_PATTERN = /^[A-Z]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3})?$/;

/** True if `value` matches the ISO 9362 BIC pattern. */
export function looksLikeBic(value: string): boolean {
  return BIC_PATTERN.test(value.replace(/\s+/g, '').toUpperCase());
}

/**
 * Replaces a BIC with a random one that still matches the ISO 9362 pattern.
 * The country code (positions 5-6) is kept, because a random pair of letters
 * is usually not a valid ISO 3166 code and validators check it against the
 * country list. Length (8 or 11) is preserved.
 */
export function anonymizeBic(value: string): string {
  const bic = value.replace(/\s+/g, '').toUpperCase();
  const country = bic.slice(4, 6);

  const bank = Array.from({ length: 4 }, randomLetter).join('');
  const location = randomFrom('ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789') + randomFrom('ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789');
  const branch = bic.length === 11 ? Array.from({ length: 3 }, () => randomFrom(LETTERS + DIGITS)).join('') : '';

  return bank + country + location + branch;
}

/* ---------------------------------------------------------------- VAT ID */

/*
 * There is no EU-wide VAT check-digit algorithm — every member state defines
 * its own rule. Only the countries whose rule is published and unambiguous are
 * handled here; everything else falls back to plain random anonymization.
 */

const luhnDouble = (d: number): number => Math.floor(d / 5) + (d * 2) % 10;
const toDigits = (s: string): number[] => s.split('').map(Number);

type VatRule = {
  /** Matches the part after the two-letter country prefix. */
  pattern: RegExp;
  /** Builds a random national number with a correct check digit. */
  generate: () => string;
};

const VAT_RULES: Record<string, VatRule> = {
  // ISO 7064 MOD 11,10 over the first 8 digits.
  DE: {
    pattern: /^[0-9]{9}$/,
    generate: () => {
      const body = randomDigits(8);
      let p = 10;
      for (const d of toDigits(body)) {
        const m = (d + p) % 10 || 10;
        p = (2 * m) % 11;
      }
      const check = 11 - p;
      return body + (check === 10 ? 0 : check);
    },
  },

  // "U" + 8 characters; alternating weights over the first 7 digits.
  AT: {
    pattern: /^U[0-9]{8}$/,
    generate: () => {
      const body = randomDigits(7);
      const d = toDigits(body);
      const sum = d[0] + luhnDouble(d[1]) + d[2] + luhnDouble(d[3]) + d[4] + luhnDouble(d[5]) + d[6];
      return 'U' + body + ((96 - sum) % 10 + 10) % 10;
    },
  },

  // 9 digits + "B" + 2-digit sub-number; weights 9..2, check digit = sum mod 11.
  NL: {
    pattern: /^[0-9]{9}B[0-9]{2}$/,
    generate: () => {
      for (;;) {
        const body = randomDigits(8);
        const sum = toDigits(body).reduce((acc, d, i) => acc + d * (9 - i), 0);
        const check = sum % 11;
        if (check === 10) continue; // not a valid check digit — retry
        return `${body}${check}B${randomDigits(2).replace(/^00$/, '01')}`;
      }
    },
  },

  // 10 digits: first 8 as a number, check = 97 - (n mod 97).
  BE: {
    pattern: /^[0-9]{10}$/,
    generate: () => {
      const body = randomDigits(1).replace(/[2-9]/, '0') + randomDigits(7);
      const check = 97 - (Number(body) % 97);
      return body + String(check).padStart(2, '0');
    },
  },

  // 2 check digits + 9-digit SIREN; key = (12 + 3 * (SIREN mod 97)) mod 97.
  FR: {
    pattern: /^[0-9A-Z]{2}[0-9]{9}$/,
    generate: () => {
      const siren = randomDigits(9);
      const key = (12 + 3 * (Number(siren) % 97)) % 97;
      return String(key).padStart(2, '0') + siren;
    },
  },

  // 11 digits, Luhn over the first 10.
  IT: {
    pattern: /^[0-9]{11}$/,
    generate: () => {
      const body = randomDigits(10);
      const sum = toDigits(body).reduce((acc, d, i) => acc + (i % 2 === 0 ? d : luhnDouble(d)), 0);
      return body + (10 - sum % 10) % 10;
    },
  },

  // 8 digits, last two = first six mod 89.
  LU: {
    pattern: /^[0-9]{8}$/,
    generate: () => {
      const body = randomDigits(6);
      return body + String(Number(body) % 89).padStart(2, '0');
    },
  },

  // 8 digits, weights 2,7,6,5,4,3,2,1 — weighted sum must be 0 mod 11.
  DK: {
    pattern: /^[0-9]{8}$/,
    generate: () => {
      const weights = [2, 7, 6, 5, 4, 3, 2];
      for (;;) {
        const body = randomDigits(7);
        const sum = toDigits(body).reduce((acc, d, i) => acc + d * weights[i], 0);
        const check = (11 - sum % 11) % 11;
        if (check === 10) continue; // no digit satisfies the rule — retry
        return body + check;
      }
    },
  },

  // 10 digits, weights 6,5,7,2,3,4,5,6,7 — check digit = sum mod 11.
  PL: {
    pattern: /^[0-9]{10}$/,
    generate: () => {
      const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
      for (;;) {
        const body = randomDigits(9);
        const sum = toDigits(body).reduce((acc, d, i) => acc + d * weights[i], 0);
        const check = sum % 11;
        if (check === 10) continue; // not a valid check digit — retry
        return body + check;
      }
    },
  },
};

const stripVat = (value: string): string => value.replace(/[\s.-]/g, '').toUpperCase();

/** True if `value` is a VAT ID whose check-digit rule this module implements. */
export function isSupportedVatId(value: string): boolean {
  const vat = stripVat(value);
  const rule = VAT_RULES[vat.slice(0, 2)];
  return rule !== undefined && rule.pattern.test(vat.slice(2));
}

/**
 * Returns a random VAT ID for the same country with a valid check digit.
 * The country prefix is kept — without it the check digit is undefined.
 */
export function anonymizeVatId(value: string): string {
  const vat = stripVat(value);
  const country = vat.slice(0, 2);
  return country + VAT_RULES[country].generate();
}
