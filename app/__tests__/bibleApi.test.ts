import { fetchVerseText, BibleApiError } from '../src/api/bibleApi';

describe('fetchVerseText', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test('returns verse text for a supported translation', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        reference: 'John 3:16',
        text: 'For God so loved the world...\n',
        translation_id: 'kjv',
      }),
    });

    const text = await fetchVerseText('John 3:16', 'KJV');

    expect(text).toBe('For God so loved the world...');
    expect(global.fetch).toHaveBeenCalledWith('https://bible-api.com/John%203%3A16?translation=kjv');
  });

  test('throws BibleApiError for an unsupported translation', async () => {
    await expect(fetchVerseText('John 3:16', 'MSG')).rejects.toThrow(BibleApiError);
  });

  test('throws BibleApiError when the API responds with an error status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await expect(fetchVerseText('John 3:16', 'KJV')).rejects.toThrow(BibleApiError);
  });

  test('throws BibleApiError when no passage is found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ text: '' }),
    });

    await expect(fetchVerseText('Nonexistent 1:1', 'KJV')).rejects.toThrow(BibleApiError);
  });
});
