import type { FileRef } from '@formgl/shared';
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { files, type FileRow } from '../db/schema';
import { fixFilename, newId, safeName } from '../common/text';
import { StorageService } from '../storage/storage.service';
import { resolveMime } from './upload';

export const fileUrl = (key: string) => `/api/files/${key}`;

export function toFileRef(row: Pick<FileRow, 'id' | 'key' | 'name' | 'size' | 'mime'>): FileRef {
  return { id: row.id, key: row.key, name: row.name, size: row.size, mime: row.mime, url: fileUrl(row.key) };
}

@Injectable()
export class FilesService {
  constructor(
    private readonly dbs: DbService,
    private readonly storage: StorageService,
  ) {}

  /** Stores an uploaded file in S3 and records it. `prefix` is e.g. `assets` or `forms/<formId>/<fieldId>`. */
  async store(
    file: Express.Multer.File,
    prefix: string,
    extra: { formId?: string | null; fieldId?: string | null; sessionId?: string | null; mime?: string } = {},
  ): Promise<FileRef> {
    const name = fixFilename(file.originalname).slice(0, 255);
    const id = newId();
    const key = `${prefix}/${id}/${safeName(name)}`;
    const mime = extra.mime ?? resolveMime(file.mimetype, name);
    await this.storage.put(key, file.buffer, mime);
    const [row] = await this.dbs.db
      .insert(files)
      .values({
        id,
        key,
        name,
        mime,
        size: file.size,
        formId: extra.formId ?? null,
        fieldId: extra.fieldId ?? null,
        sessionId: extra.sessionId ?? null,
      })
      .returning();
    return toFileRef(row);
  }
}
