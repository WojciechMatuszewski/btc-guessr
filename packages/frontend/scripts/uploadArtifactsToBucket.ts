import fs from "fs";
import { globSync } from "glob";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { outputsToEnv } from "./outputsToEnv";
import mime from "mime-types";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

outputsToEnv();

const client = new S3Client({});

const WEBSITE_BUCKET_NAME = process.env["WEBSITE_BUCKET_NAME"];
if (!WEBSITE_BUCKET_NAME) {
  throw new Error("Cannot upload the assets. The bucket name is missing");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
if (!fs.existsSync(join(__dirname, "../dist"))) {
  throw new Error(
    "Frontend artifacts not found. Did you forget to build the app?"
  );
}

const pathToDist = join(__dirname, "../dist/");
const files = globSync(join(pathToDist, "/**"), { nodir: true });

const uploads = files.map((filePath) => {
  const keyPath = filePath.replace(pathToDist, "");
  const mimeType = mime.lookup(keyPath);

  return client.send(
    new PutObjectCommand({
      Bucket: WEBSITE_BUCKET_NAME,
      Key: keyPath,
      Body: fs.readFileSync(filePath, { encoding: "utf-8" }),
      ContentType: mimeType ? mimeType : undefined,
    })
  );
});

void Promise.all(uploads).then(() => {
  console.log("---------");
  console.log(process.env["WEBSITE_ADDRESS"]);
  console.log("---------");
});
