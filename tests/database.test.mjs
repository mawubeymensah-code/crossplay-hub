import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

// A real PostgreSQL engine with minimal emulated Supabase auth/storage tables.
// Run outside Vitest's worker sandbox to keep WASM runtime teardown independent.
const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const path = `${alice}/33333333-3333-4333-8333-333333333333.mp4`;
before(async () => {
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to authenticated;
    insert into auth.users values ('${alice}'),('${bob}');
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610140001_initial.sql', import.meta.url), 'utf8'));
});
after(async () => { await db.close(); });
async function asUser(id, sql) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`);
  try { return await db.query(sql); }
  finally { await db.exec('reset role;'); }
}
test('rejects creating another member profile', async () => {
  await assert.rejects(asUser(alice, `insert into profiles(id,username,platform) values ('${bob}','stolen','PC')`));
});
test('allows own profile creation and blocks another user editing it', async () => {
  await asUser(alice, `insert into profiles(id,username,platform) values ('${alice}','alice','PC')`);
  await asUser(bob, `insert into profiles(id,username,platform) values ('${bob}','bob','Xbox')`);
  await asUser(bob, `update profiles set bio='hijacked' where id='${alice}'`);
  assert.equal((await db.query(`select bio from profiles where id='${alice}'`)).rows[0].bio, '');
});
test('enforces profile constraints in the database', async () => {
  await assert.rejects(asUser(alice, `update profiles set username='<script>' where id='${alice}'`));
});
test('rejects uploading into another user folder', async () => {
  await assert.rejects(asUser(bob, `insert into storage.objects(bucket_id,name) values ('gameplay-clips','${path}')`));
});
test('lets owner upload but hides an unpublished object from other members', async () => {
  await asUser(alice, `insert into storage.objects(bucket_id,name) values ('gameplay-clips','${path}')`);
  assert.equal((await asUser(bob, `select * from storage.objects where name='${path}'`)).rows.length, 0);
});
test('rejects publishing metadata for a missing file', async () => {
  const missing = `${alice}/44444444-4444-4444-8444-444444444444.mp4`;
  await assert.rejects(asUser(alice, `insert into clips(user_id,title,game,storage_path) values ('${alice}','Clip','Game','${missing}')`));
});
test('allows owned publication and authenticated viewing', async () => {
  await asUser(alice, `insert into clips(user_id,title,game,storage_path) values ('${alice}','Clip','Game','${path}')`);
  assert.equal((await asUser(bob, 'select * from clips')).rows.length, 1);
  assert.equal((await asUser(bob, `select * from storage.objects where name='${path}'`)).rows.length, 1);
});
test('blocks another member deleting owned metadata and video', async () => {
  await asUser(bob, `delete from clips where storage_path='${path}'`);
  await asUser(bob, `delete from storage.objects where name='${path}'`);
  assert.equal((await db.query('select * from clips')).rows.length, 1);
  assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
});
test('denies anonymous access', async () => {
  await db.exec('set role anon');
  try { await assert.rejects(db.query('select * from clips')); }
  finally { await db.exec('reset role'); }
});
