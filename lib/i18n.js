'use strict';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║               🌸 KANZANBOT v2 — SISTEMA MULTI-IDIOMA 🌸             ║
// ║                                                                      ║
// ║  Fuente base : locales/es.json  (único archivo necesario)            ║
// ║  Traducción  : @vitalets/google-translate-api  (dinámica, al vuelo)  ║
// ║                                                                      ║
// ║  FLUJO CORRECTO para preservar formato y variables:                  ║
// ║    1. Template base en español                                       ║
// ║    2. Reemplazar {var} → tokens <<T0>>, <<T1>>... (no se traducen)  ║
// ║    3. Traducir el template con tokens                                ║
// ║    4. Restaurar tokens con los valores reales                        ║
// ║    5. fixFormat() para arreglar espacios en *negritas*               ║
// ║                                                                      ║
// ║  Caché por  key:lang  (no por instancia) → mucho más eficiente       ║
// ╚══════════════════════════════════════════════════════════════════════╝

const fs     = require('fs');
const path   = require('path');
const { translate } = require('@vitalets/google-translate-api');
const config = require('../config');

// ── Caché: Map< 'key:lang' → template traducido con tokens > ──────────
const templateCache = new Map();
const MAX_CACHE     = 400;

// ── Strings base en español ───────────────────────────────────────────
const LOCALES_PATH = path.join(process.cwd(), 'locales', 'es.json');
let baseStrings = {};

function loadBase() {
  try {
    baseStrings = JSON.parse(fs.readFileSync(LOCALES_PATH, 'utf-8'));
  } catch (e) {
    console.error('[i18n] No se pudo cargar locales/es.json:', e.message);
    baseStrings = {};
  }
}
loadBase();

// ══════════════════════════════════════════════════════════════════════
//   REPARACIÓN DE FORMATO WHATSAPP POST-TRADUCCIÓN
//   Google Translate añade espacios: * texto * → *texto*
// ══════════════════════════════════════════════════════════════════════

function fixFormat(text) {
  if (!text) return '';
  return text
    // Negrita: * texto * → *texto*
    .replace(/\*\s+([\s\S]*?)\s+\*/g, '*$1*')
    .replace(/\*\s+([\s\S]*?)\*/g,    '*$1*')
    .replace(/\*([\s\S]*?)\s+\*/g,    '*$1*')
    // Cursiva: _ texto _ → _texto_
    .replace(/_\s+([\s\S]*?)\s+_/g,   '_$1_')
    .replace(/_\s+([\s\S]*?)_/g,      '_$1_')
    .replace(/_([\s\S]*?)\s+_/g,      '_$1_')
    // Tachado
    .replace(/~\s+([\s\S]*?)\s+~/g,   '~$1~')
    // Monospace
    .replace(/```\s+([\s\S]*?)\s+```/g, '```$1```');
}

// ══════════════════════════════════════════════════════════════════════
//   TOKENIZACIÓN — protege las variables {var} durante la traducción
//
//   Tokens como «T0», «T1»... son poco frecuentes en cualquier idioma
//   y Google Translate los deja intactos.
// ══════════════════════════════════════════════════════════════════════

const TOKEN_PREFIX = '«T';
const TOKEN_SUFFIX = '»';

function tokenize(template, vars) {
  const keys   = Object.keys(vars);
  const values = {};
  let i = 0;

  const tokenized = template.replace(/\{(\w+)\}/g, (_, key) => {
    if (vars[key] !== undefined) {
      const token   = `${TOKEN_PREFIX}${i}${TOKEN_SUFFIX}`;
      values[token] = String(vars[key]);
      i++;
      return token;
    }
    return `{${key}}`;
  });

  return { tokenized, values };
}

function detokenize(text, values) {
  let result = text;
  for (const [token, value] of Object.entries(values)) {
    // Escapar el token para usarlo en regex
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), value);
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════
//   FUNCIÓN PRINCIPAL: t(key, lang, vars)
//
//   Traduce un string del locale español al idioma indicado,
//   protegiendo las variables y el formato WhatsApp durante la traducción.
// ══════════════════════════════════════════════════════════════════════

async function t(key, lang = 'es', vars = {}) {
  const base = baseStrings[key];
  if (!base) return `[${key}]`;

  const targetLang = lang || config.defaultLang || 'es';

  // Español → solo interpolar directamente, sin traducir
  if (targetLang === 'es') {
    return base.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{${k}}`
    );
  }

  // ── Tokenizar: reemplazar {var} con tokens temporales ─────────────
  const { tokenized, values } = tokenize(base, vars);

  // ── Obtener/cachear el template traducido (con tokens intactos) ────
  const cacheKey = `${key}:${targetLang}`;
  let translatedTemplate;

  if (templateCache.has(cacheKey)) {
    translatedTemplate = templateCache.get(cacheKey);
  } else {
    try {
      const result = await translate(tokenized, { from: 'es', to: targetLang });
      translatedTemplate = fixFormat(result.text);

      if (templateCache.size >= MAX_CACHE) {
        const old = [...templateCache.keys()].slice(0, 80);
        old.forEach(k => templateCache.delete(k));
      }
      templateCache.set(cacheKey, translatedTemplate);
    } catch (err) {
      console.warn(`[i18n] Error traduciendo '${key}' → '${targetLang}': ${err.message}`);
      // Fallback: interpolar directamente en español
      translatedTemplate = tokenized;
    }
  }

  // ── Restaurar los valores reales en el template traducido ──────────
  return detokenize(translatedTemplate, values);
}

// ══════════════════════════════════════════════════════════════════════
//   getLang — Idioma correcto para un usuario/grupo
// ══════════════════════════════════════════════════════════════════════

async function getLang(db, sender, groupJid = null) {
  try {
    const user = await db.getUser(sender);
    if (user.lang) return user.lang;
  } catch {}

  try {
    if (groupJid) {
      const group = await db.getGroup(groupJid);
      if (group.lang) return group.lang;
    }
  } catch {}

  return config.defaultLang || 'es';
}

function clearCache() { templateCache.clear(); }
function reloadBase()  { loadBase(); clearCache(); }

// ── Idiomas soportados para !setlang / !setidioma ─────────────────────
const SUPPORTED = {
  'es': 'Español',  'en': 'English',    'pt': 'Português',
  'fr': 'Français', 'de': 'Deutsch',    'it': 'Italiano',
  'ja': '日本語',    'ko': '한국어',      'zh': '中文',
  'ar': 'العربية',  'ru': 'Русский',    'hi': 'हिन्दी',
  'tr': 'Türkçe',   'nl': 'Nederlands', 'pl': 'Polski',
};

module.exports = { t, getLang, clearCache, reloadBase, SUPPORTED };