import { fetchVerseText, BibleApiError } from '../src/api/bibleApi';

describe('fetchVerseText', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test('returns verse text for a supported translation', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { passages: [{ content: 'For God so loved the world...' }] },
      }),
    });

    const text = await fetchVerseText('John 3:16', 'KJV', 'test-key');

    expect(text).toBe('For God so loved the world...');
  });

  test('throws BibleApiError for an unsupported translation', async () => {
    await expect(fetchVerseText('John 3:16', 'MSG', 'test-key')).rejects.toThrow(
      BibleApiError
    );
  });

  test('throws BibleApiError when the API responds with an error status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await expect(fetchVerseText('John 3:16', 'KJV', 'test-key')).rejects.toThrow(
      BibleApiError
    );
  });

  test('throws BibleApiError when no passage is found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { passages: [] } }),
    });

    await expect(
      fetchVerseText('Nonexistent 1:1', 'KJV', 'test-key')
    ).rejects.toThrow(BibleApiError);
  });
});
