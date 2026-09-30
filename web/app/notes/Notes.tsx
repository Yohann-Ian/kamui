"use client";

// Notes: a narrow list (search, Battlefield filter, pinned first) and an editor
// that takes the rest of the screen. Edits save as you type, 600ms after the
// last keystroke, and immediately when you switch notes or leave the page. A
// note left empty is discarded when you move on.

import { useCallback, useEffect, useRef, useState } from "react";
import { CardLabel, btnPrimary, field, timeAgo } from "../shell/ui";
import { createNote, deleteNote, updateNote, type NoteData } from "./actions";

type Fields = { title?: string; body?: string; pinned?: boolean; battlefieldId?: string | null };
type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY = 600;
const small =
  "rounded-btn border border-secondary-edge bg-secondary px-3 py-1 text-meta font-semibold hover:bg-hover";

const isEmpty = (n: NoteData) => !n.title.trim() && !n.body.trim();

function sortNotes(notes: NoteData[]) {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
}

// The first line of the body that is not just the title again
function snippet(n: NoteData) {
  const line = n.body.split("\n").map((l) => l.trim()).find((l) => l && l !== n.title.trim());
  return line ?? "No text";
}

export default function Notes({
  notes: initial,
  battlefields,
  selectedId: initialSelected,
}: {
  notes: NoteData[];
  battlefields: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const [notes, setNotes] = useState(initial);
  const [selectedId, setSelectedId] = useState(initialSelected);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // "all", "unfiled" or a Battlefield id
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(0); // 0 until mounted, so server and client render alike
  const titleRef = useRef<HTMLInputElement>(null);
  const focusTitle = useRef(false);

  // "edited 3 minutes ago" stays current
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const ago = (iso: string) => (now ? timeAgo(new Date(iso), now) : "");

  // Unsaved fields per note, and the timer that will save them
  const pending = useRef(new Map<string, Fields>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const notesRef = useRef(notes);
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    notesRef.current = notes;
    selectedRef.current = selectedId;
  });

  const flush = useCallback(async (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    const fields = pending.current.get(id);
    if (!fields) return;
    pending.current.delete(id);
    setSaveState("saving");
    try {
      const updatedAt = await updateNote(id, fields);
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, updatedAt } : n)));
      if (pending.current.size === 0) setSaveState("saved");
    } catch {
      // keep the fields so the next edit or switch retries them
      pending.current.set(id, { ...fields, ...pending.current.get(id) });
      setSaveState("error");
    }
  }, []);

  function edit(id: string, fields: Fields, delay = SAVE_DELAY) {
    const apply = (ns: NoteData[]) =>
      ns.map((n) => (n.id === id ? { ...n, ...fields, updatedAt: new Date().toISOString() } : n));
    // the ref too, so leaving straight after typing sees the latest text
    notesRef.current = apply(notesRef.current);
    setNotes(apply);
    pending.current.set(id, { ...pending.current.get(id), ...fields });
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => flush(id), delay));
    setSaveState("saving");
  }

  // Leaving a note: save what is pending, and drop it if it was left empty
  function leave(id: string | null) {
    if (!id) return;
    const note = notesRef.current.find((n) => n.id === id);
    if (note && isEmpty(note)) {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      pending.current.delete(id);
      setNotes((ns) => ns.filter((n) => n.id !== id));
      deleteNote(id).catch(() => {});
    } else {
      flush(id);
    }
  }

  function select(id: string | null) {
    if (id === selectedId) return;
    leave(selectedId);
    setSelectedId(id);
    window.history.replaceState(null, "", id ? `/notes?note=${id}` : "/notes");
  }

  async function newNote() {
    setCreating(true);
    try {
      const battlefieldId = filter !== "all" && filter !== "unfiled" ? filter : null;
      const note = await createNote(battlefieldId);
      leave(selectedId);
      setNotes((ns) => [note, ...ns]);
      setSelectedId(note.id);
      window.history.replaceState(null, "", `/notes?note=${note.id}`);
      setQuery("");
      focusTitle.current = true;
    } catch {
      setSaveState("error");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    const note = notes.find((n) => n.id === id);
    if (note && !isEmpty(note) && !window.confirm(`Delete "${note.title.trim() || "Untitled"}"? This cannot be undone.`)) {
      return;
    }
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    pending.current.delete(id);
    const rest = sortNotes(notes.filter((n) => n.id !== id));
    setNotes(rest);
    const next = rest[0]?.id ?? null;
    setSelectedId(next);
    window.history.replaceState(null, "", next ? `/notes?note=${next}` : "/notes");
    try {
      await deleteNote(id);
    } catch {
      setSaveState("error");
    }
  }

  // A new note starts with the cursor in its title
  useEffect(() => {
    if (focusTitle.current && selectedId) {
      focusTitle.current = false;
      titleRef.current?.focus();
    }
  }, [selectedId]);

  // Leaving the page (or closing the tab) saves what is pending
  useEffect(() => {
    const unsaved = pending.current;
    const saveAll = () => {
      for (const id of [...unsaved.keys()]) flush(id);
    };
    window.addEventListener("pagehide", saveAll);
    return () => {
      window.removeEventListener("pagehide", saveAll);
      const current = notesRef.current.find((n) => n.id === selectedRef.current);
      if (current && isEmpty(current)) {
        unsaved.delete(current.id);
        deleteNote(current.id).catch(() => {});
      }
      saveAll();
    };
  }, [flush]);

  const q = query.trim().toLowerCase();
  const shown = sortNotes(notes).filter(
    (n) =>
      (filter === "all" || (filter === "unfiled" ? !n.battlefieldId : n.battlefieldId === filter)) &&
      (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
  );
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const count = notes.filter((n) => !isEmpty(n)).length;

  const saveText =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Not saved. It will retry on your next edit."
        : selected
          ? `Saved${now ? `, edited ${ago(selected.updatedAt)}` : ""}`
          : "";

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 px-6 pt-6">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-heading font-bold tracking-[-0.015em]">Notes</h1>
          <p className="mt-1 text-item font-medium">
            {count} {count === 1 ? "note" : "notes"}
          </p>
        </div>
        <button onClick={newNote} disabled={creating} className={btnPrimary}>
          {creating ? "Creating..." : "New note"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 pb-4">
        {/* The list, kept narrow so the editor gets the screen */}
        <div className="glass-card flex w-[20rem] shrink-0 flex-col px-3 py-3">
          <div className="flex shrink-0 flex-col gap-2 px-1 pb-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className={`${field} w-full placeholder:text-white placeholder:opacity-80`}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Show notes from"
              className="glass-field px-2 py-1 text-meta font-medium"
            >
              <option value="all">All notes</option>
              <option value="unfiled">Unfiled</option>
              {battlefields.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <ul className="panel-scroll min-h-0 flex-1 overflow-y-auto">
            {shown.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => select(n.id)}
                  className={`flex w-full flex-col rounded-row px-3 py-2 text-left ${
                    n.id === selectedId ? "bg-row-selected" : "hover:bg-row-selected"
                  }`}
                >
                  <span className="flex w-full items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-item leading-[1.35] font-medium">
                      {n.title.trim() || "Untitled"}
                    </span>
                    {n.pinned ? <span className="shrink-0 text-label font-semibold opacity-85">Pinned</span> : null}
                  </span>
                  <span className="block w-full truncate text-meta leading-[1.35] font-medium">
                    {now ? `${ago(n.updatedAt)} · ` : ""}
                    {snippet(n)}
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-item leading-[1.5] font-medium">
                {notes.length === 0
                  ? "No notes yet. New note starts one."
                  : q
                    ? "No notes match this search."
                    : "No notes here yet."}
              </li>
            ) : null}
          </ul>
        </div>

        {/* The editor */}
        {selected ? (
          <div
            className="glass-card flex min-h-0 min-w-0 flex-1 flex-col px-6 py-5"
            onKeyDown={(e) => {
              // Ctrl/Cmd+S saves now rather than opening the browser's save dialog
              if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                flush(selected.id);
              }
            }}
          >
            <input
              ref={titleRef}
              value={selected.title}
              onChange={(e) => edit(selected.id, { title: e.target.value })}
              placeholder="Title"
              aria-label="Title"
              maxLength={200}
              className="w-full shrink-0 bg-transparent text-title leading-tight font-semibold outline-none placeholder:text-white placeholder:opacity-80"
            />
            <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 border-b border-divider pb-3">
              <select
                value={selected.battlefieldId ?? ""}
                onChange={(e) => edit(selected.id, { battlefieldId: e.target.value || null }, 0)}
                aria-label="Battlefield"
                className="glass-field px-2 py-1 text-meta font-medium"
              >
                <option value="">No Battlefield</option>
                {battlefields.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => edit(selected.id, { pinned: !selected.pinned }, 0)}
                aria-pressed={selected.pinned}
                className={small}
              >
                {selected.pinned ? "Unpin" : "Pin"}
              </button>
              <button onClick={() => remove(selected.id)} className={small}>
                Delete
              </button>
              <span className="ml-auto text-meta font-medium opacity-85" aria-live="polite">
                {saveText}
              </span>
            </div>
            <textarea
              value={selected.body}
              onChange={(e) => edit(selected.id, { body: e.target.value })}
              placeholder="Write here. It saves as you type."
              aria-label="Note"
              className="panel-scroll mt-3 min-h-0 w-full flex-1 resize-none bg-transparent pr-1 text-item leading-[1.6] outline-none placeholder:text-white placeholder:opacity-80"
            />
          </div>
        ) : (
          <div className="glass-card flex min-h-0 min-w-0 flex-1 flex-col px-6 py-5">
            <CardLabel>Note</CardLabel>
            <p className="mt-2 text-item leading-[1.55] font-medium">
              {notes.length === 0 ? "No notes yet. Click New note to write one." : "Pick a note from the list."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
