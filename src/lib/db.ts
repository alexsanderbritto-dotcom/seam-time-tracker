import { dbMutate, dbSelect, storageSignedUrl, storageUpload } from "@/lib/data.functions";
import { readSession } from "@/lib/marcador-session";
import type { Filter } from "@/lib/data.functions";

type Result<T> = { data: T; error: { message: string } | null };

function token() {
  return readSession()?.token ?? "";
}

class SelectBuilder<T> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private _order: { col: string; asc: boolean } | undefined;
  private _limit: number | undefined;

  constructor(
    private table: string,
    private columns: string,
  ) {}

  eq(col: string, value: unknown) {
    this.filters.push({ op: "eq", col, value });
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push({ op: "neq", col, value });
    return this;
  }
  gte(col: string, value: unknown) {
    this.filters.push({ op: "gte", col, value });
    return this;
  }
  lte(col: string, value: unknown) {
    this.filters.push({ op: "lte", col, value });
    return this;
  }
  in(col: string, value: unknown[]) {
    this.filters.push({ op: "in", col, value });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }

  private run(mode: "many" | "single" | "maybeSingle") {
    return dbSelect({
      data: {
        token: token(),
        table: this.table,
        columns: this.columns,
        filters: this.filters,
        order: this._order,
        limit: this._limit,
        mode,
      },
    }) as Promise<Result<T>>;
  }

  single() {
    return this.run("single");
  }
  maybeSingle() {
    return this.run("maybeSingle");
  }
  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run("many").then(onfulfilled, onrejected);
  }
}

class MutateBuilder implements PromiseLike<Result<unknown>> {
  private filters: Filter[] = [];
  private returning: "none" | "single" = "none";

  constructor(
    private table: string,
    private action: "insert" | "update" | "delete" | "upsert",
    private values?: unknown,
    private onConflict?: string,
  ) {}

  eq(col: string, value: unknown) {
    this.filters.push({ op: "eq", col, value });
    return this;
  }
  in(col: string, value: unknown[]) {
    this.filters.push({ op: "in", col, value });
    return this;
  }
  select() {
    return {
      single: () => {
        this.returning = "single";
        return this.run();
      },
    };
  }
  private run() {
    return dbMutate({
      data: {
        token: token(),
        table: this.table,
        action: this.action,
        values: this.values,
        filters: this.filters,
        onConflict: this.onConflict,
        returning: this.returning,
      },
    }) as Promise<Result<unknown>>;
  }
  then<R1 = Result<unknown>, R2 = never>(
    onfulfilled?: ((value: Result<unknown>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Client-side data access. Every call goes through authenticated server
 * functions that validate the marcador session before touching the database.
 */
export const db = {
  from(table: string) {
    return {
      select: <T = unknown>(columns = "*") => new SelectBuilder<T>(table, columns),
      insert: (values: unknown) => new MutateBuilder(table, "insert", values),
      upsert: (values: unknown, opts?: { onConflict?: string }) =>
        new MutateBuilder(table, "upsert", values, opts?.onConflict),
      update: (values: unknown) => new MutateBuilder(table, "update", values),
      delete: () => new MutateBuilder(table, "delete"),
    };
  },
  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, file: File | Blob) {
          const base64 = await fileToBase64(file);
          return storageUpload({
            data: {
              token: token(),
              path,
              contentType: (file as File).type || "application/octet-stream",
              base64,
            },
          });
        },
        async createSignedUrl(path: string, _expires: number) {
          const res = await storageSignedUrl({ data: { token: token(), path } });
          return { data: res.url ? { signedUrl: res.url } : null, error: res.error };
        },
      };
    },
  },
};
