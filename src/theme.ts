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

type Theme = 'light' | 'dark' | 'system';

let currentTheme: Theme = (localStorage.getItem('theme') as Theme) || 'system';

export const applyTheme = () => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  const effective = currentTheme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : currentTheme;
  
  root.classList.add(effective);
};

export const setTheme = (theme: Theme) => {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  applyTheme();
};

export const getTheme = (): Theme => currentTheme;

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme === 'system') applyTheme();
});

applyTheme();
