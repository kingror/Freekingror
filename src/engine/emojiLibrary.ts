export type EmojiCategory = 'Reactions' | 'Cinema' | 'FX' | 'Social' | 'Badges';

export interface EmojiStickerItem {
  id: string;
  emoji: string;
  label: string;
  category: EmojiCategory;
  defaultGlow: string;
}

export const EMOJI_CATEGORIES: ('All' | EmojiCategory)[] = [
  'All',
  'Reactions',
  'Cinema',
  'FX',
  'Social',
  'Badges',
];

export const EMOJI_STICKER_LIBRARY: EmojiStickerItem[] = [
  // Reactions
  { id: 'em_fire', emoji: '🔥', label: 'Fire Hype', category: 'Reactions', defaultGlow: '#f97316' },
  { id: 'em_heart', emoji: '❤️‍🔥', label: 'Heart Flame', category: 'Reactions', defaultGlow: '#f43f5e' },
  { id: 'em_mindblown', emoji: '🤯', label: 'Mind Blown', category: 'Reactions', defaultGlow: '#f59e0b' },
  { id: 'em_100', emoji: '💯', label: '100 Score', category: 'Reactions', defaultGlow: '#ef4444' },
  { id: 'em_laugh', emoji: '😂', label: 'Laugh Tear', category: 'Reactions', defaultGlow: '#facc15' },
  { id: 'em_cool', emoji: '😎', label: 'Sunglasses', category: 'Reactions', defaultGlow: '#38bdf8' },
  { id: 'em_clap', emoji: '👏', label: 'Applause', category: 'Reactions', defaultGlow: '#fbbf24' },
  { id: 'em_party', emoji: '🥳', label: 'Celebrate', category: 'Reactions', defaultGlow: '#ec4899' },
  { id: 'em_wow', emoji: '🤩', label: 'Star Struck', category: 'Reactions', defaultGlow: '#eab308' },
  { id: 'em_shock', emoji: '😱', label: 'Shocked', category: 'Reactions', defaultGlow: '#60a5fa' },

  // Cinema
  { id: 'em_clapper', emoji: '🎬', label: 'Slate Cut', category: 'Cinema', defaultGlow: '#22d3ee' },
  { id: 'em_cam', emoji: '🎥', label: 'Cinema Cam', category: 'Cinema', defaultGlow: '#38bdf8' },
  { id: 'em_film', emoji: '🎞️', label: 'Film Strip', category: 'Cinema', defaultGlow: '#f59e0b' },
  { id: 'em_popcorn', emoji: '🍿', label: 'Premiere', category: 'Cinema', defaultGlow: '#fbbf24' },
  { id: 'em_mic', emoji: '🎙️', label: 'Studio Mic', category: 'Cinema', defaultGlow: '#34d399' },
  { id: 'em_music', emoji: '🎵', label: 'Beat Note', category: 'Cinema', defaultGlow: '#a855f7' },
  { id: 'em_trophy', emoji: '🏆', label: 'Award Gold', category: 'Cinema', defaultGlow: '#facc15' },
  { id: 'em_spotlight', emoji: '🎭', label: 'Drama Stage', category: 'Cinema', defaultGlow: '#fb7185' },

  // FX
  { id: 'em_sparkles', emoji: '✨', label: 'Sparkles', category: 'FX', defaultGlow: '#fde047' },
  { id: 'em_bolt', emoji: '⚡', label: 'High Voltage', category: 'FX', defaultGlow: '#facc15' },
  { id: 'em_boom', emoji: '💥', label: 'Impact Boom', category: 'FX', defaultGlow: '#fb923c' },
  { id: 'em_dizzy', emoji: '💫', label: 'Star Orbit', category: 'FX', defaultGlow: '#38bdf8' },
  { id: 'em_rainbow', emoji: '🌈', label: 'Prism Arc', category: 'FX', defaultGlow: '#c084fc' },
  { id: 'em_comet', emoji: '☄️', label: 'Meteor FX', category: 'FX', defaultGlow: '#f97316' },
  { id: 'em_snowflake', emoji: '❄️', label: 'Frost Ice', category: 'FX', defaultGlow: '#67e8f9' },
  { id: 'em_tornado', emoji: '🌪️', label: 'Whirl Spin', category: 'FX', defaultGlow: '#94a3b8' },

  // Social
  { id: 'em_rocket', emoji: '🚀', label: 'Viral Launch', category: 'Social', defaultGlow: '#38bdf8' },
  { id: 'em_bell', emoji: '🔔', label: 'Subscribe Bell', category: 'Social', defaultGlow: '#facc15' },
  { id: 'em_thumbs', emoji: '👍', label: 'Like Boost', category: 'Social', defaultGlow: '#60a5fa' },
  { id: 'em_crown', emoji: '👑', label: 'Creator Crown', category: 'Social', defaultGlow: '#fbbf24' },
  { id: 'em_gem', emoji: '💎', label: 'Diamond Pro', category: 'Social', defaultGlow: '#22d3ee' },
  { id: 'em_eyes', emoji: '👀', label: 'Watch Closely', category: 'Social', defaultGlow: '#e2e8f0' },
  { id: 'em_phone', emoji: '📲', label: 'Share Reel', category: 'Social', defaultGlow: '#34d399' },
  { id: 'em_globe', emoji: '🌍', label: 'Worldwide', category: 'Social', defaultGlow: '#38bdf8' },

  // Badges
  { id: 'em_check', emoji: '✅', label: 'Verified OK', category: 'Badges', defaultGlow: '#34d399' },
  { id: 'em_arrow_up', emoji: '⬆️', label: 'Point Up', category: 'Badges', defaultGlow: '#22d3ee' },
  { id: 'em_arrow_right', emoji: '➡️', label: 'Point Right', category: 'Badges', defaultGlow: '#f59e0b' },
  { id: 'em_pin', emoji: '📍', label: 'Location Pin', category: 'Badges', defaultGlow: '#f43f5e' },
  { id: 'em_alarm', emoji: '🚨', label: 'Alert Siren', category: 'Badges', defaultGlow: '#ef4444' },
  { id: 'em_target', emoji: '🎯', label: 'Focus Target', category: 'Badges', defaultGlow: '#f43f5e' },
  { id: 'em_lock', emoji: '🔒', label: 'Exclusive', category: 'Badges', defaultGlow: '#fbbf24' },
  { id: 'em_star', emoji: '⭐', label: '5-Star Pick', category: 'Badges', defaultGlow: '#facc15' },
];

export function filterEmojiStickers(
  category: 'All' | EmojiCategory,
  query: string
): EmojiStickerItem[] {
  const q = query.trim().toLowerCase();
  return EMOJI_STICKER_LIBRARY.filter((item) => {
    if (category !== 'All' && item.category !== category) return false;
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.emoji.includes(q)
    );
  });
}
