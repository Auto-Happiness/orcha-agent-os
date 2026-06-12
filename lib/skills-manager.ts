import fs from "fs";
import path from "path";

export type SkillType = "TEXT_TO_SQL" | "SCHEMA_EXPLORATION" | "CHART_GENERATION" | "GENERAL_CHAT";

export class SkillsManager {
  static getSkillInstructions(type: SkillType, variables: Record<string, string> = {}): string {
    const filenameMap: Record<SkillType, string> = {
      TEXT_TO_SQL: "text_to_sql.md",
      SCHEMA_EXPLORATION: "schema_exploration.md",
      CHART_GENERATION: "chart_generation.md",
      GENERAL_CHAT: "general_chat.md",
    };

    const filename = filenameMap[type];
    const filepath = path.join(process.cwd(), "lib/skills", filename);
    
    try {
      let content = fs.readFileSync(filepath, "utf8");
      
      // Interpolate any variables in the markdown template (e.g. {MAX_ROWS})
      for (const [key, val] of Object.entries(variables)) {
        content = content.replace(new RegExp(`{${key}}`, "g"), val);
      }
      
      return content;
    } catch (err) {
      console.error(`[SkillsManager] Failed to load skill file: ${filepath}`, err);
      return `### TASK\nPerform the requested database actions.`;
    }
  }
}
