import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export interface SkillSummary {
  name: string;
  description: string;
}

export interface SkillDetail {
  name: string;
  description: string;
  content: string;
}

const SKILLS_DIR = path.join(process.cwd(), ".skills");

export async function listSkills(): Promise<SkillSummary[]> {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const skills: SkillSummary[] = [];

  for (const dir of dirs) {
    const filePath = path.join(SKILLS_DIR, dir.name, "SKILL.md");
    try {
      const raw = await readFile(filePath, "utf-8");
      const { data } = matter(raw);
      skills.push({
        name: data.name as string,
        description: data.description as string,
      });
    } catch {
      // Skip directories without a valid SKILL.md
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export async function getSkill(name: string): Promise<SkillDetail | null> {
  const filePath = path.join(SKILLS_DIR, name, "SKILL.md");

  try {
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = matter(raw);

    return {
      name: data.name as string,
      description: data.description as string,
      content: content.trim(),
    };
  } catch {
    return null;
  }
}
