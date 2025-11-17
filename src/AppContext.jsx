import { createContext, useContext, useReducer } from "react";
import { format } from "date-fns";
import { saveState, loadState } from "./local-storage";
import { scheduleTasks } from './utils/scheduler';
import { ACTIVITY_TYPES, getActiveSchedule } from './utils/scheduleTemplates';
import { findOptimalTimeSlot, batchScheduleTasks } from './utils/intelligentScheduler';

export const AppContext = createContext();

export function useAppState() {
	return useContext(AppContext)[0];
}

export function useAppReducer() {
	return useContext(AppContext)[1];
}

export function useItems() {
	const { items } = useAppState();

	const pending = items.filter((item) => item.status === "pending");
	const paused = items.filter((item) => item.status === "paused");
	const completed = items.filter((item) => item.status === "completed");

	return { pending, paused, completed };
}

const appStateReducer = (state, action) => {
	let nd = new Date();

	let currentDate = {
		day: format(nd, "dd"),
		dayDisplay: format(nd, "d"),
		month: format(nd, "MM"),
		monthDisplay: format(nd, "MMM"),
		year: format(nd, "y"),
		weekday: format(nd, "EEEE"),
	};

switch (action.type) {
	case "RESCHEDULE_ALL_TASKS": {
		// Get all pending tasks (not completed or cancelled)
		const pendingTasks = state.items
			.filter(item => item.status === 'pending' || item.status === 'paused')
			.map(item => ({
				...item,
				scheduledFor: null,
				specificTime: null,
				specificDay: null
			}));
		
		// Use intelligent scheduler if we have an active schedule
		const activeSchedule = getActiveSchedule();
		
		if (activeSchedule) {
			// Use intelligent routing
			const scheduledTasks = batchScheduleTasks(
				pendingTasks,
				activeSchedule,
				[] // Pass empty array since we're rescheduling everything
			);
			
			// Update items with new scheduled times
			const updatedItems = state.items.map(item => {
				const scheduledItem = scheduledTasks.find(s => s.key === item.key);
				return scheduledItem || item;
			});
			
			const newState = { ...state, items: updatedItems };
			saveState(newState);
			return newState;
		} else {
			// Fall back to old scheduler
			const { scheduled, unscheduled } = scheduleTasks(
				pendingTasks,
				[], // Pass empty array since we're rescheduling everything
				state.taskTypes
			);

			// Update all items with new scheduled times or clear them
			const updatedItems = state.items.map(item => {
				const scheduledItem = scheduled.find(s => s.key === item.key);
				if (scheduledItem) {
					return scheduledItem;
				} else if (item.status === 'pending' || item.status === 'paused') {
					// Clear scheduling for unscheduled pending/paused tasks
					return {
						...item,
						scheduledFor: null,
						specificTime: null,
						specificDay: null
					};
				}
				return item;
			});

			const newState = { ...state, items: updatedItems };
			saveState(newState);
			return newState;
		}
	}
	case "SCHEDULE_TASKS": {
		// Use intelligent scheduler if we have an active schedule
		const activeSchedule = getActiveSchedule();
		
		if (activeSchedule) {
			// Use intelligent routing
			const scheduledTasks = batchScheduleTasks(
				action.tasks,
				activeSchedule,
				state.items
			);
			
			// Update items with scheduled times
			const updatedItems = state.items.map(item => {
				const scheduledItem = scheduledTasks.find(s => s.key === item.key);
				return scheduledItem || item;
			});
			
			const newState = { ...state, items: updatedItems };
			saveState(newState);
			return newState;
		} else {
			// Fall back to old scheduler
			const { scheduled, unscheduled } = scheduleTasks(
				action.tasks,
				state.items,
				state.taskTypes
			);

			// Update scheduled tasks
			const updatedItems = state.items.map(item => {
				const scheduledItem = scheduled.find(s => s.key === item.key);
				return scheduledItem || item;
			});

			const newState = { ...state, items: updatedItems };
			saveState(newState);
			return newState;
		}
	}
		case "ADD_TASK_TYPE": {
			const newState = {
				...state,
				taskTypes: [...state.taskTypes, action.taskType],
			};
			saveState(newState);
			return newState;
		}
		case "UPDATE_TASK_TYPE": {
			const newTaskTypes = state.taskTypes.map((type) =>
				type.id === action.taskType.id ? { ...type, ...action.taskType } : type
			);
			const newState = { ...state, taskTypes: newTaskTypes };
			saveState(newState);
			return newState;
		}
		case "DELETE_TASK_TYPE": {
			// Don't allow deletion of the default type
			if (action.taskTypeId === 'default') return state;
			
			const newTaskTypes = state.taskTypes.filter(
				(type) => type.id !== action.taskTypeId
			);
			const newState = { ...state, taskTypes: newTaskTypes };
			saveState(newState);
			return newState;
		}
	case "ADD_ITEM": {
		// Check if we should use intelligent scheduling
		const activeSchedule = getActiveSchedule();
		let scheduledItem = action.item;
		
		if (activeSchedule && !action.item.scheduledFor && !action.item.specificTime) {
			// Use intelligent scheduler to find optimal time slot
			const optimalSlot = findOptimalTimeSlot(
				action.item,
				activeSchedule,
				state.items
			);
			
			if (optimalSlot) {
				scheduledItem = {
					...action.item,
					scheduledFor: optimalSlot.scheduledFor,
					specificTime: optimalSlot.specificTime
				};
			}
		}
		
		const newState = { ...state, items: state.items.concat(scheduledItem) };
		saveState(newState);
		return newState;
	}
	case "UPDATE_ITEM": {
		const activeSchedule = getActiveSchedule();
		let updatedItem = action.item;
		
		// If item needs rescheduling and we have an active schedule
		if (activeSchedule && action.item.status === 'pending' && 
			!action.item.scheduledFor && !action.item.specificTime) {
			// Use intelligent scheduler to find optimal time slot
			const optimalSlot = findOptimalTimeSlot(
				action.item,
				activeSchedule,
				state.items.filter(i => i.key !== action.item.key) // Exclude the item being updated
			);
			
			if (optimalSlot) {
				updatedItem = {
					...action.item,
					scheduledFor: optimalSlot.scheduledFor,
					specificTime: optimalSlot.specificTime
				};
			}
		}
		
		const newItems = state.items.map((i) => {
			if (i.key === action.item.key) {
				// Preserve all fields from the updated item
				return { ...i, ...updatedItem };
			}
			return i;
		});
		const newState = { ...state, items: newItems };
		saveState(newState);
		return newState;
	}
	case "DELETE_ITEM": {
		// Save deleted item to history before removing
		const deletedItem = state.items.find(item => item.key === action.item.key);
		if (deletedItem) {
			const savedHistory = localStorage.getItem('taskometer-history');
			let history = [];
			if (savedHistory) {
				try {
					history = JSON.parse(savedHistory);
				} catch (e) {
					console.error('Failed to parse history:', e);
				}
			}
			// Add deleted item to history
			history.push({
				...deletedItem,
				removedAt: new Date().toISOString(),
				action: 'removed'
			});
			localStorage.setItem('taskometer-history', JSON.stringify(history));
		}
		
		const newState = {
			...state,
			items: state.items.filter((item) => item.key !== action.item.key),
		};
		saveState(newState);
		return newState;
	}
		case "RESET_ALL": {
			const newItems = state.items
				.filter((item) => item.status !== "completed")
				.map((i) => {
					if (i.status === "paused") {
						return Object.assign({}, i, {
							status: "pending",
						});
					}
					return i;
				});
			const newState = { ...state, items: newItems, date: currentDate };
			saveState(newState);
			return newState;
		}
		case "APPLY_TEMPLATE_BLOCKS": {
			const { blocks, options } = action.payload;
			const { overrideExisting = false, mergeWithExisting = true } = options || {};

			// Create calendar items from template blocks
			const templateItems = blocks.map((block, index) => ({
				key: `template-${block.templateId}-${new Date(block.startTime).getTime()}-${index}`,
				text: block.label || block.name || `${block.type} block`,
				description: block.description || '',
				status: 'pending',
				taskType: block.type,
				duration: Math.round((new Date(block.endTime) - new Date(block.startTime)) / 60000), // minutes
				scheduledTime: block.startTime,
				specificTime: new Date(block.startTime).toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				}),
				scheduledFor: new Date(block.startTime).toISOString().split('T')[0],
				specificDay: format(new Date(block.startTime), 'EEEE'),
				categoryId: block.categoryId,
				color: block.color,
				isTemplateBlock: true,
				templateId: block.templateId,
				templateName: block.templateName
			}));

			let newItems;
			if (overrideExisting) {
				// Remove existing template blocks and add new ones
				newItems = [
					...state.items.filter(item => !item.isTemplateBlock),
					...templateItems
				];
			} else if (mergeWithExisting) {
				// Keep existing items and add template blocks
				newItems = [...state.items, ...templateItems];
			} else {
				// Replace all items with template blocks
				newItems = templateItems;
			}

			const newState = { ...state, items: newItems };
			saveState(newState);
			return newState;
		}
		case "AUTO_SLOT_TASKS_INTO_TEMPLATE": {
			const { templateBlocks } = action.payload;

			// Get unscheduled tasks
			const unscheduledTasks = state.items.filter(
				item => item.status === 'pending' && !item.scheduledTime && !item.isTemplateBlock
			);

			if (unscheduledTasks.length === 0 || !templateBlocks || templateBlocks.length === 0) {
				return state;
			}

			// Auto-slot each unscheduled task into appropriate template blocks
			const updatedItems = state.items.map(item => {
				// Skip if already scheduled or is a template block
				if (item.scheduledTime || item.isTemplateBlock || item.status !== 'pending') {
					return item;
				}

				// Find matching template blocks for this task type
				const eligibleBlocks = templateBlocks.filter(block => {
					// Match by task type or use flexible blocks
					return block.type === item.taskType || block.type === 'flexible_work' || block.type === 'buffer';
				});

				if (eligibleBlocks.length === 0) {
					return item; // No matching block found
				}

				// Sort by start time to fill earliest slots first
				const sortedBlocks = [...eligibleBlocks].sort((a, b) =>
					new Date(a.startTime) - new Date(b.startTime)
				);

				// Find first available block with enough time
				for (const block of sortedBlocks) {
					const blockStart = new Date(block.startTime);
					const blockEnd = new Date(block.endTime);
					const taskDuration = item.duration || 30; // minutes
					const blockDuration = (blockEnd - blockStart) / 60000; // minutes

					// Check if task fits in block and block is in the future
					if (blockDuration >= taskDuration && blockStart > new Date()) {
						// Check for conflicts with already scheduled items
						const hasConflict = state.items.some(otherItem => {
							if (!otherItem.scheduledTime || otherItem.key === item.key) return false;

							const otherStart = new Date(otherItem.scheduledTime);
							const otherEnd = new Date(otherStart.getTime() + (otherItem.duration || 30) * 60000);
							const taskEnd = new Date(blockStart.getTime() + taskDuration * 60000);

							return (blockStart < otherEnd && taskEnd > otherStart);
						});

						if (!hasConflict) {
							// Schedule the task in this block
							return {
								...item,
								scheduledTime: blockStart.toISOString(),
								specificTime: blockStart.toLocaleTimeString('en-US', {
									hour: '2-digit',
									minute: '2-digit',
									hour12: false
								}),
								scheduledFor: blockStart.toISOString().split('T')[0],
								specificDay: format(blockStart, 'EEEE'),
								assignedToTemplate: true,
								templateBlockId: block.templateId
							};
						}
					}
				}

				return item; // Couldn't find suitable block
			});

			const newState = { ...state, items: updatedItems };
			saveState(newState);
			return newState;
		}
		default:
			return state;
	}
};

export function AppStateProvider({ children }) {
let initialState = loadState();

	if (initialState === undefined) {
		let nd = new Date();

		initialState = {
			items: [],
			activeSchedule: getActiveSchedule(),
			taskTypes: [
				// Convert ACTIVITY_TYPES to task types format
				...Object.values(ACTIVITY_TYPES).map(activity => ({
					id: activity.id,
					name: activity.name,
					defaultDuration: 30,
					allowedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
					color: activity.color,
					icon: activity.icon
				}))
			],
			date: {
				day: format(nd, "dd"),
				dayDisplay: format(nd, "d"),
				month: format(nd, "MM"),
				monthDisplay: format(nd, "MMM"),
				year: format(nd, "y"),
				weekday: format(nd, "EEEE"),
			},
		};
	}

	saveState(initialState);

	const value = useReducer(appStateReducer, initialState);
	return (
		<div className="App">
			<AppContext.Provider value={value}>{children}</AppContext.Provider>
		</div>
	);
}
