'use strict';

const fs   = require('fs');
const path = require('path');
const axios = require('axios');  // Para peticiones HTTP
const { translateText } = require('../lib/translate');  // Traductor manual

module.exports = {
  // El primero es el principal (aparece en !menu)
  commands: ['ejemplo', 'example', 'test'],
  description: 'Plantilla de ejemplo con todos los tipos de envío',
  // Categoría del menú: 'grupo' | 'owner' | 'utilidades' | 'general' | 'info' | 'serbot'
  category: 'general',
  ownerOnly  : false,  // Solo owner del bot
  rownOnly   : false,  // Solo rowner (propietario real)
  adminOnly  : false,  // Solo admins del grupo
  groupOnly  : false,  // Solo en grupos
  privateOnly: false,  // Solo en privado
  premiumOnly: false,  // Solo usuarios premium
  botAdmin   : false,  // El bot debe ser admin del grupo
  restrict   : false,  // Bloqueado cuando !restrict está activo

  async execute(ctx) {
    // ── Variables del contexto disponibles ─────────────────────────
    const {
      sock,           // Socket de Baileys (acceso completo a la API de WA)
      msg,            // Objeto mensaje original de Baileys
      remoteJid,      // JID del chat (grupo o privado)
      sender,         // JID del remitente
      pushName,       // Nombre de pantalla del remitente
      fromGroup,      // true si el mensaje viene de un grupo
      args,           // Array de argumentos después del comando
      command,        // Nombre del comando usado
      usedPrefix,     // Prefijo que usó el usuario (!, . etc.)

      groupMetadata,  // Metadata del grupo (null si es privado)
      groupAdmins,    // Array de JIDs de admins del grupo
      botIsAdmin,     // true si el bot es admin del grupo

      isRowner,       // true si es el propietario real
      isOwner,        // true si es owner del bot
      isAdmin,        // true si es admin del grupo
      isPremium,      // true si tiene premium

      // ── Multi-idioma ───────────────────────────────────────────────
      // lang: código del idioma del usuario ('es', 'en', 'ja', etc.)
      // tr(key, vars): traduce una clave de es.json al idioma del usuario
      // tr() devuelve Promise<string> — siempre usa await
      lang,
      tr,

      db,             // Base de datos (getUser, getGroup, isPremium, etc.)
      config,         // Configuración del bot

      // ── Helpers de envío ──────────────────────────────────────────
      reply,          // reply(texto) → responde citando el mensaje
      react,          // react('🌸') → reacciona con emoji al mensaje
      send,           // send(content) → envía sin citar
      sendDM,         // sendDM(jid, content) → envía mensaje privado
    } = ctx;

    const texto = args.join(' ').trim();

    // ── 1. Respuesta de texto simple ─────────────────────────────
    if (command === 'ejemplo') {
      const saludo = await tr('success'); // clave de es.json
      return reply(`*[🌸] Hola ${pushName}!*\n\n${saludo}`);
    }

    // ── 2. Texto con mención ──────────────────────────────────────
    if (command === 'example') {
      const num = sender.split('@')[0];
      return sock.sendMessage(remoteJid, {text    : `*[👋] Hola @${num}, bienvenido!*`, mentions: [sender] }, { quoted: msg });
    }

    // ── 3. Imagen desde URL ───────────────────────────────────────
    if (command === 'test' && args[0] === 'imagen') {
      return sock.sendMessage(remoteJid, { image  : { url: 'https://picsum.photos/800/600' }, caption: `*[📷] Imagen de ejemplo*\n_Enviada por KanzanBot 🌸_` }, { quoted: msg });
    }

    // ── 4. Imagen desde archivo local (en src/) ───────────────────
    if (command === 'test' && args[0] === 'local') {
      const imgPath = path.join(process.cwd(), 'src', 'menu.jpg');
      if (!fs.existsSync(imgPath)) return reply('*[❌] Imagen no encontrada en src/menu.jpg*');
      return sock.sendMessage(remoteJid, { image  : fs.readFileSync(imgPath), caption: '*[📷] Imagen local*' }, { quoted: msg });
    }

    // ── 5. Video desde URL ────────────────────────────────────────
    if (command === 'test' && args[0] === 'video') {
      return sock.sendMessage(remoteJid, { video   : { url: 'https://www.w3schools.com/html/mov_bbb.mp4' }, caption : '*[🎥] Video de ejemplo*', mimetype: 'video/mp4' }, { quoted: msg });
    }

    // ── 6. Audio (nota de voz) ────────────────────────────────────
    if (command === 'test' && args[0] === 'audio') {
      return sock.sendMessage(remoteJid, { audio : { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }, mimetype: 'audio/mpeg', ptt : false }, { quoted: msg }); 
    }

    // ── 7. Sticker desde URL ──────────────────────────────────────
    if (command === 'test' && args[0] === 'sticker') {
      return sock.sendMessage(remoteJid, { sticker: { url: 'https://picsum.photos/512/512' } }, { quoted: msg });
    }

    // ── 8. Documento (PDF, ZIP, etc.) ─────────────────────────────
    if (command === 'test' && args[0] === 'doc') {
      return sock.sendMessage(remoteJid, { document: { url: 'https://www.w3.org/WAI/WCAG21/wcag-2.1.pdf' }, mimetype: 'application/pdf', fileName: 'ejemplo.pdf', caption : '*[📄] Documento de ejemplo*' }, { quoted: msg });
    }

    // ── 9. Mensaje con botones (solo funciona en chat privado en WA) ──
    // WA ha restringido los botones — usar con precaución
    if (command === 'test' && args[0] === 'botones') {
      return sock.sendMessage(remoteJid, {
        text: '*[🔘] Elige una opción:*',
        footer: '_KanzanBot 🌸_',
        buttons: [
          { buttonId: 'opcion_1', buttonText: { displayText: '✅ Opción 1' }, type: 1 },
          { buttonId: 'opcion_2', buttonText: { displayText: '❌ Opción 2' }, type: 1 },
        ],
        headerType: 1,
      }, { quoted: msg });
    }

    // ── 10. Reacción + respuesta con delay ────────────────────────
    if (command === 'test' && args[0] === 'delay') {
      await react('⏳');
      await new Promise(r => setTimeout(r, 2000)); // esperar 2 segundos
      await react('✅');
      return reply('*[✅] Procesado con delay de 2 segundos*');
    }

    // ── 11. Usar el traductor manualmente ─────────────────────────
    // tr() traduce al idioma del usuario automáticamente.
    // Para traducir a un idioma específico usa translateText():
    if (command === 'test' && args[0] === 'traducir') {
      const { translateText } = require('../lib/translate');
      const destLang = args[1] || 'en';
      const textoBase = args.slice(2).join(' ') || '¡Hola desde KanzanBot!';

      await react('🌐');
      try {
        const { text } = await translateText(textoBase, destLang, 'es');
        return reply(`*[🌐] Traducción (es → ${destLang})*\n\n${text}`);
      } catch {
        return reply('*[❌] Error al traducir*');
      }
    }

    // ── 12. Acceso a la base de datos ─────────────────────────────
    if (command === 'test' && args[0] === 'db') {
      const user    = await db.getUser(sender);
      const premium = await db.isPremium(sender);
      return reply(
        `*[🗄️] Tu info en la DB*\n\n` +
        `🆔 JID: \`${sender}\`\n` +
        `🏷️ Nombre: ${user.name || '(sin nombre)'}\n` +
        `🌐 Idioma: ${user.lang || '(hereda)'}\n` +
        `👑 Premium: ${premium ? 'Sí' : 'No'}\n` +
        `🚫 Baneado: ${user.banned ? 'Sí' : 'No'}`
      );
    }

    // ── 13. Mensaje a grupo con admins ────────────────────────────
    if (command === 'test' && args[0] === 'admins' && fromGroup) {
      const adminMentions = groupAdmins;
      const adminText     = groupAdmins.map(j => `@${j.split('@')[0]}`).join(', ');
      return sock.sendMessage(remoteJid, {
        text    : `*[👑] Admins del grupo:*\n${adminText}`,
        mentions: adminMentions,
      }, { quoted: msg });
    }

    // ── Si no hay subcomando, mostrar ayuda ───────────────────────
    return reply(
      `*[🌸] Plugin de Ejemplo*\n\n` +
      `Subcomandos disponibles:\n` +
      `▸ \`!test imagen\`   — Imagen desde URL\n` +
      `▸ \`!test local\`    — Imagen local (src/)\n` +
      `▸ \`!test video\`    — Video desde URL\n` +
      `▸ \`!test audio\`    — Audio MP3\n` +
      `▸ \`!test sticker\`  — Sticker\n` +
      `▸ \`!test doc\`      — Documento PDF\n` +
      `▸ \`!test botones\`  — Botones\n` +
      `▸ \`!test delay\`    — Reacción con delay\n` +
      `▸ \`!test traducir [lang] [texto]\` — Traductor\n` +
      `▸ \`!test db\`       — Ver tu info en la DB\n` +
      `▸ \`!test admins\`   — Listar admins (grupo)`
    );
  },
};
