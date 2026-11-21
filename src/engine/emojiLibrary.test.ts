import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOJI_STICKER_LIBRARY, filterEmojiStickers } from './emojiLibrary';

test('emoji sticker library contains rich categorized curated items', () => {
  assert.ok(EMOJI_STICKER_LIBRARY.length >= 35);
  const reactions = filterEmojiStickers('Reactions', '');
  assert.ok(reactions.length >= 6);
  const search = filterEmojiStickers('All', 'fire');
  assert.ok(search.some((i) => i.emoji === '🔥'));
});
