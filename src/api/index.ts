// Generic database API - TypeScript assembles queries, Rust executes them
export { db } from './db';
export type { QueryResult, ExecuteResult } from './db';

// Example Notes API built on top of the generic db interface
export { notesApi } from './notes';
export type { Note, CreateNoteInput, UpdateNoteInput } from './types';
