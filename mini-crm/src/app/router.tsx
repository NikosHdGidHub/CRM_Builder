import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './guards';
import { HomeRedirect } from './HomeRedirect';
import { LoginView } from '../views/LoginView';
import { ObjectsListView } from '../views/ObjectsListView';
import { ObjectDetailView } from '../views/ObjectDetailView';
import { TaskDetailView } from '../views/TaskDetailView';
import { MyTasksView } from '../views/MyTasksView';
import { NotFoundView } from '../views/NotFoundView';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginView /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/objects', element: <ObjectsListView /> },
      { path: '/objects/:id', element: <ObjectDetailView /> },
      { path: '/tasks/:id', element: <TaskDetailView /> },
      {
        element: <RequireAuth requiredRole="executor" />,
        children: [{ path: '/my-tasks', element: <MyTasksView /> }],
      },
    ],
  },
  { path: '*', element: <NotFoundView /> },
]);
