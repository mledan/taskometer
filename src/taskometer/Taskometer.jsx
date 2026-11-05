import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WheelPainter from './WheelPainter.jsx';
import SaveAsRhythmModal from './year/SaveAsRhythmModal.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { QuickCapture } from './Inbox.jsx';
import DayStrip from './DayStrip.jsx';
import WelcomePopup from './WelcomePopup.jsx';
import { hasSeenOnboarding, startOnboarding } from './Onboarding.jsx';
import AccountPanel from './AccountPanel.jsx';
import KeyboardShortcuts from '../components/KeyboardShortcuts.jsx';
import LibraryDrawer from './library/LibraryDrawer.jsx';
import ZoomNav from './nav/ZoomNav.jsx';
import LensToggle from './nav/LensToggle.jsx';
import Breadcrumb from './nav/Breadcrumb.jsx';
import { DEFAULT_VIEW, ZOOMS, LENSES, migrateLegacyScale, normalizeView, zoomStep } from './nav/viewState.js';
import DayScreen from './screens/DayScreen.jsx';
import WeekScreen from './screens/WeekScreen.jsx';
import CalendarScreen from './screens/CalendarScreen.jsx';
import LifeScreen from './screens/LifeScreen.jsx';
import { usePaintActions } from './shell/usePaintActions.js';
import { useTaskActions } from './shell/useTaskActions.js';
import { useBootMaintenance } from './shell/useBootMaintenance.js';
import { useAuthState } from './shell/useAuthState.js';
import { useLibraryActions } from './shell/useLibraryActions.js';
import { useTaskometerAPI } from '../services/api';
import { readSharedScheduleTypesFromHash } from '../services/scheduleShare';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import { useMultiSelect } from '../hooks/useMultiSelect.js';
import useTaskNotifications from '../hooks/useTaskNotifications.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { log as telemetryLog } from '../services/telemetry.js';
import { formatYMD } from '../utils/time.js';
import './taskometer.css';
import './shell.css';
import { storage } from '../services/storage.js';

/**
 * The app shell: header (library chip, zoom ladder, lens toggle, date
 * nav, search, account), the always-on quick capture, and one screen
 * per zoom. Everything else lives in screens/, shell/ and library/.
 */

const DEFAULT_UI = { palette: 'warm', rules: 'lines', notifications: false, ...DEFAULT_VIEW };
const CALENDAR_ZOOMS = new Set(['month', 'quarter', 'year']);

function readStoredUI() {
  let stored = storage.get('tm.ui') || storage.get('tm.tweaks') || {};
  // Legacy `tm.scale` → zoom/lens, once.
  const legacy = storage.getRaw('tm.scale');
  if (legacy !== null) {
    const migrated = migrateLegacyScale(legacy);
    if (migrated && !stored.zoom) stored = { ...stored, ...migrated };
    storage.remove('tm.scale');
  }
  const ui = { ...DEFAULT_UI, ...stored };
  // Phones get the one-handed lens until the user picks one themselves.
  if (!stored.lens && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches) ui.lens = 'blocks';
  return { ...ui, ...normalizeView(ui) };
}

function readDeepLinkDate() {
  try {
    const d = new URLSearchParams(window.location.search).get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-').map(Number);
      const parsed = new Date(y, m - 1, day);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  } catch (_) { /* SSR or restricted env */ }
  return new Date();
}

