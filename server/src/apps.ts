// Links to other things running on the Pi, shown on the Apps tab.
import type { DatabaseSync } from "node:sqlite";
import type { App, AppInput } from "../../shared/types.ts";
import { BadRequest } from "./errors.ts";

/** Check and tidy what the browser sent. Only http(s) links are allowed. */
export function validateApp(body: Record<string, unknown>): AppInput {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name || name.length > 60) throw new BadRequest("Name is required (max 60 characters)");
  if (description.length > 200) throw new BadRequest("Description is too long (max 200 characters)");
  // {host} is filled in by the browser; check the rest as if it were a hostname.
  let parsed: URL;
  try {
    parsed = new URL(url.replaceAll("{host}", "host"));
  } catch {
    throw new BadRequest("URL is not valid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BadRequest("URL must start with http:// or https://");
  }
  return { name, url, description };
}

export class Apps {
  private db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  list(): App[] {
    return this.db.prepare("SELECT id, name, url, description FROM apps ORDER BY name COLLATE NOCASE").all() as App[];
  }

  create(input: AppInput): App {
    const r = this.db
      .prepare("INSERT INTO apps (name, url, description) VALUES (:name, :url, :description)")
      .run(input);
    return { id: Number(r.lastInsertRowid), ...input };
  }

  /** false if there was no app with that id. */
  update(id: number, input: AppInput): boolean {
    const r = this.db
      .prepare("UPDATE apps SET name = :name, url = :url, description = :description WHERE id = :id")
      .run({ id, ...input });
    return r.changes > 0;
  }

  remove(id: number): boolean {
    return this.db.prepare("DELETE FROM apps WHERE id = ?").run(id).changes > 0;
  }
}
