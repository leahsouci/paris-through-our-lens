import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import './index.css';
import App from './App';

// No StrictMode: it would mount the WebGL map twice in development.
createRoot(document.getElementById('root')!).render(<App />);
