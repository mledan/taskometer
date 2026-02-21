import {
	Accordion,
	AccordionItem,
	AccordionButton,
	AccordionPanel,
} from "@reach/accordion";
import "@reach/accordion/styles.css";
import { useMemo } from "react";

import { useAppReducer, useAppState, useItems } from "../AppContext.jsx";
import Progress from "./Progress.jsx";
import TaskInput from "./tasks/TaskInput.jsx";
import Item from "./Item.jsx";
import styles from "./ItemList.module.css";
import arrow from "../img/arrow.svg";
import alldone from "../img/alldone.svg";
import { getActiveSchedule } from "../utils/scheduleTemplates.js";

function formatDateLabel(dateText) {
	if (!dateText) return "";
	const parsed = new Date(`${dateText}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) return dateText;
	return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// List of todo items
function ItemList({ onNavigateToCalendar, onNavigateToSchedules }) {
	const dispatch = useAppReducer();
	const { activeSchedule, settings } = useAppState();
	const { pending, paused, completed } = useItems();
	const currentSchedule = activeSchedule || getActiveSchedule();
	const recentTemplateApplication = useMemo(() => {
		const summary = settings?.lastTemplateApplication;
		if (!summary?.appliedAt) return null;

		const appliedAt = new Date(summary.appliedAt);
		if (Number.isNaN(appliedAt.getTime())) return null;

		const hoursOld = (Date.now() - appliedAt.getTime()) / (1000 * 60 * 60);
		if (hoursOld > 168) return null; // keep preview for one week

		if (!Array.isArray(summary.previewDays) || summary.previewDays.length === 0) {
			return null;
		}

		return summary;
	}, [settings?.lastTemplateApplication]);

	const unscheduledPending = pending.filter((i) => !i.scheduledTime);
	const scheduledPending = pending.filter((i) => i.scheduledTime);

	function planAndOpenCalendar() {
		if (unscheduledPending.length > 0) {
			dispatch({ type: 'SCHEDULE_TASKS', payload: { tasks: unscheduledPending } });
		}
		onNavigateToCalendar?.();
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
						? `Active template: ${currentSchedule.name}. Add tasks, then use "Plan next slots" to auto-place unscheduled work and jump to Calendar.`
						: "No active schedule yet. Open the Schedules tab first to pick a template foundation."}
				</div>
			</div>
			{recentTemplateApplication && (
				<div className={styles.templatePreviewBanner}>
					<div className={styles.templatePreviewHeader}>
						Recent apply: {recentTemplateApplication.scheduleName}
					</div>
					<div className={styles.templatePreviewMeta}>
						{recentTemplateApplication.appliedBlockCount} blocks · {formatDateLabel(recentTemplateApplication.startDate)} - {formatDateLabel(recentTemplateApplication.endDate)}.
						{" "}Open Calendar to confirm exact placements.
					</div>
					<div className={styles.templatePreviewDays}>
						{recentTemplateApplication.previewDays.map((day) => (
							<div key={day.date} className={styles.templatePreviewDay}>
								<div className={styles.templatePreviewDayHeader}>
									{day.displayDate || formatDateLabel(day.date)}
								</div>
								{day.blocks.map((block) => (
									<div key={`${day.date}-${block.start}-${block.label}`} className={styles.templatePreviewBlock}>
										<span>{block.start} - {block.end}</span>
										<span>{block.label}</span>
									</div>
								))}
								{day.totalBlocks > day.blocks.length && (
									<div className={styles.templatePreviewMore}>
										+{day.totalBlocks - day.blocks.length} more blocks
									</div>
								)}
							</div>
						))}
					</div>
					<div className={styles.templatePreviewActions}>
						<button
							type="button"
							className={styles.templatePreviewPrimary}
							onClick={() => onNavigateToCalendar?.()}
							disabled={!onNavigateToCalendar}
						>
							See Effect on Calendar
						</button>
						<button
							type="button"
							className={styles.templatePreviewSecondary}
							onClick={() => onNavigateToSchedules?.()}
							disabled={!onNavigateToSchedules}
						>
							Adjust in Schedules
						</button>
					</div>
				</div>
			)}
			<Progress />
			<TaskInput />

			<div className={styles.toolbar}>
				<button
					onClick={planAndOpenCalendar}
					disabled={pending.length === 0}
					className={styles.primary}
				>
					{unscheduledPending.length > 0
						? `Plan next slots${onNavigateToCalendar ? " & open calendar" : ""} (${unscheduledPending.length})`
						: onNavigateToCalendar
							? "Open calendar timeline"
							: "All pending tasks are slotted"}
				</button>
				<button
					onClick={rescheduleAll}
					disabled={pending.length === 0}
					className={styles.secondary}
					title="Clear all scheduled times and reschedule tasks"
				>
					Re-optimize all {scheduledPending.length > 0 ? `(${scheduledPending.length} scheduled)` : ''}
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
