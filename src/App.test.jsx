import { test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App.jsx";

test("starts on the defaults setup view", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /default schedule by day/i })).toBeInTheDocument();
});

test("shows the narrowed workflow tabs", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: "Defaults" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tasks" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Palace" })).toBeInTheDocument();
});

test("navigates to tasks tab", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
  expect(screen.getByText(/task intake by type/i)).toBeInTheDocument();
});

test("navigates to palace tab", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Palace" }));
  expect(screen.getByRole("heading", { name: /memory palace/i })).toBeInTheDocument();
});
