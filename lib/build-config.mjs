/** Server/build-only validation. Never import from client components. */
export function validatePublicKey(key) {
  if (!key || key.startsWith('sb_publishable_')) return;
  if (key.split('.').length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (claims.role === 'anon') return;
    } catch { /* Reject malformed or privileged keys below. */ }
  }
  throw new Error('Configure a Supabase publishable key or legacy anon key. Secret and service-role keys must never be used in NEXT_PUBLIC variables.');
}
