jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(() => () => {}),
}));

jest.mock('../src/firebase/config', () => ({ auth: {} }));

import { render } from '@testing-library/react-native';
import App from '../App';

test('renders without crashing', () => {
  render(<App />);
});
