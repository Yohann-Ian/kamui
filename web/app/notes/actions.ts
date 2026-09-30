"use server";

// Notes save as the user types, so these do not revalidate: the page keeps its
// own copy of the notes, and a fresh visit loads them again from the database.

import { prisma } from "../../lib/prisma";

const TITLE_MAX = 200;
const BODY_MAX = 200_000;

export type NoteData = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  battlefieldId: string | null;
  updatedAt: string;
};

function toData(note: {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  battlefieldId: string | null;
  updatedAt: Date;
}): NoteData {
  return { ...note, updatedAt: note.updatedAt.toISOString() };
}

export async function createNote(battlefieldId: string | null) {
  const note = await prisma.note.create({ data: { battlefieldId } });
  return toData(note);
}

export async function updateNote(
  id: string,
  fields: { title?: string; body?: string; pinned?: boolean; battlefieldId?: string | null }
) {
  const data: typeof fields = {};
  if (typeof fields.title === "string") data.title = fields.title.slice(0, TITLE_MAX);
  if (typeof fields.body === "string") data.body = fields.body.slice(0, BODY_MAX);
  if (typeof fields.pinned === "boolean") data.pinned = fields.pinned;
  if (fields.battlefieldId !== undefined) data.battlefieldId = fields.battlefieldId || null;
  // An upsert, so a save never fails because the row went missing (a note left
  // empty is discarded when the page unmounts, and React's dev mode unmounts
  // once on purpose); the note simply comes back with what was typed.
  if (!/^[a-z0-9]{20,40}$/.test(id)) throw new Error("Bad note id");
  const note = await prisma.note.upsert({
    where: { id },
    update: data,
    create: { id, title: "", body: "", ...data },
  });
  return note.updatedAt.toISOString();
}

export async function deleteNote(id: string) {
  await prisma.note.deleteMany({ where: { id } });
}
