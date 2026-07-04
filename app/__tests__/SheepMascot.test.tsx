import { render, screen } from '@testing-library/react-native';
import { SheepMascot } from '../src/components/SheepMascot';

describe('SheepMascot', () => {
  test('renders at full opacity for a perfect wellness score', () => {
    render(<SheepMascot wellnessScore={100} />);

    expect(screen.getByTestId('sheep-mascot').props.style.opacity).toBe(1);
  });

  test('renders dimmed but still visible for a wellness score of zero', () => {
    render(<SheepMascot wellnessScore={0} />);

    expect(screen.getByTestId('sheep-mascot').props.style.opacity).toBe(0.3);
  });

  test('clamps out-of-range scores instead of rendering invalid opacity', () => {
    render(<SheepMascot wellnessScore={150} />);

    expect(screen.getByTestId('sheep-mascot').props.style.opacity).toBe(1);
  });
});
