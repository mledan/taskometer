import {
	Accordion,
	AccordionItem,
	AccordionButton,
	AccordionPanel,
} from "@reach/accordion";
import "@reach/accordion/styles.css";

import { useAppReducer, useAppState, useItems } from "../AppContext.jsx";
import Progress from "./Progress.jsx";
import TaskInput from "./tasks/TaskInput.jsx";
import Item from "./Item.jsx";
import styles from "./ItemList.module.css";
import arrow from "../img/arrow.svg";
import alldone from "../img/alldone.svg";
import { getActiveSchedule } from "../utils/scheduleTemplates.js";

// List of todo items
function ItemList() {
	const dispatch = useAppReducer();
	const { activeSchedule } = useAppState();
	const { pending, paused, completed } = useItems();
	const currentSchedule = activeSchedule || getActiveSchedule();

	const unscheduledPending = pending.filter((i) => !i.scheduledTime);
	const scheduledPending = pending.filter((i) => i.scheduledTime);

	function scheduleAllPending() {
		if (unscheduledPending.length === 0) return;
		dispatch({ type: 'SCHEDULE_TASKS', tasks: unscheduledPending });
	}

	function rescheduleAll() {
		if (pending.length === 0) return;
		dispatch({ type: 'RESCHEDULE_ALL_TASKS' });
	}

	return (
		<div className="item-list">
			<div className={styles.onboardingBanner}>
				<div className={styles.onboardingTitle}>Step 2: Add tasks for AI scheduling</div>
				<div className={styles.onboardingText}>
					{currentSchedule
						? `Active template: ${currentSchedule.name}. Add tasks and we will slot them into this routine.`
						: "No active schedule yet. Open the Schedules tab first to pick a template foundation."}
				</div>
			</div>
			<Progress />
			<TaskInput />

			<div className={styles.toolbar}>
				<button
					onClick={scheduleAllPending}
					disabled={unscheduledPending.length === 0}
					className={styles.primary}
				>
					Schedule all pending {unscheduledPending.length > 0 ? `(${unscheduledPending.length})` : ''}
				</button>
				<button
					onClick={rescheduleAll}
					disabled={pending.length === 0}
					className={styles.secondary}
					title="Clear all scheduled times and reschedule tasks"
				>
					Reschedule all {scheduledPending.length > 0 ? `(${scheduledPending.length} scheduled)` : ''}
				</button>
			</div>
			{pending.length > 0 ? (
				<>
					{pending.map((item) => {
						return <Item item={item} key={item.key} />;
					})}
				</>
			) : (
				<div className={styles.alldone}>
					<img src={alldone} alt="Nothing to do!" />
				</div>
			)}
			<Accordion collapsible multiple>
				{paused.length > 0 && (
					<AccordionItem>
						<AccordionButton className={styles.toggle}>
							<img src={arrow} alt="Do Later Toggle" />
							<span>Do Later</span>
						</AccordionButton>
						<AccordionPanel className={styles.panel}>
							{paused &&
								paused.map((item) => {
									return <Item item={item} key={item.key} />;
								})}
						</AccordionPanel>
					</AccordionItem>
				)}
				{completed.length > 0 && (
					<AccordionItem>
						<AccordionButton className={styles.toggle}>
							<img src={arrow} alt="Completed Toggle" /> <span>Completed</span>
						</AccordionButton>
						<AccordionPanel className={styles.panel}>
							{completed &&
								completed.map((item) => {
									return <Item item={item} key={item.key} />;
								})}
						</AccordionPanel>
					</AccordionItem>
				)}
			</Accordion>

			{(completed.length > 0 || paused.length > 0) && (
				<div className={styles.reset}>
					<button
						onClick={() => {
							dispatch({ type: "RESET_ALL" });
						}}
					>
						reset progress
					</button>
				</div>
			)}
		</div>
	);
}

export default ItemList;
