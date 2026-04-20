import { useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Notifications from './components/Notifications.jsx';
import Taskometer from './taskometer/Taskometer.jsx';
import {
  AppStateProvider,
  useAppState,
  useAppReducer,
  ACTION_TYPES,
} from './AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

function AppContent() {
  const { tasks, isLoading, error } = useAppState();
  const dispatch = useAppReducer();

  const onToggleTask = useCallback((taskId) => {
    const task = tasks.find(t => (t.id || t.key) === taskId);
    if (!task) return;
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    dispatch({
      type: ACTION_TYPES.UPDATE_TASK,
      payload: { id: task.id || task.key, status: nextStatus },
    });
  }, [tasks, dispatch]);

  return (
    <ErrorBoundary>
      {error && (
        <div style={{
          position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(212, 102, 58, 0.1)', color: 'var(--orange, #D4663A)',
          border: '1px solid var(--orange, #D4663A)', fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12, zIndex: 200,
        }}>
          data warning: {error}
        </div>
      )}
      {isLoading && (
        <div style={{
          position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(168, 191, 140, 0.2)', color: 'var(--ink-soft, #4A433C)',
          border: '1px dashed var(--ink-mute, #8A8078)', fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12, zIndex: 200,
        }}>
          loading workspace…
        </div>
      )}
      <Taskometer tasks={tasks} onToggleTask={onToggleTask} />
      <Notifications />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </ThemeProvider>
  );
}

export default App;
