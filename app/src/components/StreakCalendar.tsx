import { View, Text } from 'react-native';

interface StreakCalendarProps {
  year: number;
  month: number;
  engagedDates: Set<string>;
  currentStreak: number;
  longestStreak: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function StreakCalendar({
  year,
  month,
  engagedDates,
  currentStreak,
  longestStreak,
}: StreakCalendarProps) {
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, index) => index + 1);

  return (
    <View testID="streak-calendar">
      <Text>Current streak: {currentStreak}</Text>
      <Text>Longest streak: {longestStreak}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day) => {
          const date = dateString(year, month, day);
          const engaged = engagedDates.has(date);
          return (
            <View
              key={date}
              testID={`calendar-day-${date}`}
              style={{
                width: 24,
                height: 24,
                margin: 2,
                backgroundColor: engaged ? '#4CAF50' : '#E0E0E0',
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
