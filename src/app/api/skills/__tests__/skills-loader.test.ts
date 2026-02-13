// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dirent } from "node:fs";

const { mockReaddir, mockReadFile, mockMatter } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
  mockMatter: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

vi.mock("gray-matter", () => ({
  default: mockMatter,
}));

function fakeDirent(name: string, isDir: boolean): Dirent {
  return { name, isDirectory: () => isDir } as Dirent;
}

describe("skills-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listSkills", () => {
    it("returns skills parsed from .skills directories", async () => {
      mockReaddir.mockResolvedValue([
        fakeDirent("character-voice", true),
        fakeDirent("meeting-dynamics", true),
      ]);

      mockReadFile.mockResolvedValue("---\nname: test\n---\ncontent");
      mockMatter
        .mockReturnValueOnce({ data: { name: "character-voice", description: "Voice guide" }, content: "body" })
        .mockReturnValueOnce({ data: { name: "meeting-dynamics", description: "Meeting guide" }, content: "body" });

      const { listSkills } = await import("../skills-loader");
      const skills = await listSkills();

      expect(skills).toHaveLength(2);
      expect(skills[0].name).toBe("character-voice");
      expect(skills[1].name).toBe("meeting-dynamics");
    });

    it("returns empty array when .skills directory does not exist", async () => {
      const err = new Error("ENOENT");
      (err as NodeJS.ErrnoException).code = "ENOENT";
      mockReaddir.mockRejectedValue(err);

      const { listSkills } = await import("../skills-loader");
      const skills = await listSkills();

      expect(skills).toEqual([]);
    });

    it("returns empty array on any readdir error", async () => {
      mockReaddir.mockRejectedValue(new Error("permission denied"));

      const { listSkills } = await import("../skills-loader");
      const skills = await listSkills();

      expect(skills).toEqual([]);
    });

    it("skips directories without SKILL.md", async () => {
      mockReaddir.mockResolvedValue([
        fakeDirent("valid-skill", true),
        fakeDirent("no-skill-md", true),
      ]);

      mockReadFile
        .mockResolvedValueOnce("---\nname: valid\n---\ncontent")
        .mockRejectedValueOnce(new Error("ENOENT"));

      mockMatter.mockReturnValueOnce({
        data: { name: "valid-skill", description: "A valid skill" },
        content: "body",
      });

      const { listSkills } = await import("../skills-loader");
      const skills = await listSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("valid-skill");
    });

    it("skips entries with invalid frontmatter", async () => {
      mockReaddir.mockResolvedValue([
        fakeDirent("missing-name", true),
        fakeDirent("valid", true),
      ]);

      mockReadFile.mockResolvedValue("raw");
      mockMatter
        .mockReturnValueOnce({ data: { description: "no name" }, content: "body" })
        .mockReturnValueOnce({ data: { name: "valid", description: "ok" }, content: "body" });

      const { listSkills } = await import("../skills-loader");
      const skills = await listSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("valid");
    });

    it("ignores non-directory entries", async () => {
      mockReaddir.mockResolvedValue([
        fakeDirent("README.md", false),
        fakeDirent("character-voice", true),
      ]);

      mockReadFile.mockResolvedValue("raw");
      mockMatter.mockReturnValue({
        data: { name: "character-voice", description: "desc" },
        content: "body",
      });

      const { listSkills } = await import("../skills-loader");
      const skills = await listSkills();

      expect(skills).toHaveLength(1);
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it("sorts skills alphabetically by name", async () => {
      mockReaddir.mockResolvedValue([
        fakeDirent("zebra", true),
        fakeDirent("alpha", true),
      ]);

      mockReadFile.mockResolvedValue("raw");
      mockMatter
        .mockReturnValueOnce({ data: { name: "zebra", description: "z" }, content: "" })
        .mockReturnValueOnce({ data: { name: "alpha", description: "a" }, content: "" });

      const { listSkills } = await import("../skills-loader");
      const skills = await listSkills();

      expect(skills[0].name).toBe("alpha");
      expect(skills[1].name).toBe("zebra");
    });
  });

  describe("getSkill", () => {
    it("returns skill detail for valid name", async () => {
      mockReadFile.mockResolvedValue("raw");
      mockMatter.mockReturnValue({
        data: { name: "character-voice", description: "Voice guide" },
        content: "\n# Guide\n\nContent here.\n",
      });

      const { getSkill } = await import("../skills-loader");
      const skill = await getSkill("character-voice");

      expect(skill).not.toBeNull();
      expect(skill!.name).toBe("character-voice");
      expect(skill!.description).toBe("Voice guide");
      expect(skill!.content).toBe("# Guide\n\nContent here.");
    });

    it("returns null for non-existent skill", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const { getSkill } = await import("../skills-loader");
      const skill = await getSkill("nonexistent");

      expect(skill).toBeNull();
    });

    it("returns null for path traversal attempts", async () => {
      const { getSkill } = await import("../skills-loader");
      const skill = await getSkill("../secret");

      expect(skill).toBeNull();
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("returns null for names with slashes", async () => {
      const { getSkill } = await import("../skills-loader");
      const skill = await getSkill("foo/bar");

      expect(skill).toBeNull();
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("returns null for names with uppercase", async () => {
      const { getSkill } = await import("../skills-loader");
      const skill = await getSkill("BadName");

      expect(skill).toBeNull();
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("returns null for invalid frontmatter", async () => {
      mockReadFile.mockResolvedValue("raw");
      mockMatter.mockReturnValue({
        data: { name: 42, description: null },
        content: "body",
      });

      const { getSkill } = await import("../skills-loader");
      const skill = await getSkill("some-skill");

      expect(skill).toBeNull();
    });
  });
});
