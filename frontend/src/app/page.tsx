import { readFile } from "node:fs/promises";
import path from "node:path";
import NdaCreator from "@/components/NdaCreator";

export default async function Home() {
  // Standard terms live in the repo-level templates directory (single source of truth).
  const standardTerms = await readFile(
    path.join(process.cwd(), "..", "templates", "Mutual-NDA.md"),
    "utf8",
  );
  return <NdaCreator standardTerms={standardTerms} />;
}
