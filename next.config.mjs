import { validatePublicKey } from './lib/build-config.mjs';
validatePublicKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
/** @type {import('next').NextConfig} */
const config = { output:'export', poweredByHeader:false };
export default config;
