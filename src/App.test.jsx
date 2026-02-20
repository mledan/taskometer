import { test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { format } from "date-fns";
import App from "./App.jsx";

test("starts on the schedules onboarding view", () => {
  render(<App />);
  expect(screen.getByText("Build your day from a proven routine.")).toBeInTheDocument();
});

test("renders the weekday on dashboard after navigation", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  const weekdayElement = screen.getByText(format(new Date(), "EEEE"));
  expect(weekdayElement).toBeInTheDocument();
});

test("renders the full date on dashboard after navigation", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
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
