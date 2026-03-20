'use strict';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║              🌸 KANZANBOT v2 — LOGGER DE CONSOLA 🌸                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

const chalk  = require('chalk');
const config = require('../config');

const MAX_TEXT_LENGTH = 300;

// ── Helpers ───────────────────────────────────────────────────────────

function safeStr(val) {
  if (typeof val === 'string') return val;
  if (val instanceof Promise) return '[Promise]';
  if (val && typeof val === 'object') return JSON.stringify(val).slice(0, 80);
  return String(val ?? '');
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i] || 'B'}`;
}

function getSenderName(jid, store) {
  if (!jid) return '?';
  const num     = jid.split('@')[0].split(':')[0];
  const contact = store?.contacts?.[jid] || store?.contacts?.[`${num}@s.whatsapp.net`];
  const name    = contact?.name || contact?.notify || contact?.verifiedName;
  return name ? `${chalk.cyan(name)} ${chalk.gray('~' + num)}` : chalk.cyan(num);
}

function getChatName(jid, store) {
  if (!jid) return '?';
  if (jid.endsWith('@g.us')) {
    const contact = store?.contacts?.[jid];
    const name    = contact?.name || contact?.subject;
    const short   = jid.split('@')[0].slice(-6);
    return name ? `${chalk.magenta(name)} ${chalk.gray('~' + short)}` : chalk.magenta('Grupo ~' + short);
  }
  const num     = jid.split('@')[0];
  const contact = store?.contacts?.[jid];
  const name    = contact?.name || contact?.notify;
  return name ? `${chalk.blue(name)} ${chalk.gray('~' + num)}` : chalk.blue(num);
}

function getMsgTypeName(msg) {
  const m   = msg.message;
  if (!m) return 'desconocido';
  const key = Object.keys(m)[0] || '';
  const map = {
    conversation        : 'texto',
    extendedTextMessage : 'texto',
    imageMessage        : '📷 imagen',
    videoMessage        : '🎥 video',
    audioMessage        : '🎵 audio',
    stickerMessage      : '🎭 sticker',
    documentMessage     : '📄 documento',
    contactMessage      : '👤 contacto',
    locationMessage     : '📍 ubicación',
    reactionMessage     : '🔁 reacción',
    pollCreationMessage : '📊 encuesta',
    viewOnceMessage     : '🔥 ver una vez',
  };
  if (key === 'audioMessage' && m.audioMessage?.ptt) return '🎤 nota de voz';
  return map[key] || key.replace(/Message$/i, '');
}

function extractText(msg) {
  const m = msg.message;
  if (!m) return '';
  return safeStr(
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  );
}

function isCommand(text) {
  if (!text) return false;
  const prefixes = Array.isArray(config.prefix) ? config.prefix : [config.prefix];
  return prefixes.some(p => text.startsWith(p));
}

function getCommandName(text) {
  const prefixes = Array.isArray(config.prefix) ? config.prefix : [config.prefix];
  for (const p of prefixes) {
    if (text.startsWith(p)) return text.slice(p.length).split(/\s+/)[0];
  }
  return text.split(/\s+/)[0];
}

function colorizeWAFormat(text) {
  if (typeof text !== 'string') return safeStr(text);
  return text
    .replace(/\*(.*?)\*/g,   (_, t) => chalk.bold(t))
    .replace(/_(.*?)_/g,     (_, t) => chalk.italic(t))
    .replace(/~(.*?)~/g,     (_, t) => chalk.strikethrough(t))
    .replace(/```([\s\S]*?)```/g, (_, t) => chalk.bgGray(t));
}

const divider = chalk.gray('─'.repeat(46));
const header  = chalk.gray(`┌${divider}┐`);
const footer  = chalk.gray(`└${divider}┘`);

// ══════════════════════════════════════════════════════════════════════
//   logMessage — Mensajes ENTRANTES (de usuarios)
// ══════════════════════════════════════════════════════════════════════

function logMessage(msg, store, sock) {
  try {
    const { key, message, pushName, messageTimestamp } = msg;
    if (!message) return;

    const remoteJid = key.remoteJid;
    const isGroup   = remoteJid?.endsWith('@g.us');
    const senderJid = isGroup ? key.participant : remoteJid;
    if (key.fromMe) return;
    if (remoteJid === 'status@broadcast') return;

    const time = messageTimestamp
      ? new Date((messageTimestamp.low || messageTimestamp) * 1000)
          .toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const msgId    = (key.id || '').slice(-8).toUpperCase();
    const rawText  = extractText(msg);
    const msgType  = getMsgTypeName(msg);
    const cmd      = isCommand(rawText);

    const senderDisplay = pushName
      ? `${chalk.cyan(pushName)} ${chalk.gray('~' + (senderJid?.split('@')[0] || '?'))}`
      : getSenderName(senderJid, store);

    const chatDisplay = getChatName(remoteJid, store);

    let textLine = '';
    if (rawText) {
      let display = rawText.length > MAX_TEXT_LENGTH
        ? rawText.slice(0, MAX_TEXT_LENGTH) + chalk.gray('...')
        : rawText;

      if (cmd) {
        const cmdName  = getCommandName(rawText);
        const rest     = rawText.slice(rawText.indexOf(cmdName) + cmdName.length);
        const usedPfx  = (Array.isArray(config.prefix) ? config.prefix : [config.prefix])
          .find(p => rawText.startsWith(p)) || '';
        display = chalk.bgYellow.black.bold(` ${usedPfx}${cmdName} `) + chalk.yellow(rest);
      } else {
        display = colorizeWAFormat(display);
      }
      textLine = `│💬  ${display}`;
    }

    const typeColored = cmd
      ? chalk.yellow.bold(`⌨️  ${msgType}`) + chalk.gray(` [cmd: ${getCommandName(rawText)}]`)
      : chalk.white(msgType);

    const lines = [
      header,
      `│ ${chalk.hex('#FFB7C5').bold('🌸 KanzanBot')}  ${chalk.gray('#' + msgId)}  ${chalk.gray(time)}`,
      `│👤  ${senderDisplay}`,
      `│💬  ${isGroup ? '👥 ' : '🔒 '}${chatDisplay}`,
      `│📋  ${typeColored}`,
      textLine,
      footer,
    ].filter(Boolean);

    console.log(lines.join('\n'));
  } catch (err) {
    console.error(chalk.red('[LOGGER] Error:'), err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════
//   logOutgoing — Mensajes SALIENTES del bot
//
//   🤖 Morado  → respuesta automática de un plugin (Baileys)
//   🔵 Azul    → escrito manualmente desde el teléfono del número del bot
//
//   Para NO llenar la consola con el menú completo, el welcome, etc.,
//   los mensajes del bot (Baileys) se muestran de forma compacta:
//   solo el tipo de contenido, NO el texto completo.
// ══════════════════════════════════════════════════════════════════════

function logOutgoing(toJid, content, store, isManual = false) {
  try {
    const isGroup = toJid?.endsWith('@g.us');
    const time    = new Date().toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const chatDisplay = getChatName(toJid, store);

    // ── Determinar tipo de contenido enviado ──────────────────────
    let contentType = '📨 Mensaje de texto';
    if (content?.image)    contentType = '📷 Imagen';
    if (content?.video)    contentType = '🎥 Video';
    if (content?.audio)    contentType = '🎵 Audio';
    if (content?.sticker)  contentType = '🎭 Sticker';
    if (content?.document) contentType = '📄 Documento';
    if (content?.react)    contentType = `🔁 Reacción: ${content.react?.text || ''}`;
    if (content?.image && content?.caption) contentType = '📷 Imagen con caption';
    if (content?.video && content?.caption) contentType = '🎥 Video con caption';

    const icon  = isManual ? '🔵' : '🤖';
    const label = isManual ? chalk.blue.bold('MANUAL')  : chalk.magenta.bold('BOT');
    const color = isManual ? chalk.blue : chalk.magenta;

    // Si es manual, mostrar texto completo (el usuario quiere ver lo que escribió)
    // Si es bot (Baileys), solo mostrar el tipo de contenido
    let detail = '';
    if (isManual) {
      const text = safeStr(content?.text || content?.caption || '');
      if (text) {
        const short = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) + '...' : text;
        detail = `\n│💬  ${color(colorizeWAFormat(short))}`;
      }
    }
    // Si no es manual → solo mostramos el tipo, no el texto

    const lines = [
      chalk.gray(`┌${divider}┐`),
      `│ ${color('🌸 KanzanBot')}  ${chalk.gray(time)}  ${icon} ${label}`,
      `│📤  ${isGroup ? '👥 ' : '🔒 '}${chatDisplay}`,
      `│📋  ${color(contentType)}${detail}`,
      chalk.gray(`└${divider}┘`),
    ];

    console.log(lines.join('\n'));
  } catch (err) {
    console.error(chalk.red('[LOGGER] Error outgoing:'), err.message);
  }
}

module.exports = { logMessage, logOutgoing };