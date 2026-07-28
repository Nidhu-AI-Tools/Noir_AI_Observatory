import type { CurationConfig, CurationNote } from "@noir/core";

export interface CurationConfigStore {
  read(): Promise<CurationConfig>;
}

export interface CurationNoteStore {
  read(date: string): Promise<CurationNote | undefined>;
  readAll(): Promise<CurationNote[]>;
  write(note: CurationNote, options?: { overwrite?: boolean }): Promise<void>;
}
