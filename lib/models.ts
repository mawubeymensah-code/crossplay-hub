export const platforms = ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile'] as const;
export type Platform = typeof platforms[number];
export type Profile = { id: string; username: string; bio: string; platform: Platform };
export type Clip = { id: string; user_id: string; title: string; game: string; storage_path: string;
  created_at: string; profiles: Pick<Profile, 'username' | 'platform'> | null; url?: string };
export type ClipInput = { title: string; game: string };
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const formats: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

export function validateProfile(value: Pick<Profile, 'username' | 'bio' | 'platform'>) {
  const username = value.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Username must be 3–24 lowercase letters, numbers, or underscores.');
  if (value.bio.trim().length > 240) throw new Error('Bio must be 240 characters or fewer.');
  if (!platforms.includes(value.platform)) throw new Error('Choose a supported platform.');
  return { username, bio: value.bio.trim(), platform: value.platform };
}
export function validateClip(input: ClipInput, file: { size: number; type: string }) {
  const title = input.title.trim(), game = input.game.trim();
  if (!title || title.length > 100) throw new Error('Enter a clip title of 1–100 characters.');
  if (!game || game.length > 60) throw new Error('Enter a game name of 1–60 characters.');
  if (!formats[file.type]) throw new Error('Choose an MP4, WebM, or MOV video.');
  if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) throw new Error('Video must be non-empty and 50 MiB or smaller.');
  return { title, game, extension: formats[file.type] };
}
export function filterFeed(clips: Clip[], query: string, platform: string) {
  const term = query.trim().toLowerCase();
  return clips.filter(clip => (platform === 'All platforms' || clip.profiles?.platform === platform)
    && [clip.title, clip.game, clip.profiles?.username ?? ''].some(value => value.toLowerCase().includes(term)));
}
