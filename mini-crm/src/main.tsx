import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './app/AuthProvider';
import { ObjectsProvider } from './app/ObjectsProvider';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ObjectsProvider>
        <RouterProvider router={router} />
      </ObjectsProvider>
    </AuthProvider>
  </StrictMode>,
);