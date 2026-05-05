import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { OuvinteLandingPage } from './components/OuvinteLandingPage';
import './index.css';

const isPublic = window.location.pathname.startsWith('/public/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublic ? <OuvinteLandingPage onComplete={() => window.location.href = '/'} /> : <App />}
  </StrictMode>,
);
