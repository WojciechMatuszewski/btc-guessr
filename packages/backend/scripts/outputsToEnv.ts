import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse, record, string } from "valibot";
import { constantCase } from "change-case";

const OUTPUTS_FILE_PATH = join(__dirname, "..", ".stack-outputs.json");

const OutputsFileSchema = record(record(string()));

export function outputsToEnv() {
  if (!existsSync(OUTPUTS_FILE_PATH)) {
    console.warn("Outputs file not found. The tests might fail");
    return;
  }

  const outputsFileContents: unknown = JSON.parse(
    readFileSync(OUTPUTS_FILE_PATH, {
      encoding: "utf8",
    })
  );
  const parsedOutputsFile = parse(OutputsFileSchema, outputsFileContents);

  const outputs = Object.values(parsedOutputsFile)[0]!;
  for (const [key, value] of Object.entries(outputs)) {
    process.env[constantCase(key)] = value;
  }
}
