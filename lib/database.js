'use strict';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║           🌸 KANZANBOT v2 — BASE DE DATOS (Híbrida) 🌸              ║
// ║                                                                      ║
// ║  Modo MongoDB : Se activa si config.mongoUri tiene valor.            ║
// ║  Modo JSON    : Usa database.json si mongoUri está vacío.            ║
// ║                                                                      ║
// ║  MongoDB Atlas gratuito (M0):                                        ║
// ║    1. Crea cuenta en https://cloud.mongodb.com                       ║
// ║    2. Crea un cluster M0 (Free)                                      ║
// ║    3. En Database Access: agrega un usuario con contraseña           ║
// ║    4. En Network Access: agrega tu IP (o 0.0.0.0/0 para todo)       ║
// ║    5. Copia la URI de conexión y pégala en config.mongoUri           ║
// ╚══════════════════════════════════════════════════════════════════════╝

const fs       = require('fs');
const path     = require('path');
const config   = require('../config');

// ── Modo de la base de datos (se resuelve al iniciar) ─────────────────
let USE_MONGO = false;
let mongoose;

// ══════════════════════════════════════════════════════════════════════
//   SCHEMAS DE MONGOOSE
// ══════════════════════════════════════════════════════════════════════

let UserModel, GroupModel, LidModel, SubbotModel;

function defineMongoModels() {
  const { Schema, model, models } = mongoose;

  const UserSchema = new Schema({
    jid          : { type: String, required: true, unique: true },
    name         : { type: String, default: '' },
    lang         : { type: String, default: '' },
    premium      : { type: Boolean, default: false },
    premiumExpiry: { type: Number, default: null },
    banned       : { type: Boolean, default: false },
    bannedReason : { type: String, default: '' },
    warns        : { type: Number, default: 0 },
    createdAt    : { type: Number, default: () => Date.now() },
  });

  const GroupSchema = new Schema({
    jid     : { type: String, required: true, unique: true },
    welcome : { type: Boolean, default: true },
    bye     : { type: Boolean, default: true },
    lang    : { type: String, default: '' },
    antilink: { type: Boolean, default: false },
    antilinkAction    : { type: String, default: 'delete' },
    antilinkWarnCount : { type: Map, of: Number, default: {} },
    events: {
      active      : { type: Boolean, default: true },
      adminChange : { type: Boolean, default: true },
      descChange  : { type: Boolean, default: true },
      photoChange : { type: Boolean, default: true },
      memberChange: { type: Boolean, default: true },
      notifyAdmins: { type: Boolean, default: false },
    },
  });

  const LidSchema = new Schema({
    lid    : { type: String, required: true, unique: true },
    realJid: { type: String, required: true },
  });

  const SubbotSchema = new Schema({
    ownerId  : { type: String, required: true },  // JID del dueño
    phone    : { type: String, required: true },  // Número del sub-bot
    name     : { type: String, default: 'SubBot' },
    status   : { type: String, default: 'active' }, // active | stopped | deleted
    connectedAt : { type: Number, default: null },
    reconnects  : { type: Number, default: 0 },
  });

  UserModel   = models.User    || model('User',   UserSchema);
  GroupModel  = models.Group   || model('Group',  GroupSchema);
  LidModel    = models.Lid     || model('Lid',    LidSchema);
  SubbotModel = models.Subbot  || model('Subbot', SubbotSchema);
}

// ══════════════════════════════════════════════════════════════════════
//   INIT — CONECTAR A MONGODB O PREPARAR JSON
// ══════════════════════════════════════════════════════════════════════

async function init() {
  if (config.mongoUri && config.mongoUri.trim() !== '') {
    try {
      mongoose = require('mongoose');
      await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 8000,
      });
      defineMongoModels();
      USE_MONGO = true;
      console.log('\x1b[32m  [DB] ✅ Conectado a MongoDB Atlas\x1b[0m');
    } catch (err) {
      console.warn('\x1b[33m  [DB] ⚠️  No se pudo conectar a MongoDB, usando JSON local.\x1b[0m');
      console.warn(`  [DB] Error: ${err.message}`);
      USE_MONGO = false;
      ensureJsonDb();
    }
  } else {
    USE_MONGO = false;
    ensureJsonDb();
    console.log('\x1b[36m  [DB] 📁 Usando base de datos JSON local (database.json)\x1b[0m');
  }
}

