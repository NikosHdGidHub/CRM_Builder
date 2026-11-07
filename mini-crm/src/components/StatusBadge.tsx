import { taskStatusLabels, type TaskStatus } from '../types/db';

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge badge--${status}`}>{taskStatusLabels[status]}</span>;
}