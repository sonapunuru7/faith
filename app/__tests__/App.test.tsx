import { render, screen } from '@testing-library/react-native';
import App from '../App';

test('renders the app title', () => {
  render(<App />);
  expect(screen.getByText('Faith')).toBeTruthy();
});
