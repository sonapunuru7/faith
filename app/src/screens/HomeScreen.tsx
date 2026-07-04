import { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, ScrollView } from 'react-native';
import { auth } from '../firebase/config';
import { fetchDailyVerseDoc } from '../firebase/dailyVerse';
import { markVerseViewed, saveJournalAnswers } from '../firebase/engagement';
import { fetchVerseText } from '../api/bibleApi';
import { scheduleDailyReminder } from '../notifications/dailyReminder';
import { getTodayDateString } from '../utils/date';
import { DEFAULT_TRANSLATION } from '../constants';
import { showAlert } from '../utils/alert';

type Status = 'loading' | 'ready' | 'no-verse' | 'error';

export function HomeScreen() {
  const [verseText, setVerseText] = useState('');
  const [reference, setReference] = useState('');
  const [prompts, setPrompts] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    scheduleDailyReminder().catch(() => {});

    const uid = auth.currentUser?.uid;
    const date = getTodayDateString();

    (async () => {
      try {
        const dailyVerse = await fetchDailyVerseDoc(date);
        if (!dailyVerse) {
          setStatus('no-verse');
          return;
        }
        setReference(dailyVerse.reference);
        setPrompts(dailyVerse.journalPrompts);

        const text = await fetchVerseText(dailyVerse.reference, DEFAULT_TRANSLATION);
        setVerseText(text);
        setStatus('ready');

        if (uid) {
          markVerseViewed(uid, date).catch(() => {});
        }
      } catch (error) {
        setStatus('error');
        showAlert('Could not load today’s verse', (error as Error).message);
      }
    })();
  }, []);

  const handleSaveReflections = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      return;
    }
    try {
      await saveJournalAnswers(uid, getTodayDateString(), answers);
    } catch (error) {
      showAlert('Could not save your reflections', (error as Error).message);
    }
  };

  if (status === 'loading') {
    return (
      <View>
        <Text>Welcome to Faith</Text>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'no-verse') {
    return (
      <View>
        <Text>Welcome to Faith</Text>
        <Text>Today's verse isn't available yet — check back soon.</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View>
        <Text>Welcome to Faith</Text>
        <Text>Something went wrong loading today's verse.</Text>
      </View>
    );
  }

  return (
    <ScrollView>
      <Text>Welcome to Faith</Text>
      <Text>{reference}</Text>
      <Text>{verseText}</Text>
      {prompts.map((prompt, index) => (
        <View key={index}>
          <Text>{prompt}</Text>
          <TextInput
            testID={`journal-answer-${index}`}
            value={answers[String(index)] ?? ''}
            onChangeText={(text) =>
              setAnswers((prev) => ({ ...prev, [String(index)]: text }))
            }
          />
        </View>
      ))}
      <Button title="Save reflections" onPress={handleSaveReflections} />
    </ScrollView>
  );
}
