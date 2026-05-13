import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ cache: undefined, generate_session_locally: true });
const channel = await yt.getChannel("UC0SesdSOSgLERIZSj_FC8wQ");
const header = (channel as any)?.header ?? {};

console.log("Header type:", header?.type ?? header?.constructor?.name);
console.log("Header keys:", Object.keys(header).join(", "));

// Check for subscriber-related fields
for (const key of Object.keys(header)) {
  const val = (header as any)[key];
  if (typeof val === "object" && val !== null) {
    const str = JSON.stringify(val).slice(0, 200);
    if (str.toLowerCase().includes("subscrib")) {
      console.log(`  header.${key}:`, str);
    }
  } else if (typeof val === "string" && val.toLowerCase().includes("subscrib")) {
    console.log(`  header.${key}:`, val);
  }
}

// Directly probe known fields
console.log("\nDirect probes:");
console.log("  subscriber_count:", (header as any)?.subscriber_count);
console.log("  subscribers:", JSON.stringify((header as any)?.subscribers)?.slice(0, 200));
console.log("  subscribers_count_text:", (header as any)?.subscribers_count_text);
console.log("  subscriber_count_text:", (header as any)?.subscriber_count_text);
