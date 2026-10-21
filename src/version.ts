import pkg from '../package.json';

/** Single source of truth for the UI version badge (synced with package.json). */
export const APP_VERSION: string = pkg.version;
