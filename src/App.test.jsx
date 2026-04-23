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

test("switching scale to week renders 7 day cells", () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "week" }));
  // The week strip is a grid of 7 day cells, each rendering a MiniWheel
  // SVG. Counting SVGs is structural and avoids brittle text matching
  // (textContent concatenates without separators across nested divs).
  const svgCount = container.querySelectorAll("svg").length;
  // Some chrome (wheel toolbar buttons) may add a small constant of svgs;
  // 7 cells contribute >= 7 by themselves.
  expect(svgCount).toBeGreaterThanOrEqual(7);
});
