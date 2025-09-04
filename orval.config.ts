import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: 'http://localhost:3000/docs-json', // <- ggf. 3000 nehmen, wenn deine API dort läuft
    output: {
      target: 'packages/api-types/src/gen/index.ts',
      client: 'react-query',      // React Query Hooks generieren
      httpClient: 'fetch',        // Fetch statt Axios verwenden
      clean: true,
      override: {
        // Eigener Fetch/Mutator: Pfad ist RELATIV ZUM REPO-ROOT (Config-Datei),
        // und 'name' ist der exportierte Funktionsname in fetcher.ts
        mutator: {
            path: './packages/api-types/src/fetcher.ts',
            name: 'customFetch',
        },
      },
    },
  },
});
