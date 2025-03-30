import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

var execAsync = promisify(exec);

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

export type MarkdownResult = {
  path: string;
  text: string;
};

export class Markdownify {
  private static async _markitdown(
    filePath: string,
    projectRoot: string,
    uvPath: string,
  ): Promise<string> {
    var venvPath = path.join(projectRoot, ".venv");
    var markitdownPath = path.join(venvPath, "bin", "markitdown");

    if (!fs.existsSync(markitdownPath)) {
      throw new Error("markitdown executable not found");
    }

    var { stdout, stderr } = await execAsync(
      `${uvPath} run ${markitdownPath} "${filePath}"`,
    );

    if (stderr) {
      throw new Error(`Error executing command: ${stderr}`);
    }

    return stdout;
  }

  private static async saveToTempFile(content: string): Promise<string> {
    var tempOutputPath = path.join(
      os.tmpdir(),
      `markdown_output_${Date.now()}.md`,
    );
    fs.writeFileSync(tempOutputPath, content);
    return tempOutputPath;
  }

  static async toMarkdown({
    filePath,
    url,
    projectRoot = path.resolve(__dirname, ".."),
    uvPath = "~/.local/bin/uv",
  }: {
    filePath?: string;
    url?: string;
    projectRoot?: string;
    uvPath?: string;
  }): Promise<MarkdownResult> {
    try {
      let inputPath: string;
      let isTemporary = false;

      if (url) {
        var response = await fetch(url);
        var content = await response.text();
        inputPath = await this.saveToTempFile(content);
        isTemporary = true;
      } else if (filePath) {
        inputPath = filePath;
      } else {
        throw new Error("Either filePath or url must be provided");
      }

      var text = await this._markitdown(inputPath, projectRoot, uvPath);
      var outputPath = await this.saveToTempFile(text);

      if (isTemporary) {
        fs.unlinkSync(inputPath);
      }

      return { path: outputPath, text };
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`Error processing to Markdown: ${e.message}`);
      } else {
        throw new Error("Error processing to Markdown: Unknown error occurred");
      }
    }
  }

  static async get({
    filePath,
  }: {
    filePath: string;
  }): Promise<MarkdownResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist");
    }

    var text = await fs.promises.readFile(filePath, "utf-8");

    return {
      path: filePath,
      text: text,
    };
  }
}
