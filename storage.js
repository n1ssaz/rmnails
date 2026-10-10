'use strict';

const fs = require('fs');
const path = require('path');

function writeAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function fileStore(root) {
  const DATA_FILE = path.join(root, 'data', 'content.json');
  const PRIVATE = path.join(root, 'private');
  const AUTH_FILE = path.join(PRIVATE, 'auth.json');
  const BACKUPS = path.join(PRIVATE, 'backups');
  const IMAGES = path.join(root, 'images');

  return {
    kind: 'files',
    async init() {
      try {
        fs.accessSync(path.dirname(DATA_FILE), fs.constants.W_OK);
      } catch (e) {
        console.warn('Warning: the disk is read-only and DATABASE_URL is not set, so admin changes cannot be saved.');
      }
    },
    async getContent() {
      return fs.readFileSync(DATA_FILE, 'utf8');
    },
    async saveContent(json) {
      if (fs.existsSync(DATA_FILE)) {
        fs.mkdirSync(BACKUPS, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(DATA_FILE, path.join(BACKUPS, 'content-' + stamp + '.json'));
        const all = fs.readdirSync(BACKUPS).filter(f => f.startsWith('content-')).sort();
        all.slice(0, Math.max(0, all.length - 30)).forEach(f => fs.unlinkSync(path.join(BACKUPS, f)));
      }
      writeAtomic(DATA_FILE, json);
    },
    async getAuth() {
      return fs.existsSync(AUTH_FILE) ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) : null;
    },
    async saveAuth(auth) {
      fs.mkdirSync(PRIVATE, { recursive: true });
      writeAtomic(AUTH_FILE, JSON.stringify(auth, null, 2));
      fs.chmodSync(AUTH_FILE, 0o600);
    },
    async getImage() {
      return null;
    },
    async putImage(name, data) {
      writeAtomic(path.join(IMAGES, name), data);
    },
    async close() {}
  };
}

function pgStore(root, rawUrl) {
  const { Pool } = require('pg');
  const u = new URL(rawUrl);
  ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'].forEach(k => u.searchParams.delete(k));
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  const sslEnv = String(process.env.DATABASE_SSL || '').toLowerCase();
  const ssl = sslEnv === 'false' || (local && !['true', 'no-verify'].includes(sslEnv)) ? false
    : { rejectUnauthorized: sslEnv !== 'no-verify' };
  const pool = new Pool({ connectionString: u.toString(), ssl, max: 5 });

  async function tx(fn) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const out = await fn(client);
      await client.query('commit');
      return out;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  return {
    kind: 'postgres',
    async init() {
      await pool.query(`create table if not exists rm_settings (
        key text primary key, value jsonb not null, updated_at timestamptz not null default now())`);
      await pool.query(`create table if not exists rm_content_backups (
        id bigserial primary key, saved_at timestamptz not null default now(), value jsonb not null)`);
      await pool.query(`create table if not exists rm_images (
        name text primary key, mime text not null, data bytea not null, updated_at timestamptz not null default now())`);
      const has = await pool.query("select 1 from rm_settings where key = 'content'");
      if (!has.rowCount) {
        const seed = fs.readFileSync(path.join(root, 'data', 'content.json'), 'utf8');
        await pool.query("insert into rm_settings (key, value) values ('content', $1::jsonb) on conflict (key) do nothing", [seed]);
      }
      const authFile = path.join(root, 'private', 'auth.json');
      const hasAuth = await pool.query("select 1 from rm_settings where key = 'auth'");
      if (!hasAuth.rowCount && fs.existsSync(authFile)) {
        await pool.query("insert into rm_settings (key, value) values ('auth', $1::jsonb) on conflict (key) do nothing", [fs.readFileSync(authFile, 'utf8')]);
      }
    },
    async getContent() {
      const r = await pool.query("select value from rm_settings where key = 'content'");
      return JSON.stringify(r.rows[0].value, null, 2);
    },
    async saveContent(json) {
      await tx(async c => {
        await c.query("insert into rm_content_backups (value) select value from rm_settings where key = 'content'");
        await c.query(`insert into rm_settings (key, value, updated_at) values ('content', $1::jsonb, now())
          on conflict (key) do update set value = excluded.value, updated_at = now()`, [json]);
        await c.query('delete from rm_content_backups where id not in (select id from rm_content_backups order by id desc limit 30)');
      });
    },
    async getAuth() {
      const r = await pool.query("select value from rm_settings where key = 'auth'");
      return r.rowCount ? r.rows[0].value : null;
    },
    async saveAuth(auth) {
      await pool.query(`insert into rm_settings (key, value, updated_at) values ('auth', $1::jsonb, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(auth)]);
    },
    async getImage(name) {
      const r = await pool.query('select mime, data from rm_images where name = $1', [name]);
      return r.rowCount ? { type: r.rows[0].mime, data: r.rows[0].data } : null;
    },
    async putImage(name, data, type) {
      await pool.query(`insert into rm_images (name, mime, data, updated_at) values ($1, $2, $3, now())
        on conflict (name) do update set mime = excluded.mime, data = excluded.data, updated_at = now()`, [name, type, data]);
    },
    async close() {
      await pool.end();
    }
  };
}

module.exports = function createStore(root) {
  const url = process.env.DATABASE_URL;
  return url ? pgStore(root, url) : fileStore(root);
};
