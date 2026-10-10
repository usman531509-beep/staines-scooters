// TanStack Router exposes boundary errors as `unknown` by default and lets the
// hosting framework specialise them. Nothing in this stack does, so we state the
// contract our error components already rely on: the caught value is an Error.
import '@tanstack/router-core';

declare module '@tanstack/router-core' {
  interface ErrorBoundaryTypes {
    error: Error;
  }
}
