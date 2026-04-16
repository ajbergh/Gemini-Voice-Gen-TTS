/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * index.tsx — Application Entry Point
 *
 * Mounts the root React component into the DOM using React 19's createRoot API.
 * Wrapped in StrictMode for development warnings and future-proofing.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ToastProvider from './components/ToastProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);