import { test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App.jsx";

test("starts on the today view", () => {
  render(<App />);
  // Today view shows the day of the week as a heading
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
});

test("shows the three core tabs in top nav", () => {
  render(<App />);
  const navButtons = screen.getAllByRole("button");
  const tabLabels = navButtons.map((b) => b.textContent);
  expect(tabLabels).toContain("Today");
  expect(tabLabels).toContain("Plan");
  expect(tabLabels).toContain("Tasks");
});

test("navigates to tasks tab", () => {
  render(<App />);
  const allTasksBtns = screen.getAllByRole("button", { name: "Tasks" });
  fireEvent.click(allTasksBtns[0]);
  expect(screen.getByPlaceholderText(/what needs to be done/i)).toBeInTheDocument();
});

test("navigates to today tab", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(screen.getByText(/Quick Add/)).toBeInTheDocument();
});