// ══════════════════════════════════════════════════════════════════════
//   MODO JSON — HELPERS
// ══════════════════════════════════════════════════════════════════════

const DB_PATH = path.resolve(process.cwd(), config.dbPath);

const DEFAULT_DB = {
  groups : {},
  users  : {},
  lidMap : {},
  subbots: {},
};

const DEFAULT_GROUP = {
  welcome : true, bye: true, lang: '',
  antilink: false, antilinkAction: 'delete', antilinkWarnCount: {},
  events  : { active: true, adminChange: true, descChange: true, photoChange: true, memberChange: true, notifyAdmins: false },
};

const DEFAULT_USER = {
  name: '', lang: '', premium: false, premiumExpiry: null,
  banned: false, bannedReason: '', warns: 0, createdAt: Date.now(),
};

function ensureJsonDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function loadJson() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch { return JSON.parse(JSON.stringify(DEFAULT_DB)); }
}

function saveJson(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('[DB] Error guardando JSON:', e.message); }
}

// ══════════════════════════════════════════════════════════════════════
//   USUARIOS
// ══════════════════════════════════════════════════════════════════════

async function getUser(jid) {
  if (USE_MONGO) {
    let u = await UserModel.findOne({ jid }).lean();
    if (!u) { await UserModel.create({ jid, ...DEFAULT_USER }); u = { jid, ...DEFAULT_USER }; }
    return Object.assign({}, DEFAULT_USER, u);
  }
  const db = loadJson();
  if (!db.users[jid]) { db.users[jid] = { ...DEFAULT_USER }; saveJson(db); }
  return Object.assign({}, DEFAULT_USER, db.users[jid]);
}

async function setUser(jid, data) {
  if (USE_MONGO) {
    await UserModel.updateOne({ jid }, { $set: data }, { upsert: true });
    return;
  }
  const db = loadJson();
  db.users[jid] = { ...(await getUser(jid)), ...data };
  saveJson(db);
}

// ══════════════════════════════════════════════════════════════════════
//   GRUPOS
// ══════════════════════════════════════════════════════════════════════

async function getGroup(jid) {
  if (USE_MONGO) {
    let g = await GroupModel.findOne({ jid }).lean();
    if (!g) { await GroupModel.create({ jid }); g = { jid }; }
    return Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_GROUP)), g);
  }
  const db = loadJson();
  if (!db.groups[jid]) { db.groups[jid] = JSON.parse(JSON.stringify(DEFAULT_GROUP)); saveJson(db); }
  return Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_GROUP)), db.groups[jid]);
}

async function setGroup(jid, data) {
  if (USE_MONGO) {
    await GroupModel.updateOne({ jid }, { $set: data }, { upsert: true });
    return;
  }
  const db = loadJson();
  db.groups[jid] = { ...(await getGroup(jid)), ...data };
  saveJson(db);
}

async function updateGroupField(jid, field, value) {
  const group = await getGroup(jid);
  const parts = field.split('.');
  let obj = group;
  for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
  obj[parts[parts.length - 1]] = value;
  await setGroup(jid, group);
}

async function getGroupField(jid, field) {
  const group = await getGroup(jid);
  return field.split('.').reduce((o, k) => o?.[k], group);
}

// ══════════════════════════════════════════════════════════════════════
//   PREMIUM / BAN / WARNS
// ══════════════════════════════════════════════════════════════════════

async function isPremium(jid) {
  const u = await getUser(jid);
  if (!u.premium) return false;
  if (u.premiumExpiry && Date.now() > u.premiumExpiry) {
    await setUser(jid, { premium: false, premiumExpiry: null });
    return false;
  }
  return true;
}
async function addPremium(jid, days = null) {
  const expiry = days ? Date.now() + days * 86400000 : null;
  await setUser(jid, { premium: true, premiumExpiry: expiry });
}
async function removePremium(jid) { await setUser(jid, { premium: false, premiumExpiry: null }); }

async function isBanned(jid) { return (await getUser(jid)).banned === true; }
async function banUser(jid, reason = '') { await setUser(jid, { banned: true, bannedReason: reason }); }
async function unbanUser(jid) { await setUser(jid, { banned: false, bannedReason: '' }); }

async function addWarn(jid) {
  const u = await getUser(jid);
  const warns = (u.warns || 0) + 1;
  await setUser(jid, { warns });
  return warns;
}
async function resetWarns(jid) { await setUser(jid, { warns: 0 }); }

