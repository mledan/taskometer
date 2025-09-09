import { createContext, useContext, useReducer } from "react";
import { loadState, saveState } from "./local-storage.js";
import { format } from "date-fns";
import { scheduleTasks } from './utils/scheduler.js';

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
		case "SCHEDULE_TASKS": {
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
			const newState = { ...state, items: state.items.concat(action.item) };
			saveState(newState);
			return newState;
		}
		case "UPDATE_ITEM": {
			const newItems = state.items.map((i) => {
				if (i.key === action.item.key) {
					// Preserve all fields from the action item, not just status
					return { ...i, ...action.item };
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
			taskTypes: [
				{
					id: 'default',
					name: 'Default',
					defaultDuration: 30,
					allowedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
				}
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
