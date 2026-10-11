import { createRouter } from "@tanstack/react-router";
import { MutationCache, QueryClient, type InvalidateOptions, type InvalidateQueryFilters } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

// Sections cache their data for 30s, and many lists share records under
// different keys (a category appears on the categories page, the product
// form and the till). So whenever any data changes, everything cached is
// treated as out of date: the keys a change names refetch straight away and
// every other section reloads fresh the next time it opens.
class AppQueryClient extends QueryClient {
  override invalidateQueries(filters?: InvalidateQueryFilters, options?: InvalidateOptions) {
    if (filters) void super.invalidateQueries(undefined, { ...options, refetchType: "none" } as InvalidateOptions);
    return super.invalidateQueries(filters, options);
  }
}

export const getRouter = () => {
  const queryClient: QueryClient = new AppQueryClient({
    // Any successful save also refreshes what's on screen now.
    mutationCache: new MutationCache({ onSuccess: () => void queryClient.invalidateQueries() }),
    defaultOptions: {
      queries: {
        // Revisiting a section shows cached data instantly instead of a loading
        // state; it refreshes in the background once the data is 30s old.
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Load the next page while the pointer is on a link, so navigation feels instant.
    defaultPreload: "intent",
  });

  return router;
};