// ══════════════════════════════════════════════════════════════════════
//   LID MAP
// ══════════════════════════════════════════════════════════════════════

async function storeLid(lid, realJid) {
  if (!lid?.endsWith('@lid') || !realJid || realJid.endsWith('@lid')) return;
  if (USE_MONGO) {
    await LidModel.updateOne({ lid }, { $set: { realJid } }, { upsert: true });
    return;
  }
  const db = loadJson();
  db.lidMap[lid] = realJid;
  saveJson(db);
}

async function resolveLidFromDB(lid) {
  if (!lid?.endsWith('@lid')) return lid;
  if (USE_MONGO) {
    const rec = await LidModel.findOne({ lid }).lean();
    return rec?.realJid || lid;
  }
  const db = loadJson();
  return db.lidMap[lid] || lid;
}

// ══════════════════════════════════════════════════════════════════════
//   ANTILINK WARNS
// ══════════════════════════════════════════════════════════════════════

async function getAntilinkWarn(groupJid, userJid) {
  const g = await getGroup(groupJid);
  const map = g.antilinkWarnCount || {};
  return map[userJid] || 0;
}
async function addAntilinkWarn(groupJid, userJid) {
  const g = await getGroup(groupJid);
  if (!g.antilinkWarnCount) g.antilinkWarnCount = {};
  g.antilinkWarnCount[userJid] = (g.antilinkWarnCount[userJid] || 0) + 1;
  await setGroup(groupJid, g);
  return g.antilinkWarnCount[userJid];
}
async function resetAntilinkWarn(groupJid, userJid) {
  const g = await getGroup(groupJid);
  if (!g.antilinkWarnCount) g.antilinkWarnCount = {};
  g.antilinkWarnCount[userJid] = 0;
  await setGroup(groupJid, g);
}

// ══════════════════════════════════════════════════════════════════════
//   SUBBOTS
// ══════════════════════════════════════════════════════════════════════

async function getSubbot(phone) {
  if (USE_MONGO) return SubbotModel.findOne({ phone }).lean();
  const db = loadJson();
  return db.subbots?.[phone] || null;
}

async function setSubbot(phone, data) {
  if (USE_MONGO) {
    await SubbotModel.updateOne({ phone }, { $set: data }, { upsert: true });
    return;
  }
  const db = loadJson();
  if (!db.subbots) db.subbots = {};
  db.subbots[phone] = { ...(db.subbots[phone] || {}), ...data };
  saveJson(db);
}

async function deleteSubbot(phone) {
  if (USE_MONGO) { await SubbotModel.deleteOne({ phone }); return; }
  const db = loadJson();
  delete db.subbots?.[phone];
  saveJson(db);
}

async function listSubbots(ownerId) {
  if (USE_MONGO) return SubbotModel.find({ ownerId }).lean();
  const db = loadJson();
  return Object.values(db.subbots || {}).filter(s => s.ownerId === ownerId);
}

// ══════════════════════════════════════════════════════════════════════
//   STATS (para !botinfo)
// ══════════════════════════════════════════════════════════════════════

async function getStats() {
  if (USE_MONGO) {
    const [users, groups, premium, subbots] = await Promise.all([
      UserModel.countDocuments(),
      GroupModel.countDocuments(),
      UserModel.countDocuments({ premium: true }),
      SubbotModel.countDocuments(),
    ]);
    return { users, groups, premium, subbots };
  }
  const db = loadJson();
  const users   = Object.keys(db.users || {}).length;
  const groups  = Object.keys(db.groups || {}).length;
  const premium = Object.values(db.users || {}).filter(u => u.premium).length;
  const subbots = Object.keys(db.subbots || {}).length;
  return { users, groups, premium, subbots };
}

// ══════════════════════════════════════════════════════════════════════
//   EXPORTACIONES
// ══════════════════════════════════════════════════════════════════════

module.exports = {
  init, isMongoMode: () => USE_MONGO,
  loadJson, saveJson,
  getUser, setUser,
  getGroup, setGroup, updateGroupField, getGroupField,
  isPremium, addPremium, removePremium,
  isBanned, banUser, unbanUser,
  addWarn, resetWarns,
  storeLid, resolveLidFromDB,
  getAntilinkWarn, addAntilinkWarn, resetAntilinkWarn,
  getSubbot, setSubbot, deleteSubbot, listSubbots,
  getStats,
};
