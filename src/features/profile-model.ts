/** Builds an offline introduction from statements the user chose to save. */

import type { VoiceProfile } from '../types';

const maximumDurationTextLength = 360;

/** Keeps the beginning of a long entry short enough to preview aloud. */
function condense(text: string): string {
  const sentences = text.trim().match(/[^。！？!?]+[。！？!?]*/gu);
  const excerpt = sentences?.slice(0, 2).map((sentence) => sentence.trim()).join('') ?? text.trim();
  const characters = Array.from(excerpt);
  if (characters.length > maximumDurationTextLength) {
    return characters.slice(0, maximumDurationTextLength).join('') + '…';
  }
  return /[。！？!?]$/u.test(excerpt) ? excerpt : excerpt + '。';
}

/** Composes a short first-person introduction; no personality is inferred. */
export function buildLocalIntroduction(profile: VoiceProfile): string {
  const starters = profile.entries.filter((entry) => entry.kind === 'intro');
  const diary = profile.entries.filter((entry) => entry.kind === 'diary');
  const selectedEntries = starters.length ? [starters[0], diary[0]] : diary.slice(0, 2);
  const name = profile.name.trim();
  const greeting = name ? `はじめまして、${name}です。` : 'はじめまして。';
  const excerpts = selectedEntries.flatMap((entry) => entry ? [condense(entry.text)] : []);
  return [greeting, ...excerpts, 'よろしくお願いします。'].join('\n');
}

/** Marks an existing draft for review whenever the name or source notes change. */
export function updateProfileSources(
  profile: VoiceProfile,
  changes: Partial<Pick<VoiceProfile, 'name' | 'entries'>>,
): VoiceProfile {
  return {
    ...profile,
    ...changes,
    approved: false,
    introductionReview: profile.introduction
      ? { source: profile.introductionReview?.source ?? 'generated', stale: true }
      : undefined,
  };
}

/** Discards generated text that may quote a removed entry; keeps deliberate edits for review. */
export function removeProfileEntry(profile: VoiceProfile, id: string): VoiceProfile {
  const next = updateProfileSources(profile, {
    entries: profile.entries.filter((entry) => entry.id !== id),
  });
  return next.introductionReview?.source === 'edited'
    ? next
    : { ...next, introduction: '', introductionReview: undefined };
}
