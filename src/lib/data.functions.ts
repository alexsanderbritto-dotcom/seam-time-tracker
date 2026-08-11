import { createServerFn } from "@tanstack/react-start";

export type Filter = { op: "eq" | "neq" | "gte" | "lte"; col: string; value: unknown };

export type SelectPayload = {
  token: string;
  table: string;
  columns: string;
  filters: Filter[];
  order?: { col: string; asc: boolean } | undefined;
  limit?: number | undefined;
  mode: "many" | "single" | "maybeSingle";
};

export type MutatePayload = {
  token: string;
  table: string;
  action: "insert" | "update" | "delete" | "upsert";
  values?: unknown;
  filters: Filter[];
  onConflict?: string | undefined;
  returning: "none" | "single";
};

export const dbSelect = createServerFn({ method: "POST" })
  .inputValidator((data: SelectPayload) => data)
  .handler(async ({ data }) => {
    const { runSelect } = await import("@/lib/data-gateway.server");
    return runSelect(data);
  });

export const dbMutate = createServerFn({ method: "POST" })
  .inputValidator((data: MutatePayload) => data)
  .handler(async ({ data }) => {
    const { runMutate } = await import("@/lib/data-gateway.server");
    return runMutate(data);
  });

export const storageUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; path: string; contentType: string; base64: string }) => data)
  .handler(async ({ data }) => {
    const { runUpload } = await import("@/lib/data-gateway.server");
    return runUpload(data);
  });

export const storageSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; path: string }) => data)
  .handler(async ({ data }) => {
    const { runSignedUrl } = await import("@/lib/data-gateway.server");
    return runSignedUrl(data);
  });
