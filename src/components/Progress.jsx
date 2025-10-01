import { useState, useEffect } from 'react';
import { useItems, useAppState } from "../AppContext.jsx";
import styles from "./Progress.module.css";

// Progress bar for completed/paused todo items
function Progress() {
	const totalAmount = useAppState().items.length;
	const { paused, completed } = useItems();
	const completedAmount = completed.length;
	const pausedAmount = paused.length;
	const [showCelebration, setShowCelebration] = useState(false);
	const [prevCompleted, setPrevCompleted] = useState(completedAmount);
	const [hoveredSection, setHoveredSection] = useState(null);

	let completedPercentage = completedAmount / totalAmount;
	let pausedPercentage = pausedAmount / totalAmount + completedPercentage;

	if (isNaN(completedPercentage)) {
		completedPercentage = 0;
	}

	if (isNaN(pausedPercentage)) {
		pausedPercentage = 0;
	}

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
		<div className={`${styles.progress} ${showCelebration ? styles.celebrating : ''}`}>
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
				</div>
			)}
		</div>
	);
}

export default Progress;
