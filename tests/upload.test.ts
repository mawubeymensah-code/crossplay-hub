import { expect, it, vi } from 'vitest';
import { uploadClip } from '../lib/upload';
const user = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const file = new File(['video'], '../../private.mp4', { type: 'video/mp4' });
const input = { title: 'Clip', game: 'Game' };
const port = () => ({ put: vi.fn().mockResolvedValue(undefined), insert: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined) });
it('uses an owned random path rather than the original filename', async () => {
  const p = port();
  expect(await uploadClip(p, user, input, file, () => id)).toBe(`${user}/${id}.mp4`);
  expect(p.insert).toHaveBeenCalledWith({ user_id: user, ...input, storage_path: `${user}/${id}.mp4` });
  expect(p.remove).not.toHaveBeenCalled();
});
it('does not create metadata if storage upload fails', async () => {
  const p = port(); p.put.mockRejectedValue(new Error('Storage unavailable'));
  await expect(uploadClip(p, user, input, file)).rejects.toThrow('Storage unavailable');
  expect(p.insert).not.toHaveBeenCalled();
});
it('cleans up storage if the database insert fails', async () => {
  const p = port(); p.insert.mockRejectedValue(new Error('database private response'));
  await expect(uploadClip(p, user, input, file, () => id)).rejects.toThrow('file was removed');
  expect(p.remove).toHaveBeenCalledWith(`${user}/${id}.mp4`);
});
it('reports failed cleanup instead of claiming it succeeded', async () => {
  const p = port(); p.insert.mockRejectedValue(new Error('database')); p.remove.mockRejectedValue(new Error('storage'));
  await expect(uploadClip(p, user, input, file)).rejects.toThrow('cleanup failed');
});
it('rejects invalid files before any network call', async () => {
  const p = port();
  await expect(uploadClip(p, user, input, new File([], 'empty.mp4', { type: 'video/mp4' }))).rejects.toThrow('non-empty');
  expect(p.put).not.toHaveBeenCalled();
});
