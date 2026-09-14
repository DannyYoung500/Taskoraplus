import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const supabaseAdmin = await adminClient();
  const { data: role } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (role) return;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  const telegramId = (profile as { telegram_id?: number | string | null } | null)?.telegram_id;
  if (isOwnerTelegramId(telegramId ?? null)) return;
  throw new Error("Owner/admin authorization required.");
}

export type OwnerDocument = {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string;
  category: string;
  isPublic: boolean;
  createdAt: string;
};

function mapDoc(row: Record<string, unknown>): OwnerDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    fileName: String(row.file_name),
    filePath: String(row.file_path),
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    mimeType: String(row.mime_type ?? "application/pdf"),
    category: String(row.category ?? "general"),
    isPublic: Boolean(row.is_public),
    createdAt: String(row.created_at),
  };
}

export const listOwnerDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const supabaseAdmin = await adminClient();
    const { data, error } = await (supabaseAdmin as any)
      .from("owner_documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map(mapDoc);
  });

/** Create a short-lived signed upload URL for a PDF (max 25MB). */
export const createOwnerDocUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileName: string; mimeType: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const mime = data.mimeType || "application/pdf";
    if (!mime.includes("pdf") && !mime.startsWith("image/")) {
      throw new Error("Only PDF and images are allowed.");
    }
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const path = `${context.userId}/${Date.now()}_${safe}`;
    const supabaseAdmin = await adminClient();
    const { data: signed, error } = await supabaseAdmin.storage
      .from("owner-docs")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL.");
    return {
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
    };
  });

export const registerOwnerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      title: string;
      description?: string;
      fileName: string;
      filePath: string;
      fileSize?: number;
      mimeType?: string;
      category?: string;
      isPublic?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const supabaseAdmin = await adminClient();
    const { data: row, error } = await (supabaseAdmin as any)
      .from("owner_documents")
      .insert({
        title: data.title.trim() || data.fileName,
        description: data.description?.trim() || null,
        file_name: data.fileName,
        file_path: data.filePath,
        file_size: data.fileSize ?? null,
        mime_type: data.mimeType ?? "application/pdf",
        category: data.category ?? "general",
        is_public: Boolean(data.isPublic),
        uploaded_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapDoc(row as Record<string, unknown>);
  });

export const getOwnerDocumentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const supabaseAdmin = await adminClient();
    const { data: row, error } = await (supabaseAdmin as any)
      .from("owner_documents")
      .select("file_path,file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error(error?.message ?? "Document not found.");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("owner-docs")
      .createSignedUrl(String(row.file_path), 3600);
    if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "Could not sign download URL.");
    return { url: signed.signedUrl, fileName: String(row.file_name) };
  });

export const deleteOwnerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const supabaseAdmin = await adminClient();
    const { data: row } = await (supabaseAdmin as any)
      .from("owner_documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.file_path) {
      await supabaseAdmin.storage.from("owner-docs").remove([String(row.file_path)]);
    }
    const { error } = await (supabaseAdmin as any).from("owner_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
