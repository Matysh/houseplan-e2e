// #1120 changes public panel chrome without introducing a new DOM hook.
// Source snapshots may carry beta.3 until the candidate bump: an old-version
// skip is never new-contract proof. The exact beta.4 candidate must run it.
import { installedRecord } from './contract.mjs';
import { compareTags } from '../../scripts/tags.mjs';
export function hasOverflowPanelHeader(version = installedRecord()?.version) {
  return !version || compareTags(`v${version}`, 'v1.83.0-beta.4') >= 0;
}
