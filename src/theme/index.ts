import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {useColorScheme} from 'react-native';
import {type AppColors, darkColors, lightColors} from './colors';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<'dark' | 'light' | null>(null);

  const scheme = override ?? systemScheme ?? 'dark';
  const isDark = scheme === 'dark';

  const toggleTheme = useCallback(() => {
    setOverride(prev => {
      if (prev === null) return isDark ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [isDark]);

  const value = useMemo(
    () => ({colors: isDark ? darkColors : lightColors, isDark, toggleTheme}),
    [isDark, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
