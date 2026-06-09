import {
  classifyTickets,
  parseInputPathArg,
  sanitizedCollection,
  type TicketCollection,
  writeTicketProcessingFailureRun
} from "./ticket-source.js";
import { readJsonFile } from "../../../shared/core/fs.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const collection = await readJsonFile<TicketCollection>(parseInputPathArg(args));
  const classifications = classifyTickets(collection.tickets);

  console.log(
    JSON.stringify(
      {
        source: collection.source,
        classifiedAt: new Date().toISOString(),
        count: classifications.length,
        jira: collection.jira,
        tickets: classifications,
        sourceSnapshot: sanitizedCollection(collection)
      },
      null,
      2
    )
  );
}

main().catch(async (error: unknown) => {
  const outputDir = await writeTicketProcessingFailureRun(
    "ticket-classify",
    error
  );
  console.error(`${error instanceof Error ? error.message : String(error)}\nFailure report: ${outputDir}`);
  process.exitCode = 1;
});