export default function Taskometer() {
  const [ui, setUI] = useState(readStoredUI);
  const { zoom, lens } = ui;
  const [selectedDate, setSelectedDate] = useState(readDeepLinkDate);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [library, setLibrary] = useState({ open: false, tab: 'schedules' });
  const [pendingRange, setPendingRange] = useState(null);   // { startDate, endDate } | null
  const [pendingDays, setPendingDays] = useState(null);     // string[] | null
  const [paintMaterial, setPaintMaterial] = useState('schedule');
  const [painterTarget, setPainterTarget] = useState(null); // { wheel } | null
  const [saveDaysAsRhythmModal, setSaveDaysAsRhythmModal] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [sharedTypeImport, setSharedTypeImport] = useState(null);
  const searchRef = useRef(null);
  const quickCaptureRef = useRef(null);
  const multiSelect = useMultiSelect('app-calendar');
  const { toggleTheme } = useTheme();

  const { state, api, derived } = useTaskometerAPI();
  const { auth, isLoggedIn, accountInitial, welcomeOpen, setWelcomeOpen } = useAuthState();

  const setUIField = useCallback((k, v) => {
    telemetryLog('ui:set', { [k]: v });
    setUI(prev => ({ ...prev, [k]: v }));
  }, []);
  const setZoom = useCallback((z) => { if (ZOOMS.includes(z)) setUIField('zoom', z); }, [setUIField]);
  const setLens = useCallback((l) => { if (LENSES.includes(l)) setUIField('lens', l); }, [setUIField]);
  const setView = useCallback(({ zoom: z, lens: l }) => {
    setUI(prev => ({ ...prev, ...normalizeView({ zoom: z ?? prev.zoom, lens: l ?? prev.lens }) }));
  }, []);
  const openLibrary = useCallback((tab) => setLibrary(prev => ({ open: true, tab: tab || prev.tab })), []);
  const closeLibrary = useCallback(() => {
    setLibrary(prev => ({ ...prev, open: false }));
    setPendingRange(null);
    setPendingDays(null);
  }, []);

  useEffect(() => {
    storage.set('tm.ui', ui);
  }, [ui]);
  useEffect(() => { telemetryLog('ui:view', { zoom, lens }); }, [zoom, lens]);

  useEffect(() => {
    document.body.classList.add('tm-body');
    document.getElementById('tm-root-frame')?.classList.add('tm-paper');
  }, []);

  useEffect(() => {
    const decoded = readSharedScheduleTypesFromHash();
    if (decoded && decoded.length) setSharedTypeImport(decoded);
    if (decoded) {
      const next = window.location.hash.replace(/[#&]sched=[A-Za-z0-9_-]+/, '').replace(/^#/, '');
      window.history.replaceState(null, '', window.location.pathname + window.location.search + (next ? `#${next}` : ''));
    }
  }, []);

  useBootMaintenance({ state, api, zoom });
  useTaskNotifications({ tasks: state.tasks || [], enabled: !!ui.notifications, lookAheadMin: 5 });

  const viewKey = formatYMD(selectedDate);
  const selectedSlot = selectedSlotId ? (state.slots || []).find(s => s.id === selectedSlotId) || null : null;
  const selectedSlotIsForDay = !!(selectedSlot && selectedSlot.date === viewKey);
  useEffect(() => {
    if (!selectedSlotId) return;
    const slot = (state.slots || []).find(s => s.id === selectedSlotId);
    if (!slot || slot.date !== viewKey) setSelectedSlotId(null);
  }, [viewKey, selectedSlotId, state.slots]);

  const tasksActions = useTaskActions({ api, state, viewKey, selectedSlot, selectedSlotIsForDay });
  const { rowHandlers, setEditingTaskId, handleQuickCapture, addTasksToInbox, addTasksAutoScheduled } = tasksActions;

  const userWheels = state.settings?.wheels || [];
  const paint = usePaintActions({ api, userWheels, viewKey });

  const goToday = useCallback(() => { setSelectedDate(new Date()); telemetryLog('ui:date:today'); }, []);

  // Command palette and other chrome talk to the shell through window events.
  useEffect(() => {
    const handlers = {
      'tm:capture-focus': () => quickCaptureRef.current?.focus?.(),
      'tm:paint-today': () => { setSelectedDate(new Date()); setZoom('day'); openLibrary('schedules'); },
      'tm:go-today': () => { goToday(); setZoom('day'); },
      'tm:open-schedules': () => openLibrary('schedules'),
      'tm:open-library': (e) => openLibrary(e.detail?.tab),
      'tm:open-settings': () => setSettingsOpen(true),
      'tm:set-scale': (e) => { const v = migrateLegacyScale(e.detail?.scale); if (v) setView(v); },
      'tm:theme-toggle': () => toggleTheme(),
    };
    for (const [name, fn] of Object.entries(handlers)) window.addEventListener(name, fn);
    return () => { for (const [name, fn] of Object.entries(handlers)) window.removeEventListener(name, fn); };
  }, [setZoom, setView, openLibrary, goToday, toggleTheme]);

  useKeyboardShortcuts({
    goToDashboard: () => setView({ zoom: 'day', lens: 'wheel' }),
    goToPlan: () => setZoom('week'),
    goToTodos: () => setView({ zoom: 'day', lens: 'blocks' }),
    zoomOut: () => setZoom(zoomStep(zoom, 1)),
    zoomIn: () => setZoom(zoomStep(zoom, -1)),
    toggleDarkMode: () => toggleTheme(),
    newTask: () => { quickCaptureRef.current?.focus?.(); },
    search: () => { searchRef.current?.focus?.(); },
    cancel: () => {
      setSettingsOpen(false);
      setShortcutsOpen(false);
      closeLibrary();
      setEditingTaskId(null);
    },
    showHelp: () => setShortcutsOpen(true),
  });

  const filteredState = useMemo(() => {
    if (!search.trim()) return state;
    const q = search.trim().toLowerCase();
    const matchTask = (t) => (t.text || t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    return { ...state, tasks: (state.tasks || []).filter(matchTask) };
  }, [state, search]);

  const filteredDerived = useMemo(() => {
    if (!search.trim()) return derived;
    const ids = new Set((filteredState.tasks || []).map(t => t.id || t.key));
    const keep = (t) => ids.has(t.id || t.key);
    return {
      ...derived,
      todayTasks: (derived.todayTasks || []).filter(entry => keep(entry.task)),
      upcoming: (derived.upcoming || []).filter(keep),
      pushed: (derived.pushed || []).filter(keep),
      backlog: (derived.backlog || []).filter(keep),
      currentSlot: derived.currentSlot ? { ...derived.currentSlot, tasks: (derived.currentSlot.tasks || []).filter(keep) } : derived.currentSlot,
      nextSlot: derived.nextSlot ? { ...derived.nextSlot, tasks: (derived.nextSlot.tasks || []).filter(keep) } : derived.nextSlot,
    };
  }, [derived, search, filteredState.tasks]);

  const hasSlots = (state.slots?.length || 0) > 0;
  const hasTasks = (state.tasks?.length || 0) > 0;
  const { todayDone, todayTotal, pushed } = derived.stats;

  const dateStep = zoom === 'week' ? 7 : 1;
  const showDateButtons = zoom === 'day' || zoom === 'week';
  const shiftDate = (dir) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + dir * dateStep);
    setSelectedDate(next);
    telemetryLog('ui:date', { date: formatYMD(next), zoom });
  };

  const activeWheelId = derived.dayAssignments?.[viewKey] || null;
  const activeWheel = activeWheelId
    ? (userWheels.find(w => w.id === activeWheelId) || FAMOUS_WHEELS.find(w => w.id === activeWheelId) || null)
    : null;

  const pickDate = (d, nextZoom = 'day') => { setSelectedDate(d); setZoom(nextZoom); };

  const handleQuickStart = async (template) => {
    if (!template) { telemetryLog('quickstart:custom'); setView({ zoom: 'day', lens: 'wheel' }); return; }
    telemetryLog('quickstart:pick', { name: template.name });
    try {
      const wheelId = await paint.ensureWheel(template);
      const today = formatYMD(new Date());
      await api.wheels.applyToDate(wheelId, today);
      telemetryLog('quickstart:applied', { wheelId, date: today });
    } catch (err) {
      telemetryLog('quickstart:error', { message: err?.message });
    }
  };

  // Paint dispatchers for the calendar screens — blank goes straight
  // through, schedule opens the Library so the user picks which one.
  const handlePaintDay = async (wheelIdOrNull, dateKey, material) => {
    if (material === 'blank') { await api.wheels.clearRange(dateKey, dateKey); telemetryLog('paint:blank-day', { dateKey }); return; }
    if (wheelIdOrNull) return paint.paintWheelOnDate(wheelIdOrNull, dateKey);
  };
  const handlePaintRange = async (startDate, endDate, material) => {
    if (material === 'blank') return paint.clearRange(startDate, endDate);
    setPendingRange({ startDate, endDate });
    openLibrary('schedules');
  };
  const handlePaintDays = async (dates, material) => {
    if (!dates || dates.length === 0) return;
    if (material === 'blank') return paint.clearDays(dates);
    setPendingDays(dates);
    openLibrary('schedules');
  };

  const libraryProps = useLibraryActions({
    api, paint, viewKey, selectedDate, userWheels, taskTypes: state.taskTypes || [], activeWheelId,
    pendingRange, pendingDays, addTasksToInbox, addTasksAutoScheduled, closeLibrary,
  });

  return (
    <div id="tm-root-frame" className="tm-root tm-paper">
      {sharedTypeImport && (
        <div role="region" aria-label="shared schedule import" className="tm-import-banner">
          <span>
            someone shared a schedule — {sharedTypeImport.length} window{sharedTypeImport.length === 1 ? '' : 's'}
            <span className="tm-mono tm-sm tm-import-banner-tags">
              {sharedTypeImport.slice(0, 6).map(t => t.tag).filter(Boolean).join(' · ')}
            </span>
          </span>
          <div className="tm-import-banner-actions">
            <button className="tm-btn tm-sm" onClick={async () => { await api.scheduleTypes.applyShared(sharedTypeImport, { merge: true }); setSharedTypeImport(null); }}>Add to mine</button>
            <button className="tm-btn tm-sm tm-ghost" onClick={() => setSharedTypeImport(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <header className="tm-header">
        <button
          type="button"
          className={`tm-active-chip${activeWheel ? '' : ' tm-active-chip-empty'}`}
          onClick={() => openLibrary('schedules')}
          title={activeWheel ? 'current schedule — click to switch' : 'no schedule on this day — click to pick one'}
          data-onboard="wheel-picker"
        >
          <span
            className="tm-active-chip-dot"
            style={{ background: activeWheel?.color || 'transparent', border: activeWheel ? 'none' : 'var(--bw) dashed var(--ink-mute)' }}
            aria-hidden
          />
          {activeWheel ? activeWheel.name : 'pick a schedule'}
          <span aria-hidden className="tm-active-chip-caret">▾</span>
        </button>
        <button
          type="button"
          className="tm-btn tm-sm tm-ghost"
          onClick={() => openLibrary()}
          title="schedules, routines, paths and packs"
        >
          Library
        </button>

        <ZoomNav zoom={zoom} onChange={setZoom} />
        {zoom === 'day' && <LensToggle lens={lens} onChange={setLens} />}

        {zoom !== 'life' && (
          <div className="tm-datenav">
            {showDateButtons && <button className="tm-btn tm-sm" onClick={() => shiftDate(-1)} aria-label="previous">‹</button>}
            <Breadcrumb date={selectedDate} zoom={zoom} onJump={setZoom} />
            {showDateButtons && <button className="tm-btn tm-sm" onClick={() => shiftDate(1)} aria-label="next">›</button>}
            {showDateButtons && <button className="tm-btn tm-sm" onClick={goToday} title="jump to today">today</button>}
          </div>
        )}

        {hasTasks && (
          <span className="tm-mono tm-sm tm-header-stats">
            {todayDone}/{todayTotal} today · {pushed} pushed
          </span>
        )}

        <div className="tm-header-right">
          {hasTasks && (
            <input
              ref={searchRef}
              className="tm-composer-input tm-header-search"
              placeholder="search…  /"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
              aria-label="search"
            />
          )}
          <button
            data-onboard="account"
            className="tm-btn tm-sm tm-account-btn"
            onClick={() => setAccountOpen(true)}
            title={isLoggedIn ? `signed in as @${auth.profile.username}` : 'guest — click to create an account'}
            aria-label="account"
          >
            {auth?.profile?.avatarUrl ? (
              <img src={auth.profile.avatarUrl} alt="" width={22} height={22} className="tm-account-avatar" />
            ) : (
              <span aria-hidden className={`tm-account-initial${isLoggedIn ? ' tm-on' : ''}`}>{accountInitial}</span>
            )}
            {isLoggedIn ? (auth.profile.firstName || auth.profile.username) : 'guest'}
          </button>
        </div>
      </header>

      <QuickCapture
        ref={quickCaptureRef}
        onCapture={handleQuickCapture}
        inboxCount={(filteredDerived.backlog || []).length}
      />

      <DayStrip
        selectedDate={selectedDate}
        tasks={state.tasks || []}
        onPickDate={(d) => { setSelectedDate(d); telemetryLog('ui:day-strip', { date: formatYMD(d) }); }}
      />

      {zoom === 'day' && (
        <DayScreen
          lens={lens}
          selectedDate={selectedDate}
          viewKey={viewKey}
          state={state}
          api={api}
          derived={derived}
          filteredState={filteredState}
          filteredDerived={filteredDerived}
          rowHandlers={rowHandlers}
          actions={tasksActions}
          selectedSlotId={selectedSlotId}
          onSelectWedge={(slot) => setSelectedSlotId(slot?.id || null)}
          recentRollover={tasksActions.recentRollover}
          setRecentRollover={tasksActions.setRecentRollover}
          onPickDate={setSelectedDate}
          onOpenLibrary={openLibrary}
          showQuickStart={!hasSlots}
          onQuickStart={handleQuickStart}
        />
      )}

      {zoom === 'week' && (
        <WeekScreen
          selectedDate={selectedDate}
          state={state}
          filteredState={filteredState}
          derived={derived}
          userWheels={userWheels}
          onPickDate={(d) => pickDate(d, 'day')}
          paintMaterial={paintMaterial}
          setPaintMaterial={setPaintMaterial}
          onPaintRange={handlePaintRange}
          onPaintDays={handlePaintDays}
        />
      )}

      {CALENDAR_ZOOMS.has(zoom) && (
        <CalendarScreen
          zoom={zoom}
          selectedDate={selectedDate}
          state={state}
          filteredState={filteredState}
          paintMaterial={paintMaterial}
          setPaintMaterial={setPaintMaterial}
          multiSelect={multiSelect}
          onPickDate={(d) => pickDate(d, 'day')}
          onPaintDay={handlePaintDay}
          onPaintRange={handlePaintRange}
          onPaintDays={handlePaintDays}
          onSaveDaysAsRhythm={(dates) => { if (Array.isArray(dates) && dates.length) setSaveDaysAsRhythmModal(dates); }}
        />
      )}

      {zoom === 'life' && (
        <LifeScreen
          state={state}
          filteredState={filteredState}
          paintMaterial={paintMaterial}
          setPaintMaterial={setPaintMaterial}
          onPickDate={(d) => pickDate(d, 'year')}
          onPaintRange={handlePaintRange}
        />
      )}

      {library.open && (
        <LibraryDrawer
          tab={library.tab}
          onTabChange={(tab) => setLibrary({ open: true, tab })}
          onClose={closeLibrary}
          {...libraryProps}
        />
      )}

      {saveDaysAsRhythmModal && (
        <SaveAsRhythmModal
          dates={saveDaysAsRhythmModal}
          onClose={() => setSaveDaysAsRhythmModal(null)}
          onSaved={() => {
            telemetryLog('rhythm:saved-from-selection', { count: saveDaysAsRhythmModal.length });
            setSaveDaysAsRhythmModal(null);
          }}
        />
      )}

      {painterTarget && (
        <WheelPainter
          wheel={painterTarget.wheel}
          anchorDate={selectedDate}
          onClose={() => setPainterTarget(null)}
          onApply={async (opts) => { await paint.paintWheelAcrossRange(painterTarget.wheel, opts); setPainterTarget(null); }}
        />
      )}

      {welcomeOpen && zoom === 'day' && (
        <WelcomePopup
          onDone={() => {
            setWelcomeOpen(false);
            if (!hasSeenOnboarding()) {
              startOnboarding();
              window.dispatchEvent(new Event('taskometer:onboarding-start'));
            }
          }}
        />
      )}

      {accountOpen && (
        <AccountPanel
          onClose={() => setAccountOpen(false)}
          onSignOut={() => { setAccountOpen(false); setWelcomeOpen(true); }}
          onCreateAccount={() => setWelcomeOpen(true)}
          onOpenSettings={() => { setAccountOpen(false); setSettingsOpen(true); }}
          onManageWheels={() => { telemetryLog('ui:wheels-open'); setAccountOpen(false); openLibrary('schedules'); }}
          onExportIcs={() => { telemetryLog('backup:export-ics'); api.backup.exportICS(); }}
          onReplayTour={() => {
            startOnboarding();
            window.dispatchEvent(new Event('taskometer:onboarding-start'));
          }}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      )}

      {settingsOpen && (
        <SettingsPanel
          ui={ui}
          setUIField={setUIField}
          api={api}
          autoSchedule={state.settings?.autoSchedule !== false}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
