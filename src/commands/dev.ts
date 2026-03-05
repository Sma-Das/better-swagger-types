import chokidar, { type FSWatcher } from 'chokidar';

import { generateProject } from '../core/generate-project';
import type { Logger, WatchCommandOptions } from '../types/internal';

export async function runDev(options: WatchCommandOptions, logger: Logger): Promise<void> {
  let currentWatchPaths = new Set<string>();
  let timeout: NodeJS.Timeout | undefined;
  let watcher: FSWatcher | undefined;
  let running = false;

  const triggerGenerate = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const summary = await generateProject(options, logger);
      logger.info(
        `Processed ${summary.schemaCount} schema${summary.schemaCount === 1 ? '' : 's'}, wrote ${summary.writtenCount}/${summary.fileCount} files in ${summary.elapsedMs}ms.`
      );
      const nextWatchPaths = new Set<string>([summary.loadedConfig.configPath]);
      for (const schema of summary.parsedSchemas) {
        if (schema.source.sourceKind !== 'url') {
          nextWatchPaths.add(schema.source.source);
        }
      }

      if (!watcher) {
        watcher = chokidar.watch([...nextWatchPaths], { ignoreInitial: true });
        watcher.on('all', (_eventName: string, changedPath: string) => {
          logger.info(`Change detected: ${changedPath}`);
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(() => {
            void triggerGenerate();
          }, 150);
        });
      } else {
        const stalePaths = [...currentWatchPaths].filter((watchPath) => !nextWatchPaths.has(watchPath));
        if (stalePaths.length > 0) {
          await watcher.unwatch(stalePaths);
        }
        const addedPaths = [...nextWatchPaths].filter((watchPath) => !currentWatchPaths.has(watchPath));
        if (addedPaths.length > 0) {
          await watcher.add(addedPaths);
        }
      }

      currentWatchPaths = nextWatchPaths;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(message);
    } finally {
      running = false;
    }
  };

  await triggerGenerate();
  logger.info('Watching for changes. Press Ctrl+C to stop.');

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      await watcher?.close();
      resolve();
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());
  });
}
