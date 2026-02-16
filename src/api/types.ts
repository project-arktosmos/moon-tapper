/** Note entity from the database */
export interface Note {
	id: number;
	title: string;
	content: string;
	created_at: string;
	updated_at: string;
}

/** Input for creating a new note */
export interface CreateNoteInput {
	title: string;
	content: string;
}

/** Input for updating a note */
export interface UpdateNoteInput {
	id: number;
	title: string;
	content: string;
}
