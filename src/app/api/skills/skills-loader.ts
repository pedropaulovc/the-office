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

const VALID_SKILL_NAME = /^[a-z0-9-]+$/;

export async function listSkills(): Promise<SkillSummary[]> {
  let entries;
  try {
    entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = entries.filter((e) => e.isDirectory());
  const skills: SkillSummary[] = [];

  for (const dir of dirs) {
    const filePath = path.join(SKILLS_DIR, dir.name, "SKILL.md");
    try {
      const raw = await readFile(filePath, "utf-8");
      const { data } = matter(raw);
      if (typeof data.name !== "string" || typeof data.description !== "string") {
        continue;
      }
      skills.push({ name: data.name, description: data.description });
    } catch {
      // Skip directories without a valid SKILL.md
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export async function getSkill(name: string): Promise<SkillDetail | null> {
  if (!VALID_SKILL_NAME.test(name)) {
    return null;
  }

  const skillDir = path.resolve(SKILLS_DIR, name);
  if (!skillDir.startsWith(path.resolve(SKILLS_DIR) + path.sep)) {
    return null;
  }

  const filePath = path.join(skillDir, "SKILL.md");

  try {
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = matter(raw);

    if (typeof data.name !== "string" || typeof data.description !== "string") {
      return null;
    }

    return {
      name: data.name,
      description: data.description,
      content: content.trim(),
    };
  } catch {
    return null;
  }
}
