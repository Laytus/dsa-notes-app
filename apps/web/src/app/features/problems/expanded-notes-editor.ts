export type ExpandedNotesEditorMode = 'edit' | 'preview';

export interface ExpandedNotesEditor {
  readonly problemId: string;
  readonly originalNotes: string;
  readonly draft: string;
  readonly mode: ExpandedNotesEditorMode;
}

export function notesEditorIsDirty(editor: ExpandedNotesEditor): boolean {
  return editor.draft !== editor.originalNotes;
}
