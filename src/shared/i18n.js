'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SUPPORTED_LANGUAGES = ['en', 'pt-BR'];

function format(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match;
  });
}

function normalizeLanguage(locale) {
  const value = String(locale || '').toLowerCase();
  return value.startsWith('pt') ? 'pt-BR' : 'en';
}

function loadLocale(language) {
  const selected = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
  const file = path.join(__dirname, '..', 'locales', `${selected}.json`);

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (selected !== 'en') {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(__dirname, '..', 'locales', 'en.json'), 'utf8')
        );
      } catch {
        // Fall through to the minimal built-in dictionary.
      }
    }
    return { language: 'en', strings: {}, patterns: {} };
  }
}

function createI18n(language, messages) {
  const selected = normalizeLanguage(language);
  const strings = messages && messages.strings ? messages.strings : {};
  const patterns = messages && messages.patterns ? messages.patterns : {};

  function trText(text) {
    if (typeof text !== 'string') return text;
    return Object.prototype.hasOwnProperty.call(strings, text) ? strings[text] : text;
  }

  function t(key, params) {
    const template = Object.prototype.hasOwnProperty.call(patterns, key)
      ? patterns[key]
      : key;
    return format(template, params);
  }

  return {
    language: selected,
    strings,
    patterns,
    aboutHtml: (messages && messages.aboutHtml) || '',
    thunderbirdHtml: (messages && messages.thunderbirdHtml) || '',
    thunderbirdGuide: (messages && messages.thunderbirdGuide) || '',
    guideFile: (messages && messages.guideFile) || 'LEIA-ME-THUNDERBIRD.txt',
    trText,
    t
  };
}

function translateDeep(value, trText) {
  if (typeof value === 'string') return trText(value);
  if (Array.isArray(value)) {
    return value.map((item) => translateDeep(item, trText));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = translateDeep(item, trText);
    }
    return result;
  }
  return value;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  format,
  normalizeLanguage,
  loadLocale,
  createI18n,
  translateDeep
};
