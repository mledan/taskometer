import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { format } from "date-fns";
import App from "./App.jsx";

test("renders the app with navigation", () => {
  render(<App />);
  // Dashboard is now the default view
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
});

test("renders the weekday on dashboard", () => {
  render(<App />);
  // Dashboard shows the weekday as a heading
  const weekdayElement = screen.getByText(format(new Date(), "EEEE"));
  expect(weekdayElement).toBeInTheDocument();
});

test("renders the full date on dashboard", () => {
  render(<App />);
  // Dashboard shows full date like "February 19, 2026"
  const fullDate = format(new Date(), "MMMM d, yyyy");
  expect(screen.getByText(fullDate)).toBeInTheDocument();
});

test("renders task-related elements", () => {
  render(<App />);
  // Dashboard has navigation tabs
  expect(screen.getByText('Tasks')).toBeInTheDocument();
  expect(screen.getByText('Calendar')).toBeInTheDocument();
  expect(screen.getByText('Schedules')).toBeInTheDocument();
});
