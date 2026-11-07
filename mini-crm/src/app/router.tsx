import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './guards';
import { AppLayout } from './AppLayout';
import { HomeRedirect } from './HomeRedirect';
import { LoginView } from '../views/LoginView';
import { ObjectsEmptyView } from '../views/ObjectsEmptyView';
import { ObjectDetailView } from '../views/ObjectDetailView';
import { TaskDetailView } from '../views/TaskDetailView';
import { MyTasksView } from '../views/MyTasksView';
import { NotFoundView } from '../views/NotFoundView';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginView /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomeRedirect /> },
          { path: '/objects', element: <ObjectsEmptyView /> },
          { path: '/objects/:objectId', element: <ObjectDetailView /> },
          { path: '/objects/:objectId/tasks/:taskId', element: <TaskDetailView /> },
          {
            element: <RequireAuth requiredRole="executor" />,
            children: [{ path: '/my-tasks', element: <MyTasksView /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundView /> },
]);