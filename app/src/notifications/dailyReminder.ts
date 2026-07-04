import * as Notifications from 'expo-notifications';
import { DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_MINUTE } from '../constants';

const REMINDER_IDENTIFIER = 'daily-verse-reminder';

export async function scheduleDailyReminder(): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: { title: 'Faith', body: 'Your verse of the day is ready.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: DEFAULT_REMINDER_HOUR,
      minute: DEFAULT_REMINDER_MINUTE,
    },
  });
}
