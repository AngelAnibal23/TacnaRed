import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import './theme.css';
import {readTheme} from './theme.tsx';
document.documentElement.dataset.theme=readTheme();
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
