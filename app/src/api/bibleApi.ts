export class BibleApiError extends Error {}

const TRANSLATION_BIBLE_IDS: Record<string, string> = {
  KJV: 'de4e12af7f28f599-02',
  WEB: '9879dbb7cfe39e4d-04',
};

const BASE_URL = 'https://api.scripture.api.bible/v1';

export async function fetchVerseText(
  reference: string,
  translation: string,
  apiKey: string
): Promise<string> {
  const bibleId = TRANSLATION_BIBLE_IDS[translation];
  if (!bibleId) {
    throw new BibleApiError(`Unsupported translation: ${translation}`);
  }

  const response = await fetch(
    `${BASE_URL}/bibles/${bibleId}/search?query=${encodeURIComponent(reference)}`,
    { headers: { 'api-key': apiKey } }
  );

  if (!response.ok) {
    throw new BibleApiError(`Bible API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const passage = data?.data?.passages?.[0]?.content;
  if (!passage) {
    throw new BibleApiError(`No passage found for reference: ${reference}`);
  }

  return passage;
}
