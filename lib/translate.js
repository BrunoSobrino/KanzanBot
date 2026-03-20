'use strict';

const { translate } = require('@vitalets/google-translate-api');

function fixWhatsAppFormat(text) {
  if (!text) return '';
  return text
    .replace(/\*\s+([\s\S]*?)\s+\*/g, '*$1*')
    .replace(/\*\s+([\s\S]*?)\*/g,    '*$1*')
    .replace(/\*([\s\S]*?)\s+\*/g,    '*$1*')
    .replace(/_\s+([\s\S]*?)\s+_/g,   '_$1_')
    .replace(/_\s+([\s\S]*?)_/g,      '_$1_')
    .replace(/_([\s\S]*?)\s+_/g,      '_$1_')
    .replace(/~\s+([\s\S]*?)\s+~/g,   '~$1~')
    .replace(/```\s+([\s\S]*?)\s+```/g,'```$1```');
}

async function translateText(text, to = 'es', from = 'auto') {
  if (!text?.trim()) return { text, from: 'auto', to };
  try {
    const result = await translate(text, { from, to });
    return {
      text : fixWhatsAppFormat(result.text),
      from : result.from?.language?.iso || from,
      to,
    };
  } catch (error) {
    console.error('[Translate] Error:', error.message);
    return { text, from, to, error: error.message };
  }
}

async function detectLanguage(text) {
  if (!text?.trim()) return 'es';
  try {
    const result = await translate(text, { to: 'es' });
    return result.from?.language?.iso || 'es';
  } catch { return 'es'; }
}

const SUPPORTED_LANGS = {
  'es': 'Español', 'en': 'English', 'pt': 'Português', 'fr': 'Français',
  'de': 'Deutsch', 'it': 'Italiano', 'ja': '日本語', 'ko': '한국어',
  'zh': '中文', 'ar': 'العربية', 'ru': 'Русский', 'hi': 'हिन्दी',
  'tr': 'Türkçe', 'nl': 'Nederlands', 'pl': 'Polski',
};

module.exports = { translateText, detectLanguage, fixWhatsAppFormat, SUPPORTED_LANGS };
