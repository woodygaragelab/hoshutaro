import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/globals.css';
import App from './App.tsx';
import App2 from './App2.tsx';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ThemeProvider from './providers/ThemeProvider';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/app2',
    element: <App2 />,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
