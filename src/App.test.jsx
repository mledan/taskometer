import { test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App.jsx";

test("starts on the schedule setup view", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /schedule/i })).toBeInTheDocument();
});

test("shows the core workflow tabs in top nav", () => {
  render(<App />);
  const navButtons = screen.getAllByRole("button");
  const tabLabels = navButtons.map((b) => b.textContent);
  expect(tabLabels).toContain("Dashboard");
  expect(tabLabels).toContain("Schedule");
  expect(tabLabels).toContain("Tasks");
  expect(tabLabels).toContain("Calendar");
  expect(tabLabels).toContain("History");
});

test("navigates to tasks tab", () => {
  render(<App />);
  const allTasksBtns = screen.getAllByRole("button", { name: "Tasks" });
  fireEvent.click(allTasksBtns[0]);
  expect(screen.getByText(/task intake by type/i)).toBeInTheDocument();
});

test("navigates to dashboard tab", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  expect(screen.getByRole("heading", { name: /current focus/i })).toBeInTheDocument();
});
