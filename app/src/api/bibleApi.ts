export class BibleApiError extends Error {}

const TRANSLATION_CODES: Record<string, string> = {
  KJV: 'kjv',
  WEB: 'web',
};

const BASE_URL = 'https://bible-api.com';

export async function fetchVerseText(reference: string, translation: string): Promise<string> {
  const translationCode = TRANSLATION_CODES[translation];
  if (!translationCode) {
    throw new BibleApiError(`Unsupported translation: ${translation}`);
  }

  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(reference)}?translation=${translationCode}`
  );

  if (!response.ok) {
    throw new BibleApiError(`Bible API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const passage = data?.text?.trim();
  if (!passage) {
    throw new BibleApiError(`No passage found for reference: ${reference}`);
  }

  return passage;
}
