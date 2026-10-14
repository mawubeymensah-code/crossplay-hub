import { describe, expect, it } from 'vitest';
import { filterFeed, MAX_VIDEO_BYTES, validateClip, validateProfile } from '../lib/models';
import { demoClips } from '../lib/demo';

describe('profile validation', () => {
  it('normalizes usernames and trims bio', () => {
    expect(validateProfile({ username: ' PLAYER_1 ', bio: ' hello ', platform: 'PC' }))
      .toEqual({ username: 'player_1', bio: 'hello', platform: 'PC' });
  });
  it('rejects unsafe usernames and oversized bios', () => {
    expect(() => validateProfile({ username: '<script>', bio: '', platform: 'PC' })).toThrow('Username');
    expect(() => validateProfile({ username: 'player', bio: 'a'.repeat(241), platform: 'PC' })).toThrow('Bio');
  });
});
describe('clip validation', () => {
  const input = { title: ' Final round ', game: ' Valorant ' };
  it('trims metadata and selects a safe extension from MIME type', () => {
    expect(validateClip(input, { size: 12, type: 'video/mp4' })).toEqual({ title: 'Final round', game: 'Valorant', extension: 'mp4' });
  });
  it.each([0, MAX_VIDEO_BYTES + 1])('rejects invalid size %s', size => {
    expect(() => validateClip(input, { size, type: 'video/mp4' })).toThrow('50 MiB');
  });
  it('rejects HTML files and blank titles', () => {
    expect(() => validateClip(input, { size: 12, type: 'text/html' })).toThrow('MP4');
    expect(() => validateClip({ ...input, title: ' ' }, { size: 12, type: 'video/mp4' })).toThrow('title');
  });
});
describe('feed search', () => {
  it('combines case-insensitive search with platform filters', () => {
    expect(filterFeed(demoClips, ' ROCKET ', 'Xbox')).toHaveLength(1);
    expect(filterFeed(demoClips, 'rocket', 'PC')).toHaveLength(0);
    expect(filterFeed(demoClips, 'sample_pixel', 'All platforms')).toHaveLength(1);
  });
});
