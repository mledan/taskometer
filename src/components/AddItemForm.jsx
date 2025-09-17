import { useRef, useState } from "react";
import { useAppReducer, useAppState } from "../AppContext.jsx";
import styles from "./AddItemForm.module.css";

// Form to populate todo items
function AddItemForm() {
	const dispatch = useAppReducer();
	const { taskTypes } = useAppState();
	let inputRef = useRef();

	// State for form fields
  const [taskType, setTaskType] = useState("work");
	const [schedulingPreference, setSchedulingPreference] = useState("immediate");
	const [duration, setDuration] = useState(30);
	const [priority, setPriority] = useState("medium");
	const [delayMinutes, setDelayMinutes] = useState(0);
	const [specificDay, setSpecificDay] = useState(null);
	const [specificTime, setSpecificTime] = useState('09:00');

	function addItem(e) {
const newItem = {
			text: inputRef.current.value,
			key: Date.now(),
			status: "pending",
			taskType,
			duration,
			schedulingPreference,
			priority,
			scheduledTime: null,
			delayMinutes: schedulingPreference === 'delay' ? delayMinutes : 0,
			specificDay: schedulingPreference === 'specific' ? specificDay : null,
			specificTime: schedulingPreference === 'specific' ? specificTime : null,
		};
		if (newItem.text.trim()) {
			dispatch({ type: "ADD_ITEM", item: newItem });

			// Auto-schedule on add if preference is immediate or specific/delay
			if (newItem.schedulingPreference === 'immediate' || newItem.schedulingPreference === 'specific' || newItem.schedulingPreference === 'delay') {
				dispatch({ type: 'SCHEDULE_TASKS', tasks: [newItem] });
			}
		}
		e.preventDefault();
		inputRef.current.value = "";
		inputRef.current.focus();
	}

return (
		<form className={styles.form} onSubmit={addItem}>
			<div className={styles.mainInput}>
				<input ref={inputRef} placeholder="Add new item" autoFocus />
				<button type="submit" />
			</div>
			
			<div className={styles.options}>
				<select 
					value={taskType} 
					onChange={(e) => {
						setTaskType(e.target.value);
						// Update duration to task type default
						const typeConfig = taskTypes.find(t => t.id === e.target.value);
						setDuration(typeConfig?.defaultDuration || 30);
					}}
				>
					{taskTypes.map(type => (
						<option key={type.id} value={type.id}>{type.name}</option>
					))}
				</select>

				<select value={schedulingPreference} onChange={(e) => setSchedulingPreference(e.target.value)}>
					<option value="immediate">Schedule Immediately</option>
					<option value="delay">Delay Start</option>
					<option value="specific">Specific Day</option>
				</select>

				<input 
					type="number" 
					value={duration} 
					onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
					min="5"
					max="480"
					placeholder="Duration (min)"
				/>

				<select value={priority} onChange={(e) => setPriority(e.target.value)}>
					<option value="low">Low Priority</option>
					<option value="medium">Medium Priority</option>
					<option value="high">High Priority</option>
				</select>

				{schedulingPreference === 'delay' && (
					<input 
						type="number" 
						value={delayMinutes} 
						onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
						min="0"
						placeholder="Delay (min)"
					/>
				)}

				{schedulingPreference === 'specific' && (
					<>
						<input 
							type="date" 
							value={specificDay || ''} 
							onChange={(e) => setSpecificDay(e.target.value)}
							min={new Date().toISOString().split('T')[0]}
						/>
						<input 
							type="time" 
							value={specificTime} 
							onChange={(e) => setSpecificTime(e.target.value)}
						/>
					</>
				)}
			</div>
		</form>
	);
}

export default AddItemForm;
