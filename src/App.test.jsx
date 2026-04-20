import { test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App.jsx";

test("renders the taskometer header", () => {
  render(<App />);
  expect(screen.getByText(/taskometer/i)).toBeInTheDocument();
});

test("shows the three view tabs: gauge, wheel, fit", () => {
  render(<App />);
  const tabs = screen.getAllByRole("button").map((b) => b.textContent);
  expect(tabs).toContain("gauge");
  expect(tabs).toContain("wheel");
  expect(tabs).toContain("fit");
});

test("switching to the wheel tab reveals the 24h slot subhead", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "wheel" }));
  expect(screen.getByText(/24h slots/i)).toBeInTheDocument();
});

test("switching to the fit tab shows the week capacity label", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "fit" }));
  expect(screen.getAllByText(/week capacity/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/everything fits/i)).toBeInTheDocument();
});
