import { useState, useEffect, useMemo } from 'react';
import { useItems, useAppState, useTaskTypes } from "../AppContext.jsx";
import styles from "./Progress.module.css";

// Progress bar for completed/paused todo items with type breakdown
function Progress() {
	const totalAmount = useAppState().items.length;
	const { pending, paused, completed } = useItems();
	const taskTypes = useTaskTypes();
	const completedAmount = completed.length;
	const pausedAmount = paused.length;
	const [showCelebration, setShowCelebration] = useState(false);
	const [prevCompleted, setPrevCompleted] = useState(completedAmount);
	const [hoveredSection, setHoveredSection] = useState(null);
	const [showBreakdown, setShowBreakdown] = useState(false);

	let completedPercentage = completedAmount / totalAmount;
	let pausedPercentage = pausedAmount / totalAmount + completedPercentage;

	if (isNaN(completedPercentage)) {
		completedPercentage = 0;
	}

	if (isNaN(pausedPercentage)) {
		pausedPercentage = 0;
	}

	// Type breakdown stats
	const typeBreakdown = useMemo(() => {
		const allTasks = [...pending, ...paused, ...completed];
		const byType = {};
		allTasks.forEach(task => {
			const typeId = task.primaryType || task.taskType || 'other';
			if (!byType[typeId]) {
				const typeInfo = taskTypes.find(t => t.id === typeId) || { name: typeId, color: '#6b7280', icon: '' };
				byType[typeId] = { ...typeInfo, total: 0, completed: 0, totalMinutes: 0, actualMinutes: 0 };
			}
			byType[typeId].total++;
			if (task.status === 'completed') byType[typeId].completed++;
			byType[typeId].totalMinutes += task.duration || 0;
			if (task.actualDuration) byType[typeId].actualMinutes += task.actualDuration;
		});
		return Object.values(byType).sort((a, b) => b.total - a.total);
	}, [pending, paused, completed, taskTypes]);

	// Overdue count
	const overdueCount = useMemo(() => {
		const now = new Date();
		return pending.filter(task => {
			if (!task.scheduledTime) return false;
			const end = new Date(new Date(task.scheduledTime).getTime() + (task.duration || 30) * 60000);
			return end < now;
		}).length;
	}, [pending]);

	// Trigger celebration when reaching 100%
	useEffect(() => {
		if (completedPercentage === 1 && totalAmount > 0 && completedAmount > prevCompleted) {
			setShowCelebration(true);
			triggerConfetti();
			setTimeout(() => setShowCelebration(false), 5000);
		}
		setPrevCompleted(completedAmount);
	}, [completedPercentage, totalAmount, completedAmount, prevCompleted]);

	// Simple confetti effect
	function triggerConfetti() {
		const confetti = document.createElement('div');
		confetti.className = styles.confetti;
		confetti.innerHTML = '🎉🎊✨'.repeat(20);
		document.body.appendChild(confetti);
		setTimeout(() => confetti.remove(), 3000);
	}

	return (
		<div className={styles.wrapper}>
			<div
				className={`${styles.progress} ${showCelebration ? styles.celebrating : ''}`}
				onClick={() => totalAmount > 0 && setShowBreakdown(v => !v)}
				style={{ cursor: totalAmount > 0 ? 'pointer' : 'default' }}
			>
				<div
					className={`${styles.progressbar} ${styles.paused} ${hoveredSection === 'paused' ? styles.hovered : ''}`}
					style={{ width: `${pausedPercentage * 100}%` }}
					onMouseEnter={() => setHoveredSection('paused')}
					onMouseLeave={() => setHoveredSection(null)}
					title={`Paused: ${pausedAmount} tasks (${Math.round(pausedPercentage * 100 - completedPercentage * 100)}%)`}
					aria-label={`${pausedAmount} tasks paused`}
				>
					{hoveredSection === 'paused' && pausedAmount > 0 && (
						<span className={styles.tooltip}>
							{pausedAmount} paused ({Math.round((pausedAmount / totalAmount) * 100)}%)
						</span>
					)}
				</div>
				<div
					className={`${styles.progressbar} ${styles.completed} ${hoveredSection === 'completed' ? styles.hovered : ''}`}
					style={{ width: `${completedPercentage * 100}%` }}
					onMouseEnter={() => setHoveredSection('completed')}
					onMouseLeave={() => setHoveredSection(null)}
					title={`Completed: ${completedAmount} tasks (${Math.round(completedPercentage * 100)}%)`}
					aria-label={`${completedAmount} tasks completed`}
				>
					{hoveredSection === 'completed' && completedAmount > 0 && (
						<span className={styles.tooltip}>
							{completedAmount} done ({Math.round(completedPercentage * 100)}%)
						</span>
					)}
				</div>
				{showCelebration && (
					<div className={styles.celebrationMessage}>
						🎉 All tasks completed! Great job! 🎉
					</div>
				)}
				{totalAmount > 0 && (
					<div className={styles.progressText}>
						{completedAmount}/{totalAmount} tasks
						{overdueCount > 0 && (
							<span className={styles.overdueCount}> · {overdueCount} overdue</span>
						)}
					</div>
				)}
			</div>

			{/* Type breakdown panel */}
			{showBreakdown && typeBreakdown.length > 0 && (
				<div className={styles.breakdown}>
					{typeBreakdown.map(type => {
						const pct = type.total > 0 ? Math.round((type.completed / type.total) * 100) : 0;
						return (
							<div key={type.id || type.name} className={styles.breakdownRow}>
								<div className={styles.breakdownLabel}>
									<span className={styles.breakdownDot} style={{ background: type.color }} />
									<span>{type.icon} {type.name}</span>
								</div>
								<div className={styles.breakdownBar}>
									<div className={styles.breakdownFill} style={{ width: `${pct}%`, background: type.color }} />
								</div>
								<span className={styles.breakdownStat}>{type.completed}/{type.total}</span>
								{type.actualMinutes > 0 && (
									<span className={styles.breakdownTime}>
										{type.actualMinutes}m/{type.totalMinutes}m
									</span>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

export default Progress;
