import { validateClip, type ClipInput } from './models';

// Small injectable adapter makes cleanup and ordering testable without credentials.
export type UploadPort = {
  put(path: string, file: File): Promise<void>;
  insert(row: { user_id: string; title: string; game: string; storage_path: string }): Promise<void>;
  remove(path: string): Promise<void>;
};
export async function uploadClip(port: UploadPort, userId: string, input: ClipInput, file: File,
                                 newId = () => crypto.randomUUID()) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('A valid signed-in user is required.');
  const validated = validateClip(input, file);
  const path = `${userId}/${newId()}.${validated.extension}`;
  await port.put(path, file);
  try {
    await port.insert({ user_id: userId, title: validated.title, game: validated.game, storage_path: path });
  } catch {
    try { await port.remove(path); }
    catch { throw new Error('Clip could not be published and cleanup failed. Ask the project owner to remove the orphaned upload.'); }
    throw new Error('Clip could not be published. The uploaded file was removed. Save your profile and try again.');
  }
  return path;
}
