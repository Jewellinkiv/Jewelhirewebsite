export function readinessExitCode({ failures = [], blockers = [] } = {}) {
  return failures.length > 0 || blockers.length > 0 ? 1 : 0;
}
