import { generateProject } from '../core/generate-project';
import type { GenerateCommandOptions, Logger } from '../types/internal';

export async function runGenerate(options: GenerateCommandOptions, logger: Logger): Promise<void> {
  const summary = await generateProject(options, logger);
  logger.info(
    `Processed ${summary.schemaCount} schema${summary.schemaCount === 1 ? '' : 's'}, wrote ${summary.writtenCount}/${summary.fileCount} files in ${summary.elapsedMs}ms.`
  );
  if (summary.staleDeleted > 0) {
    logger.info(`Removed ${summary.staleDeleted} stale files.`);
  }
}
