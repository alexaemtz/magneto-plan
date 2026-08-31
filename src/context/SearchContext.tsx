'use client';

import { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextValue>({ query: '', setQuery: () => {} });

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);

  // Reset the search query whenever the user navigates to a different page
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setQuery('');
  }

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}
