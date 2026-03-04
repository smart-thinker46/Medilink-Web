import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebThemeProvider } from '@/components/WebThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout({children}) {
  return (
    <QueryClientProvider client={queryClient}>
      <WebThemeProvider>{children}</WebThemeProvider>
    </QueryClientProvider>
  );
}
