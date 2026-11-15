import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/register';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-ext-500.css';
import '@fontsource/chivo/latin-400.css';
import '@fontsource/chivo/latin-ext-400.css';
import '@fontsource/chivo/latin-700.css';
import '@fontsource/chivo/latin-ext-700.css';
import '@fontsource/chivo/latin-800.css';
import '@fontsource/chivo/latin-ext-800.css';
import '@fontsource/chivo/latin-900.css';
import '@fontsource/chivo/latin-ext-900.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-ext-800.css';
import './styles.css';

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
