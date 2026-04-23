import { test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App.jsx";

test("renders the taskometer header", () => {
  render(<App />);
  expect(screen.getByText(/taskometer/i)).toBeInTheDocument();
});

test("shows the scale selector with slot/day/week/month/quarter/year", () => {
  render(<App />);
  const buttons = screen.getAllByRole("button").map((b) => b.textContent);
  ["slot", "day", "week", "month", "quarter", "year"].forEach((s) => {
    expect(buttons).toContain(s);
  });
});

test("shows the quickstart picker on a fresh install", () => {
  render(<App />);
  // Fresh install has no slots yet, so the picker card is visible.
  expect(screen.getByText(/pick a day to start with/i)).toBeInTheDocument();
  // At least one seeded wheel name is rendered as a button.
  const buttons = screen.getAllByRole("button").map((b) => b.textContent);
  expect(buttons.some((t) => /weekday/i.test(t || ""))).toBe(true);
});

test("switching scale to week shows the weekday strip", () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "week" }));
  // Weekday labels like "Mon, Apr 20" / "Mon · Apr 20 · today" land inside
  // a nested div; match on the raw text so we don't depend on structure.
  const text = container.textContent || "";
  expect(/\b(mon|tue|wed|thu|fri|sat|sun)\b/i.test(text)).toBe(true);
});
