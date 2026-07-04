jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

import * as Notifications from 'expo-notifications';
import { scheduleDailyReminder } from '../src/notifications/dailyReminder';

describe('scheduleDailyReminder', () => {
  beforeEach(() => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockReset();
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockReset();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockReset();
  });

  test('schedules a daily 8:00am reminder when permission is granted', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    await scheduleDailyReminder();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'daily-verse-reminder'
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'daily-verse-reminder',
      content: { title: 'Faith', body: 'Your verse of the day is ready.' },
      trigger: { type: 'daily', hour: 8, minute: 0 },
    });
  });

  test('does not schedule anything when permission is denied', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await scheduleDailyReminder();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
