import { useMemo } from 'react';
import { useAppReducer, useAppState, useItems } from '../AppContext.jsx';
import Progress from './Progress.jsx';
import TaskInput from './tasks/TaskInput.jsx';
import Item from './Item.jsx';
import styles from './ItemList.module.css';
import alldone from '../img/alldone.svg';

function ItemList() {
	const dispatch = useAppReducer();
	const { slots = [] } = useAppState();
	const { pending, paused, completed } = useItems();

	const unscheduledPending = pending.filter((item) => !item.scheduledTime);
	const upcomingTypedSlots = useMemo(() => {
		const now = new Date();
		return slots.filter((slot) => {
			if (!slot.slotType) return false;
			const start = new Date(`${slot.date}T${slot.startTime}:00`);
			return start >= now;
		}).length;
	}, [slots]);

	function scheduleUnplannedTasks() {
		if (unscheduledPending.length === 0) return;
		dispatch({ type: 'SCHEDULE_TASKS', payload: { tasks: unscheduledPending } });
	}

	return (
		<div className="item-list">
			<div className={styles.onboardingBanner}>
				<div className={styles.onboardingTitle}>Task Intake by Type</div>
				<div className={styles.onboardingText}>
					Add tasks by type and they will route into the next available matching slot.
					Create or update slots from the Defaults and Calendar tabs.
				</div>
			</div>

			<Progress />
			<TaskInput />

			<div className={styles.toolbar}>
				<button
					onClick={scheduleUnplannedTasks}
					disabled={unscheduledPending.length === 0}
					className={styles.primary}
				>
					{unscheduledPending.length > 0
						? `Place ${unscheduledPending.length} unscheduled task(s)`
						: 'All pending tasks are slotted'}
				</button>
				<div className={styles.metaInfo}>
					Upcoming typed slots: {upcomingTypedSlots}
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
