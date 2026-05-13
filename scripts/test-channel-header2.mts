import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ cache: undefined, generate_session_locally: true });
const channel = await yt.getChannel("UC0SesdSOSgLERIZSj_FC8wQ");
const header = (channel as any)?.header ?? {};

// PageHeader has content — drill into it
const content = header?.content ?? {};
console.log("content type:", content?.type ?? content?.constructor?.name);
console.log("content keys:", Object.keys(content).join(", "));

// Recursively find subscriber-related fields
function findSubscriberFields(obj: any, path = "", depth = 0): void {
  if (depth > 6 || !obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const fullPath = `${path}.${key}`;
    if (typeof val === "string" && (val.toLowerCase().includes("subscrib") || /\d+[KMB]?\s*(subscriber|sub)/i.test(val))) {
      console.log(`  FOUND: ${fullPath} = "${val}"`);
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      findSubscriberFields(val, fullPath, depth + 1);
    } else if (Array.isArray(val)) {
      for (let i = 0; i < Math.min(val.length, 5); i++) {
        findSubscriberFields(val[i], `${fullPath}[${i}]`, depth + 1);
      }
    }
  }
}

findSubscriberFields(content, "content");

// Also check metadata
const meta = (channel as any)?.metadata ?? {};
console.log("\nMeta keys:", Object.keys(meta).join(", "));
findSubscriberFields(meta, "meta");
