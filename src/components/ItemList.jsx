import { useMemo } from 'react';
import { useAppReducer, useAppState, useItems } from '../AppContext.jsx';
import Progress from './Progress.jsx';
import TaskInput from './tasks/TaskInput.jsx';
import Item from './Item.jsx';
import styles from './ItemList.module.css';
import alldone from '../img/alldone.svg';

function ItemList() {
	const dispatch = useAppReducer();
	const { slots = [], settings = {} } = useAppState();
	const { pending, paused, completed } = useItems();

	const unscheduledPending = pending.filter((item) => !item.scheduledTime);
	const scheduledPending = pending.filter((item) => item.scheduledTime);

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
						For structured days, set up a framework in the Schedule tab first.
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

			{pending.length > 0 ? (
				pending.map((item) => <Item item={item} key={item.id || item.key} />)
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
