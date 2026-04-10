import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface GuideMetadata {
  title: string;
  description: string;
  author?: string;
  updatedAt?: string;
  category: string;
  order?: number;
}

export interface GuideFile {
  slug: string;
  metadata: GuideMetadata;
  content: string;
}

export function getGuidesByCategory(category: string): GuideFile[] {
  const dir = path.join(CONTENT_DIR, "guides", category);

  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: file.replace(/\.mdx$/, ""),
        metadata: data as GuideMetadata,
        content,
      };
    })
    .sort((a, b) => (a.metadata.order ?? 99) - (b.metadata.order ?? 99));
}

export function getGuide(category: string, slug: string): GuideFile | null {
  const filePath = path.join(CONTENT_DIR, "guides", category, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug,
    metadata: data as GuideMetadata,
    content,
  };
}
