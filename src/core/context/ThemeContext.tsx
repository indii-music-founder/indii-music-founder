import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "@/core/store";
import { useShallow } from "zustand/react/shallow";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

interface ThemeProviderState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: "dark" | "light"; // Actual applied theme
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    resolvedTheme: "dark",
};

const ThemeContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = "system",
    ...props
}: ThemeProviderProps) {
    // Connect to global store for persistence
    const { userProfile, updateTheme } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        updateTheme: state.setTheme // Alias for clarity
    })));

    // Track system theme preference via media query
    const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() =>
        typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    );

    // Get current preference from profile or default
    const theme = (userProfile?.preferences?.theme as Theme) || defaultTheme;

    // Derive resolved theme without setState in effects
    const resolvedTheme: "dark" | "light" = theme === "system" ? systemTheme : theme;

    // Apply resolved theme to DOM
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
    }, [resolvedTheme]);

    // Listener for system changes when in 'system' mode
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme]);

    const value = {
        theme,
        setTheme: (newTheme: Theme) => {
            updateTheme(newTheme);
        },
        resolvedTheme
    };

    return (
        <ThemeContext.Provider {...props} value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
};
