import { expect, it } from 'vitest';
import { validatePublicKey } from '../lib/build-config.mjs';
const jwt = (role:string) => 'header.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
it('allows absent configuration for the explicit demo',()=>{expect(()=>validatePublicKey(undefined)).not.toThrow();});
it('allows publishable and legacy anon keys',()=>{expect(()=>validatePublicKey('sb_publishable_test-fixture')).not.toThrow();expect(()=>validatePublicKey(jwt('anon'))).not.toThrow();});
it('rejects privileged keys before client bundling',()=>{expect(()=>validatePublicKey('sb_secret_test-fixture')).toThrow('publishable');expect(()=>validatePublicKey(jwt('service_role'))).toThrow('publishable');});
it('rejects malformed configuration without repeating its value',()=>{expect(()=>validatePublicKey('test-invalid-key')).toThrow('Configure a Supabase');});
