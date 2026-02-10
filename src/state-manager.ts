import fs from 'node:fs';
import path from 'node:path';
import type { AppState } from './types.js';
import type { Logger } from './logger.js';

const STATE_FILE = 'state.json';

export class StateManager {
  private filePath: string;
  private logger: Logger;

  constructor(dataDir: string, logger: Logger) {
    this.logger = logger;
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, STATE_FILE);
  }

  load(): AppState | null {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.logger.info('No state file found, will initialize on first run');
        return null;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(raw) as AppState;
      this.logger.debug('State loaded', state);
      return state;
    } catch (err) {
      this.logger.warn('Failed to read state file, resetting', err);
      return null;
    }
  }

  save(state: AppState): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
      this.logger.debug('State saved', state);
    } catch (err) {
      this.logger.error('Failed to save state file', err);
    }
  }
}
