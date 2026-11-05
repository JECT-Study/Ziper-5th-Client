import { registerRootComponent } from 'expo';

// Must run before any StyleSheet.create so the theme is registered first.
import './src/styles/unistyles';
import App from './src/App';

registerRootComponent(App);
