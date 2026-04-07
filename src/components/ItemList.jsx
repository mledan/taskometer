import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { format, isToday } from 'date-fns';
import { useAppReducer, useAppState, useItems, useTaskTypes } from '../AppContext.jsx';
import { taskMatchesFilters } from '../models/Task.js';
import { toLocalTime } from '../utils/timeDisplay.js';
import Progress from './Progress.jsx';
import TaskInput from './tasks/TaskInput.jsx';
import Item from './Item.jsx';
import styles from './ItemList.module.css';
import alldone from '../img/alldone.svg';

const OVERFLOW_MESSAGES = [
	"Time is cyclical — these flow into tomorrow. Rest up.",
	"Can't fit it all today, and that's okay. Tomorrow has its own slots.",
	"Today's full — the rest rolls forward. You've done enough.",
	"These shift to the next open day. Pace over rush.",
	"Overflow is natural. These tasks will be there when you're ready.",
];

const SORT_OPTIONS = [
	{ value: 'default', label: 'Default' },
	{ value: 'priority', label: 'Priority' },
	{ value: 'scheduled', label: 'Scheduled Time' },
	{ value: 'created', label: 'Created' },
	{ value: 'duration', label: 'Duration' },
];

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortTasks(tasks, sortBy) {
	if (sortBy === 'default') return tasks;
	return [...tasks].sort((a, b) => {
		switch (sortBy) {
			case 'priority':
				return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
			case 'scheduled':
				if (!a.scheduledTime && !b.scheduledTime) return 0;
				if (!a.scheduledTime) return 1;
				if (!b.scheduledTime) return -1;
				return new Date(a.scheduledTime) - new Date(b.scheduledTime);
			case 'created':
				return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
			case 'duration':
				return (b.duration || 0) - (a.duration || 0);
			default:
				return 0;
		}
	});
}

