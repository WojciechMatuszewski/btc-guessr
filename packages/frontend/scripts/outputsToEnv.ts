import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { parse, record, string } from "valibot";
import { constantCase } from "change-case";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUTPUTS_FILE_PATH = join(__dirname, "../../..", ".stack-outputs.json");

const OutputsFileSchema = record(record(string()));

export function outputsToEnv() {
  if (!existsSync(OUTPUTS_FILE_PATH)) {
    throw new Error(
      "Outputs file not found. Did you forget to deploy the backend?"
    );
  }

  const outputsFileContents: unknown = JSON.parse(
    readFileSync(OUTPUTS_FILE_PATH, {
      encoding: "utf8",
    })
  );
  const parsedOutputsFile = parse(OutputsFileSchema, outputsFileContents);

  const outputs = Object.values(parsedOutputsFile)[0]!;
  for (const [key, value] of Object.entries(outputs)) {
    process.env[`VITE_${constantCase(key)}`] = value;
    process.env[`${constantCase(key)}`] = value;
  }
}
