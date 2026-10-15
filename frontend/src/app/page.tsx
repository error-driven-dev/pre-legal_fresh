import { readFile } from "node:fs/promises";
import path from "node:path";
import DocumentCreator from "@/components/DocumentCreator";

export default async function Home() {
  // Standard terms live in the repo-level templates directory (single source of truth).
  const ndaTerms = await readFile(
    path.join(process.cwd(), "..", "templates", "Mutual-NDA.md"),
    "utf8",
  );
  return <DocumentCreator ndaTerms={ndaTerms} />;
}