function ItemList() {
	const dispatch = useAppReducer();
	const { slots = [], settings = {} } = useAppState();
	const { pending, paused, completed } = useItems();
	const taskTypes = useTaskTypes();

	// Search, filter, sort state
	const [searchText, setSearchText] = useState('');
	const [filterPriority, setFilterPriority] = useState(null);
	const [filterType, setFilterType] = useState(null);
	const [filterScheduled, setFilterScheduled] = useState(null); // null | 'scheduled' | 'unscheduled'
	const [sortBy, setSortBy] = useState('default');
	const [showFilters, setShowFilters] = useState(false);
	const searchRef = useRef(null);

	// Keyboard shortcut: / to focus search
	useEffect(() => {
		function handleKeyDown(e) {
			if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
				const tag = document.activeElement?.tagName;
				if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
				e.preventDefault();
				searchRef.current?.focus();
			}
		}
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);

	const activeFilterCount = [searchText, filterPriority, filterType, filterScheduled].filter(Boolean).length;

	// Apply filters and sort
	const filteredPending = useMemo(() => {
		let result = pending;
		if (searchText || filterPriority || filterType) {
			result = result.filter(task => taskMatchesFilters(task, {
				searchText: searchText || undefined,
				priority: filterPriority || undefined,
				primaryType: filterType || undefined,
			}));
		}
		if (filterScheduled === 'scheduled') {
			result = result.filter(t => t.scheduledTime);
		} else if (filterScheduled === 'unscheduled') {
			result = result.filter(t => !t.scheduledTime);
		}
		return sortTasks(result, sortBy);
	}, [pending, searchText, filterPriority, filterType, filterScheduled, sortBy]);

	const unscheduledPending = pending.filter((item) => !item.scheduledTime);
	const scheduledPending = pending.filter((item) => item.scheduledTime);

	// Task types used in current pending tasks (for filter pills)
	const usedTypes = useMemo(() => {
		const typeIds = new Set(pending.map(t => t.primaryType || t.taskType).filter(Boolean));
		return taskTypes.filter(t => typeIds.has(t.id));
	}, [pending, taskTypes]);

	function clearFilters() {
		setSearchText('');
		setFilterPriority(null);
		setFilterType(null);
		setFilterScheduled(null);
		setSortBy('default');
	}

	const hasFramework = useMemo(() => {
		if (slots.length > 0) return true;
		const ds = settings?.defaultDaySlots;
		return Array.isArray(ds) && ds.length > 0;
	}, [slots, settings]);

	const upcomingTypedSlots = useMemo(() => {
		const now = new Date();
		return slots.filter((slot) => {
			if (!slot.slotType) return false;
			const start = new Date(`${slot.date}T${slot.startTime}:00`);
			return start >= now;
		}).length;
	}, [slots]);

	const availableSlots = useMemo(() => {
		const now = new Date();
		return slots.filter((slot) => {
			const start = new Date(`${slot.date}T${slot.startTime}:00`);
			return start >= now && !slot.assignedTaskId;
		}).length;
	}, [slots]);

	const overflowInfo = useMemo(() => {
		const overflowedTasks = scheduledPending.filter((item) => {
			if (!item.scheduledTime) return false;
			const taskDate = toLocalTime(item.scheduledTime);
			return !isToday(taskDate);
		});

		if (overflowedTasks.length === 0) return null;

		const byDay = {};
		overflowedTasks.forEach((item) => {
			const dayLabel = format(toLocalTime(item.scheduledTime), 'EEEE');
			if (!byDay[dayLabel]) byDay[dayLabel] = [];
			byDay[dayLabel].push(item);
		});

		const seed = overflowedTasks.length % OVERFLOW_MESSAGES.length;
		return {
			count: overflowedTasks.length,
			days: Object.keys(byDay),
			byDay,
			message: OVERFLOW_MESSAGES[seed],
		};
	}, [scheduledPending]);

	function scheduleUnplannedTasks() {
		if (unscheduledPending.length === 0) return;
		dispatch({ type: 'SCHEDULE_TASKS', payload: { tasks: unscheduledPending } });
	}

	function rescheduleAll() {
		dispatch({ type: 'RESCHEDULE_ALL_TASKS' });
	}

	return (
		<div className="item-list">
			{!hasFramework && pending.length === 0 && (
				<div className={styles.onboardingBanner}>
					<div className={styles.onboardingTitle}>Get Started</div>
					<div className={styles.onboardingText}>
						Add a task below and it will be scheduled into the next available time.
						For structured days, set up a framework in the Plan tab first.
					</div>
				</div>
			)}

			{hasFramework && pending.length === 0 && (
				<div className={styles.onboardingBanner}>
					<div className={styles.onboardingTitle}>Framework Ready</div>
					<div className={styles.onboardingText}>
						Your schedule framework is set with {availableSlots} open slot{availableSlots !== 1 ? 's' : ''}.
						Add tasks and they will route into matching time blocks.
					</div>
				</div>
			)}

			<Progress />
			<TaskInput />

			{/* Search and filters */}
			<div className={styles.searchBar}>
				<div className={styles.searchInputWrap}>
					<span className={styles.searchIcon}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
							<circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
						</svg>
					</span>
					<input
						ref={searchRef}
						type="text"
						placeholder="Search tasks...  ( / )"
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
						className={styles.searchInput}
					/>
					{searchText && (
						<button className={styles.searchClear} onClick={() => setSearchText('')}>x</button>
					)}
				</div>
				<button
					className={`${styles.filterToggle} ${showFilters || activeFilterCount > 0 ? styles.filterToggleActive : ''}`}
					onClick={() => setShowFilters(!showFilters)}
				>
					Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
				</button>
				<select
					className={styles.sortSelect}
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value)}
				>
					{SORT_OPTIONS.map(o => (
						<option key={o.value} value={o.value}>{o.label}</option>
					))}
				</select>
			</div>

			{showFilters && (
				<div className={styles.filterBar}>
					<div className={styles.filterGroup}>
						<span className={styles.filterLabel}>Priority</span>
						<div className={styles.filterPills}>
							{['urgent', 'high', 'medium', 'low'].map(p => (
								<button
									key={p}
									className={`${styles.filterPill} ${filterPriority === p ? styles.filterPillActive : ''}`}
									onClick={() => setFilterPriority(filterPriority === p ? null : p)}
								>{p}</button>
							))}
						</div>
					</div>
					{usedTypes.length > 0 && (
						<div className={styles.filterGroup}>
							<span className={styles.filterLabel}>Type</span>
							<div className={styles.filterPills}>
								{usedTypes.map(t => (
									<button
										key={t.id}
										className={`${styles.filterPill} ${filterType === t.id ? styles.filterPillActive : ''}`}
										onClick={() => setFilterType(filterType === t.id ? null : t.id)}
										style={filterType === t.id ? { background: t.color, borderColor: t.color } : {}}
									>{t.icon} {t.name}</button>
								))}
							</div>
						</div>
					)}
					<div className={styles.filterGroup}>
						<span className={styles.filterLabel}>Status</span>
						<div className={styles.filterPills}>
							<button
								className={`${styles.filterPill} ${filterScheduled === 'scheduled' ? styles.filterPillActive : ''}`}
								onClick={() => setFilterScheduled(filterScheduled === 'scheduled' ? null : 'scheduled')}
							>Scheduled</button>
							<button
								className={`${styles.filterPill} ${filterScheduled === 'unscheduled' ? styles.filterPillActive : ''}`}
								onClick={() => setFilterScheduled(filterScheduled === 'unscheduled' ? null : 'unscheduled')}
							>Unscheduled</button>
						</div>
					</div>
					{activeFilterCount > 0 && (
						<button className={styles.clearFilters} onClick={clearFilters}>Clear all filters</button>
					)}
				</div>
			)}

			<div className={styles.toolbar}>
				<div className={styles.toolbarLeft}>
					<button
						onClick={scheduleUnplannedTasks}
						disabled={unscheduledPending.length === 0}
						className={styles.primary}
					>
						{unscheduledPending.length > 0
							? `Place ${unscheduledPending.length} unscheduled`
							: 'All tasks placed'}
					</button>
					{pending.length > 0 && (
						<button
							onClick={rescheduleAll}
							className={styles.secondary}
						>
							Re-optimize
						</button>
					)}
				</div>
				<div className={styles.metaInfo}>
					{hasFramework ? (
						<>
							<span className={styles.metaChip}>{availableSlots} open slots</span>
							<span className={styles.metaChip}>{scheduledPending.length} scheduled</span>
						</>
					) : (
						<span className={styles.metaChip}>ad-hoc mode</span>
					)}
				</div>
			</div>

			{overflowInfo && (
				<div className={styles.overflowBanner}>
					<div className={styles.overflowHeader}>
						<span className={styles.overflowIcon}>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
								<path d="M8 5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
							</svg>
						</span>
						<span className={styles.overflowCount}>
							{overflowInfo.count} task{overflowInfo.count !== 1 ? 's' : ''} flow to{' '}
							{overflowInfo.days.join(', ')}
						</span>
					</div>
					<p className={styles.overflowMessage}>{overflowInfo.message}</p>
				</div>
			)}

			{filteredPending.length > 0 ? (
				<>
					{activeFilterCount > 0 && filteredPending.length !== pending.length && (
						<div className={styles.filterResultCount}>
							Showing {filteredPending.length} of {pending.length} tasks
						</div>
					)}
					{filteredPending.map((item) => <Item item={item} key={item.id || item.key} />)}
				</>
			) : pending.length > 0 && activeFilterCount > 0 ? (
				<div className={styles.noResults}>
					No tasks match your filters.
					<button className={styles.clearFilters} onClick={clearFilters}>Clear filters</button>
				</div>
			) : (
				<div className={styles.alldone}>
					<img src={alldone} alt="Nothing to do!" />
				</div>
			)}

			{paused.length > 0 && (
				<details className={styles.group}>
					<summary>Paused ({paused.length})</summary>
					{paused.map((item) => <Item item={item} key={item.id || item.key} />)}
				</details>
			)}

			{completed.length > 0 && (
				<details className={styles.group}>
					<summary>Completed ({completed.length})</summary>
					{completed.map((item) => <Item item={item} key={item.id || item.key} />)}
				</details>
			)}
		</div>
	);
}

export default ItemList;
