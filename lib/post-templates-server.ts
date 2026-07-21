import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostTemplate, ContentType } from "./post-templates";

/**
 * Resolve which template to render a post with: the requested `templateId`
 * if given and found, otherwise the content type's default template.
 */
export async function resolveTemplate(
  supabase: SupabaseClient,
  contentType: ContentType,
  templateId?: string | null
): Promise<PostTemplate | null> {
  if (templateId) {
    const { data } = await supabase
      .from("post_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (data) return data as PostTemplate;
  }

  const { data } = await supabase
    .from("post_templates")
    .select("*")
    .eq("content_type", contentType)
    .eq("is_default", true)
    .maybeSingle();

  return (data as PostTemplate) ?? null;
}
