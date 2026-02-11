"use client";

import type { TaskContract, CalendarEventContract } from "@/lib/contracts";

type ConnectionsPanelProps = {
  // Connection actions
  connectTodoist: () => void;
  connectGoogle: () => void;
  loadTodoist: (silent?: boolean) => void;
  loadCalendar: (silent?: boolean) => void;
  // Status
  todoistLoading: boolean;
  calendarLoading: boolean;
  todoistError: string | null;
  calendarError: string | null;
  todoistCreateLoading: boolean;
  calendarCreateLoading: boolean;
  // Data
  todoistTasks: TaskContract[];
  calendarEvents: CalendarEventContract[];
  todoistProjects: Array<{ id: string; name: string }>;
  googleCalendars: Array<{ id: string; name: string; primary: boolean }>;
  selectedCalendarIds: string[];
  setSelectedCalendarIds: (fn: (prev: string[]) => string[]) => void;
  // Task editing
  editingTaskId: string | null;
  taskEditForm: {
    content: string;
    description: string;
    due_string: string;
    priority: string;
    labels: string;
    project_id: string;
    section_id: string;
    parent_id: string;
  };
  setTaskEditForm: (fn: (prev: ConnectionsPanelProps["taskEditForm"]) => ConnectionsPanelProps["taskEditForm"]) => void;
  updateTodoistTask: (task: TaskContract) => void;
  saveTodoistTaskEdits: () => void;
  cancelTodoistTaskEdits: () => void;
  completeTodoistTask: (taskId: string) => void;
  deleteTodoistTask: (taskId: string) => void;
  createTodoistTask: () => void;
  // New task form state
  newTaskContent: string;
  setNewTaskContent: (val: string) => void;
  newTaskDescription: string;
  setNewTaskDescription: (val: string) => void;
  newTaskDueString: string;
  setNewTaskDueString: (val: string) => void;
  newTaskPriority: string;
  setNewTaskPriority: (val: string) => void;
  newTaskLabels: string;
  setNewTaskLabels: (val: string) => void;
  newTaskProjectId: string;
  setNewTaskProjectId: (val: string) => void;
  newTaskSectionId: string;
  setNewTaskSectionId: (val: string) => void;
  newTaskParentId: string;
  setNewTaskParentId: (val: string) => void;
  // Event editing
  editingEventId: string | null;
  eventEditForm: {
    summary: string;
    description: string;
    location: string;
    start: string;
    end: string;
    calendarId: string;
    colorId: string;
  };
  setEventEditForm: (fn: (prev: ConnectionsPanelProps["eventEditForm"]) => ConnectionsPanelProps["eventEditForm"]) => void;
  updateCalendarEvent: (event: CalendarEventContract) => void;
  saveCalendarEventEdits: () => void;
  cancelCalendarEventEdits: () => void;
  deleteCalendarEvent: (event: CalendarEventContract) => void;
  createCalendarEvent: () => void;
  // New event form state
  newEventTitle: string;
  setNewEventTitle: (val: string) => void;
  newEventStart: string;
  setNewEventStart: (val: string) => void;
  newEventEnd: string;
  setNewEventEnd: (val: string) => void;
  newEventLocation: string;
  setNewEventLocation: (val: string) => void;
  newEventColor: string;
  setNewEventColor: (val: string) => void;
};

const colorOptions = [
  { value: "1", label: "Lavender" },
  { value: "2", label: "Sage" },
  { value: "3", label: "Grape" },
  { value: "4", label: "Flamingo" },
  { value: "5", label: "Banana" },
  { value: "6", label: "Tangerine" },
  { value: "7", label: "Peacock" },
  { value: "8", label: "Graphite" },
  { value: "9", label: "Blueberry" },
  { value: "10", label: "Basil" },
  { value: "11", label: "Tomato" },
];

