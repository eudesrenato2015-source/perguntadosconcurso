import { openDB, DBSchema } from "idb";
import type { Attempt, SRItem, Notebook, Note } from "../types";

interface RotaDB extends DBSchema {
  attempts: { key: string; value: Attempt; indexes: { "by-question": string; "by-createdAt": number } };
  sr: { key: string; value: SRItem; indexes: { "by-next": number } };
  notebooks: { key: string; value: Notebook };
  notes: { key: string; value: Note; indexes: { "by-question": string; "by-updatedAt": number } };
  settings: { key: string; value: { key: string; value: unknown } };
}

export const dbPromise = openDB<RotaDB>("rota190", 2, {
  upgrade(db, oldVersion){
    if (oldVersion < 1){
      const attempts = db.createObjectStore("attempts", { keyPath: "id" });
      attempts.createIndex("by-question", "questionId");
      attempts.createIndex("by-createdAt", "createdAt");
      db.createObjectStore("settings", { keyPath: "key" });
    }
    if (oldVersion < 2){
      const sr = db.createObjectStore("sr", { keyPath: "questionId" });
      sr.createIndex("by-next", "nextReviewAt");
      db.createObjectStore("notebooks", { keyPath: "id" });
      const notes = db.createObjectStore("notes", { keyPath: "id" });
      notes.createIndex("by-question", "questionId");
      notes.createIndex("by-updatedAt", "updatedAt");
    }
  }
});

export async function putAttempt(a: Attempt){ const db = await dbPromise; await db.put("attempts", a); }
export async function listAttempts(limit = 200){
  const db = await dbPromise;
  const all = await db.getAllFromIndex("attempts", "by-createdAt");
  return all.slice(-limit).reverse();
}
export async function getSR(questionId: string){ const db = await dbPromise; return db.get("sr", questionId); }
export async function putSR(item: SRItem){ const db = await dbPromise; await db.put("sr", item); }
export async function listSR(){ const db = await dbPromise; return db.getAll("sr"); }
export async function dueSR(now = Date.now(), limit = 50){
  const db = await dbPromise;
  const all = await db.getAllFromIndex("sr", "by-next");
  return all.filter(i => i.nextReviewAt <= now).slice(0, limit);
}
export async function putNote(note: Note){ const db = await dbPromise; await db.put("notes", note); }
export async function getNoteByQuestion(questionId: string){
  const db = await dbPromise;
  const notes = await db.getAllFromIndex("notes", "by-question", questionId);
  return notes.sort((a,b)=>b.updatedAt-a.updatedAt)[0];
}
