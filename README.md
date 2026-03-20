c# 🌸 KanzanBot v2

Bot de WhatsApp con @whiskeysockets/baileys — Inspirado en los cerezos japoneses

## Requisitos
- Node.js 18+ (https://nodejs.org)

## Instalación rápida

```powershell
cd KanzanBot
npm install
# Edita config.js → pon tu número en rowner y owner
npm start
```

Escanea el QR: WhatsApp → Tres puntos → Dispositivos vinculados → Vincular dispositivo

## Base de Datos

### JSON local (por defecto)
Sin configurar nada, el bot crea database.json automáticamente.

### MongoDB Atlas (gratuito)
1. Crea cuenta en https://cloud.mongodb.com (cluster M0 Free)
2. Crea usuario en Database Access
3. Agrega 0.0.0.0/0 en Network Access
4. Copia la URI de conexión y pégala en config.js:
   mongoUri: 'mongodb+srv://user:pass@cluster.mongodb.net/kanzanbot'

## Comandos principales

!menu / !help         — Ver todos los comandos
!perfil               — Ver tu perfil
!registro Nombre      — Registrar tu nombre
!setlang es/en/pt     — Tu idioma personal
!traducir en Hola     — Traducir texto

Grupo (admins):
!welcome on/off       — Bienvenida de miembros
!bye on/off           — Despedida de miembros
!antilink on/off      — Anti-links de WhatsApp
!eventos on/off       — Eventos del grupo
!setidioma es/en/pt   — Idioma del grupo

Sub-Bots:
!serbot @numero       — Crear sub-bot con QR
!serbot @numero --code — Código de emparejamiento
!serbot list          — Ver sub-bots activos con uptime
!serbot stop @numero  — Detener (conserva sesión)
!serbot delete @numero — Eliminar completamente
!serbot start @numero — Reconectar uno detenido
!serbot rename @numero Nombre — Renombrar

Owner:
!botinfo              — Info y estadísticas del bot
!addpremium @usuario  — Dar premium
!ban / !unban         — Banear/desbanear usuario
!reload               — Recargar plugins en caliente
!restrict on/off      — Activar/desactivar comandos peligrosos

## Sistema Multi-Idioma
- Usuarios eligen idioma con !setlang
- Grupos tienen idioma default con !setidioma
- Prioridad: idioma personal > idioma del grupo > config
- Idiomas incluidos: es, en, pt
- Para agregar más: crea locales/xx.json copiando es.json

## Sistema Restrict
Protege comandos peligrosos que pueden causar suspensión del número.
!restrict on  — Bloquea esos comandos
!restrict off — Los desbloquea
Cada rowner decide independientemente.

## Crear plugin nuevo
Crea plugins/mi-plugin.js:

module.exports = {
  commands    : ['saludo'],
  description : 'Saluda al usuario',
  category    : 'general',
  restrict    : false,
  async execute(ctx) {
    await ctx.reply('*[🌸] ¡Hola, ' + ctx.pushName + '!*');
  },
};

Luego usa !reload — activo sin reiniciar.

## Imágenes en src/
- src/menu.jpg     — Imagen del menú (800x450 px)
- src/no-photo.jpg — Silueta para usuarios sin foto de perfil (300x300 px)