const inputClass = "w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export default function ConnectionsPanel(props: ConnectionsPanelProps) {
  const {
    connectTodoist, connectGoogle, loadTodoist, loadCalendar,
    todoistLoading, calendarLoading, todoistError, calendarError,
    todoistCreateLoading, calendarCreateLoading,
    todoistTasks, calendarEvents, todoistProjects, googleCalendars,
    selectedCalendarIds, setSelectedCalendarIds,
    editingTaskId, taskEditForm, setTaskEditForm,
    updateTodoistTask, saveTodoistTaskEdits, cancelTodoistTaskEdits,
    completeTodoistTask, deleteTodoistTask, createTodoistTask,
    newTaskContent, setNewTaskContent, newTaskDescription, setNewTaskDescription,
    newTaskDueString, setNewTaskDueString, newTaskPriority, setNewTaskPriority,
    newTaskLabels, setNewTaskLabels, newTaskProjectId, setNewTaskProjectId,
    newTaskSectionId, setNewTaskSectionId, newTaskParentId, setNewTaskParentId,
    editingEventId, eventEditForm, setEventEditForm,
    updateCalendarEvent, saveCalendarEventEdits, cancelCalendarEventEdits,
    deleteCalendarEvent, createCalendarEvent,
    newEventTitle, setNewEventTitle, newEventStart, setNewEventStart,
    newEventEnd, setNewEventEnd, newEventLocation, setNewEventLocation,
    newEventColor, setNewEventColor,
  } = props;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ textWrap: "balance" }}>Connections</h2>
          <p className="text-sm text-zinc-300">
            Link accounts to load real tasks and events.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            onClick={connectTodoist}
            type="button"
          >
            Connect Todoist
          </button>
          <button
            className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            onClick={connectGoogle}
            type="button"
          >
            Connect Google Calendar
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Todoist panel */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Todoist</span>
            <button
              className="text-xs font-medium text-indigo-300 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={() => loadTodoist()}
              type="button"
            >
              {todoistLoading ? "Loading..." : "Load tasks"}
            </button>
          </div>
          {todoistError ? (
            <p className="mt-2 text-xs text-rose-400">{todoistError}</p>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">
              {todoistTasks.length
                ? `${todoistTasks.length} tasks loaded`
                : "No tasks loaded yet"}
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {todoistTasks.slice(0, 5).map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200"
              >
                {editingTaskId === task.id ? (
                  <div className="mt-2 grid gap-2 text-xs text-zinc-200">
                    <input className={inputClass} value={taskEditForm.content} onChange={(e) => setTaskEditForm((prev) => ({ ...prev, content: e.target.value }))} />
                    <input className={inputClass} placeholder="Description" value={taskEditForm.description} onChange={(e) => setTaskEditForm((prev) => ({ ...prev, description: e.target.value }))} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input className={inputClass} placeholder="Due (e.g., tomorrow 5pm)" value={taskEditForm.due_string} onChange={(e) => setTaskEditForm((prev) => ({ ...prev, due_string: e.target.value }))} />
                      <input className={inputClass} placeholder="Priority (1-4)" value={taskEditForm.priority} inputMode="numeric" onChange={(e) => setTaskEditForm((prev) => ({ ...prev, priority: e.target.value }))} />
                    </div>
                    <input className={inputClass} placeholder="Labels (comma)" value={taskEditForm.labels} onChange={(e) => setTaskEditForm((prev) => ({ ...prev, labels: e.target.value }))} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <select className={inputClass} value={taskEditForm.project_id} onChange={(e) => setTaskEditForm((prev) => ({ ...prev, project_id: e.target.value }))}>
                        <option value="">Project (optional)</option>
                        {todoistProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input className={inputClass} placeholder="Section ID" value={taskEditForm.section_id} onChange={(e) => setTaskEditForm((prev) => ({ ...prev, section_id: e.target.value }))} spellCheck={false} />
                      <input className={inputClass} placeholder="Parent ID" value={taskEditForm.parent_id} onChange={(e) => setTaskEditForm((prev) => ({ ...prev, parent_id: e.target.value }))} spellCheck={false} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={saveTodoistTaskEdits}>Save</button>
                      <button type="button" className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={cancelTodoistTaskEdits}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{task.title}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className="min-h-[44px] px-2 text-[11px] text-indigo-300 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={() => updateTodoistTask(task)}>Edit</button>
                      <button type="button" className="min-h-[44px] px-2 text-[11px] text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={() => completeTodoistTask(task.id)}>Complete</button>
                      <button type="button" className="min-h-[44px] px-2 text-[11px] text-rose-300 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={() => deleteTodoistTask(task.id)}>Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Create task</p>
            <div className="mt-2 grid gap-2">
              <input className={inputClass} placeholder="Task title" value={newTaskContent} onChange={(e) => setNewTaskContent(e.target.value)} />
              <input className={inputClass} placeholder="Description" value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} />
              <input className={inputClass} placeholder="Due (e.g., tomorrow 5pm)" value={newTaskDueString} onChange={(e) => setNewTaskDueString(e.target.value)} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className={inputClass} placeholder="Priority (1-4)" value={newTaskPriority} inputMode="numeric" onChange={(e) => setNewTaskPriority(e.target.value)} />
                <input className={inputClass} placeholder="Labels (comma)" value={newTaskLabels} onChange={(e) => setNewTaskLabels(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select className={inputClass} value={newTaskProjectId} onChange={(e) => setNewTaskProjectId(e.target.value)}>
                  <option value="">Project (optional)</option>
                  {todoistProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className={inputClass} placeholder="Section ID" value={newTaskSectionId} onChange={(e) => setNewTaskSectionId(e.target.value)} spellCheck={false} />
                <input className={inputClass} placeholder="Parent ID" value={newTaskParentId} onChange={(e) => setNewTaskParentId(e.target.value)} spellCheck={false} />
              </div>
              <button className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" type="button" onClick={createTodoistTask} disabled={todoistCreateLoading}>
                {todoistCreateLoading ? "Creating..." : "Add task"}
              </button>
            </div>
          </div>
        </div>

        {/* Google Calendar panel */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Google Calendar</span>
            <button
              className="text-xs font-medium text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() => loadCalendar()}
              type="button"
            >
              {calendarLoading ? "Loading..." : "Load events"}
            </button>
          </div>
          {calendarError ? (
            <p className="mt-2 text-xs text-rose-400">{calendarError}</p>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">
              {calendarEvents.length
                ? `${calendarEvents.length} events loaded`
                : "No events loaded yet"}
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {calendarEvents.slice(0, 5).map((event) => (
              <li key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200">
                {editingEventId === event.id ? (
                  <div className="mt-2 grid gap-2 text-xs text-zinc-100">
                    <input className={inputClass} placeholder="Event title" value={eventEditForm.summary} onChange={(e) => setEventEditForm((prev) => ({ ...prev, summary: e.target.value }))} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input className={inputClass} type="datetime-local" value={eventEditForm.start} onChange={(e) => setEventEditForm((prev) => ({ ...prev, start: e.target.value }))} aria-label="Start time" />
                      <input className={inputClass} type="datetime-local" value={eventEditForm.end} onChange={(e) => setEventEditForm((prev) => ({ ...prev, end: e.target.value }))} aria-label="End time" />
                    </div>
                    <input className={inputClass} placeholder="Location" value={eventEditForm.location} onChange={(e) => setEventEditForm((prev) => ({ ...prev, location: e.target.value }))} />
                    <select className={inputClass} value={eventEditForm.calendarId} onChange={(e) => setEventEditForm((prev) => ({ ...prev, calendarId: e.target.value }))}>
                      <option value="">Select calendar</option>
                      {googleCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className={inputClass} value={eventEditForm.colorId} onChange={(e) => setEventEditForm((prev) => ({ ...prev, colorId: e.target.value }))}>
                      <option value="">Default color</option>
                      {colorOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button type="button" className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={saveCalendarEventEdits}>Save</button>
                      <button type="button" className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={cancelCalendarEventEdits}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{event.title ?? "Untitled event"}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" className="min-h-[44px] px-2 text-[11px] text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => updateCalendarEvent(event)}>Edit</button>
                      <button type="button" className="min-h-[44px] px-2 text-[11px] text-rose-300 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={() => deleteCalendarEvent(event)}>Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Create event</p>
            <div className="mt-2 grid gap-2">
              <select className={inputClass} value={selectedCalendarIds[0] ?? ""} onChange={(e) => setSelectedCalendarIds(() => e.target.value ? [e.target.value] : [])}>
                <option value="">Select calendar</option>
                {googleCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className={inputClass} placeholder="Event title" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} />
              <input className={inputClass} type="datetime-local" value={newEventStart} onChange={(e) => setNewEventStart(e.target.value)} aria-label="Event start time" />
              <input className={inputClass} type="datetime-local" value={newEventEnd} onChange={(e) => setNewEventEnd(e.target.value)} aria-label="Event end time" />
              <input className={inputClass} placeholder="Location (optional)" value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} />
              <select className={inputClass} value={newEventColor} onChange={(e) => setNewEventColor(e.target.value)}>
                <option value="">Default color</option>
                {colorOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" type="button" onClick={createCalendarEvent} disabled={calendarCreateLoading}>
                {calendarCreateLoading ? "Creating..." : "Add event"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
