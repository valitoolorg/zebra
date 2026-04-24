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

import de from './i18n/de.properties';
import en from './i18n/en.properties';
import fr from './i18n/fr.properties';

const languages = { de, en, fr };
type Lang = keyof typeof languages;

let currentLang: Lang = (localStorage.getItem('lang') as Lang) || 
  (navigator.language.startsWith('de') ? 'de' : 
   navigator.language.startsWith('fr') ? 'fr' : 'en');

export const setLanguage = (lang: Lang) => {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  updateTranslations();
};

export const getLanguage = (): Lang => currentLang;

export const t = (key: string): string => languages[currentLang][key] || languages['en'][key] || key;

export const updateTranslations = () => {
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.getAttribute('data-t');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-t-placeholder]').forEach(el => {
    const key = el.getAttribute('data-t-placeholder');
    if (key) (el as HTMLInputElement).placeholder = t(key);
  });
  document.documentElement.lang = currentLang;
  document.title = t('app.title');
};
