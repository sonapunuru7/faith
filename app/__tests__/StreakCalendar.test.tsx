import { render, screen } from '@testing-library/react-native';
import { StreakCalendar } from '../src/components/StreakCalendar';

describe('StreakCalendar', () => {
  test('renders the current and longest streak counts', () => {
    render(
      <StreakCalendar
        year={2026}
        month={7}
        engagedDates={new Set(['2026-07-01'])}
        currentStreak={4}
        longestStreak={9}
      />
    );

    expect(screen.getByText('Current streak: 4')).toBeTruthy();
    expect(screen.getByText('Longest streak: 9')).toBeTruthy();
  });

  test('renders one cell per day in the month, colored by engagement', () => {
    render(
      <StreakCalendar
        year={2026}
        month={7}
        engagedDates={new Set(['2026-07-01', '2026-07-15'])}
        currentStreak={1}
        longestStreak={1}
      />
    );

    expect(screen.getByTestId('calendar-day-2026-07-31')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-07-01').props.style.backgroundColor).toBe(
      '#4CAF50'
    );
    expect(screen.getByTestId('calendar-day-2026-07-02').props.style.backgroundColor).toBe(
      '#E0E0E0'
    );
  });
});
