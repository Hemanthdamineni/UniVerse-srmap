import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ToDo from "./ToDo";

// Mock Popover component since it depends on external UI primitives
vi.mock("../../components/popover", () => ({
  Popover: ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
    return (
      <div data-testid="popover-wrapper" data-open={open}>
        {typeof children === "function"
          ? children({ open, onOpenChange })
          : children}
      </div>
    );
  },
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
    return <div data-testid="popover-trigger">{children}</div>;
  },
  PopoverContent: ({ children, side, className, style }: { children: React.ReactNode; side?: string; className?: string; style?: React.CSSProperties }) => {
    return <div data-testid="popover-content" data-side={side}>{children}</div>;
  },
}));

describe("ToDo", () => {
  const defaultProfileData = {
    TableContent: {
      "Register No.": "AP23110010419",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // --- Initial render and tabs ---

  it("renders tabs with correct default counts (0)", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    expect(screen.getByText("To-Do-List (0)")).toBeInTheDocument();
    expect(screen.getByText("Missing (0)")).toBeInTheDocument();
    expect(screen.getByText("Done (0)")).toBeInTheDocument();
  });

  it("shows 'Add Task' button", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    expect(screen.getByText("+ Add Task")).toBeInTheDocument();
  });

  it("renders empty state for the active tab by default", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    expect(screen.getByText("No assigned tasks")).toBeInTheDocument();
  });

  // --- Tab switching ---

  it("switches to Missing tab when clicked", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Missing (0)"));
    expect(screen.getByText("No missing tasks")).toBeInTheDocument();
  });

  it("switches to Done tab when clicked", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Done (0)"));
    expect(screen.getByText("No done tasks")).toBeInTheDocument();
  });

  // --- Task creation ---

  it("allows adding a new task via the popover", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    // The Add Task button should be in the popover trigger
    const addButton = screen.getByText("+ Add Task");
    fireEvent.click(addButton);

    // The popover content should render the form
    const titleInput = screen.getByPlaceholderText("Task title");
    expect(titleInput).toBeInTheDocument();
  });

  it("adds a task and shows it in the list", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    // Click Add Task to open popover
    fireEvent.click(screen.getByText("+ Add Task"));

    // Fill in the form
    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.change(titleInput, { target: { value: "Complete Math Assignment" } });

    const categoryInput = screen.getByPlaceholderText(/Category/i);
    fireEvent.change(categoryInput, { target: { value: "Assignment" } });

    const descriptionInput = screen.getByPlaceholderText("Description");
    fireEvent.change(descriptionInput, { target: { value: "Solve chapter 5 problems" } });

    // Click Add Task button in form
    const addTaskBtn = screen.getAllByText("Add Task");
    const submitBtn = addTaskBtn[addTaskBtn.length - 1];
    fireEvent.click(submitBtn);

    // Task should appear
    expect(screen.getByText("Complete Math Assignment")).toBeInTheDocument();
    expect(screen.getByText("Assignment")).toBeInTheDocument();
    expect(screen.getByText("Solve chapter 5 problems")).toBeInTheDocument();
  });

  it("does not add empty title task", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("+ Add Task"));
    const addTaskBtn = screen.getAllByText("Add Task");
    const submitBtn = addTaskBtn[addTaskBtn.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  // --- Task status transitions ---

  it("moves task from assigned to done", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    // Add a task
    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Read Chapter 3" } });
    const addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    expect(screen.getByText("Read Chapter 3")).toBeInTheDocument();

    // Mark as done
    fireEvent.click(screen.getByTitle("Mark as done"));

    // Should disappear from assigned tab
    expect(screen.queryByText("Read Chapter 3")).not.toBeInTheDocument();

    // Should appear in Done tab
    fireEvent.click(screen.getByText(/Done/));
    expect(screen.getByText("Read Chapter 3")).toBeInTheDocument();
  });

  it("moves task from assigned to missing", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Submit Lab Report" } });
    const addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    expect(screen.getByText("Submit Lab Report")).toBeInTheDocument();

    // Mark as missing
    fireEvent.click(screen.getByTitle("Mark as missing"));

    expect(screen.queryByText("Submit Lab Report")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Missing/));
    expect(screen.getByText("Submit Lab Report")).toBeInTheDocument();
  });

  it("moves task from missing back to done", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Fix Bug" } });
    const addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    // Move to missing
    fireEvent.click(screen.getByTitle("Mark as missing"));

    // Switch to missing tab
    fireEvent.click(screen.getByText(/Missing/));
    expect(screen.getByText("Fix Bug")).toBeInTheDocument();

    // Mark as done from missing tab
    fireEvent.click(screen.getByTitle("Mark as done"));
    expect(screen.queryByText("Fix Bug")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Done/));
    expect(screen.getByText("Fix Bug")).toBeInTheDocument();
  });

  it("moves task from done back to assigned", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Review PR" } });
    const addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    // Complete it
    fireEvent.click(screen.getByTitle("Mark as done"));

    // Switch to done tab
    fireEvent.click(screen.getByText(/Done/));
    expect(screen.getByText("Review PR")).toBeInTheDocument();

    // Move back to assigned
    fireEvent.click(screen.getByTitle("Move back to assigned"));
    expect(screen.queryByText("Review PR")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/To-Do-List/));
    expect(screen.getByText("Review PR")).toBeInTheDocument();
  });

  // --- Task deletion ---

  it("deletes a task from the list", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Temp Task" } });
    const addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    expect(screen.getByText("Temp Task")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Delete task"));
    expect(screen.queryByText("Temp Task")).not.toBeInTheDocument();
  });

  // --- localStorage persistence ---

  it("persists tasks to localStorage", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Persistent Task" } });
    const addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    const stored = localStorage.getItem("tasks_AP23110010419");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBe(1);
    expect(parsed[0].title).toBe("Persistent Task");
  });

  it("loads tasks from localStorage on mount", () => {
    const tasks = [
      {
        id: "preload-1",
        title: "Preloaded Task",
        description: "Came from storage",
        dueDate: new Date().toISOString(),
        status: "assigned",
        category: "Lab",
        regNo: "AP23110010419",
      },
    ];
    localStorage.setItem("tasks_AP23110010419", JSON.stringify(tasks));

    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Preloaded Task")).toBeInTheDocument();
    expect(screen.getByText("Lab")).toBeInTheDocument();
    expect(screen.getByText("Came from storage")).toBeInTheDocument();
  });

  // --- Date-specific filtering ---

  it("shows only tasks for the selected date", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tasks = [
      {
        id: "today-task",
        title: "Today's Task",
        description: "",
        dueDate: today.toISOString(),
        status: "assigned",
        category: "General",
        regNo: "AP23110010419",
      },
      {
        id: "yesterday-task",
        title: "Yesterday's Task",
        description: "",
        dueDate: yesterday.toISOString(),
        status: "assigned",
        category: "General",
        regNo: "AP23110010419",
      },
    ];
    localStorage.setItem("tasks_AP23110010419", JSON.stringify(tasks));

    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Today's Task")).toBeInTheDocument();
    expect(screen.queryByText("Yesterday's Task")).not.toBeInTheDocument();
  });

  // --- Cancel adding task ---

  it("cancels add task and clears the form", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("+ Add Task"));

    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.change(titleInput, { target: { value: "Cancelled Task" } });

    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);

    // Task should not appear
    expect(screen.queryByText("Cancelled Task")).not.toBeInTheDocument();
  });

  // --- Unknown regNo fallback ---

  it("falls back to UNKNOWN when no register number is found", () => {
    const profileNoReg = { TableContent: {} };

    render(
      <MemoryRouter>
        <ToDo profileData={profileNoReg} />
      </MemoryRouter>,
    );

    // Should still render without error
    expect(screen.getByText("+ Add Task")).toBeInTheDocument();
  });

  // --- Task counts update ---

  it("updates tab counts when tasks change", () => {
    const today = new Date();
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={today} />
      </MemoryRouter>,
    );

    // Add first task
    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Task 1" } });
    let addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    expect(screen.getByText("To-Do-List (1)")).toBeInTheDocument();

    // Add second task
    fireEvent.click(screen.getByText("+ Add Task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Task 2" } });
    addTaskBtn = screen.getAllByText("Add Task");
    fireEvent.click(addTaskBtn[addTaskBtn.length - 1]);

    expect(screen.getByText("To-Do-List (2)")).toBeInTheDocument();
  });

  it("shows tasks for: label with formatted date", () => {
    const date = new Date("2026-07-20");
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} selectedDate={date} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(`Tasks for: ${date.toLocaleDateString()}`),
    ).toBeInTheDocument();
  });

  it("shows 'Tasks for: Today' when no selectedDate is provided", () => {
    render(
      <MemoryRouter>
        <ToDo profileData={defaultProfileData} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Tasks for: /)).toBeInTheDocument();
  });
});
