import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/core/context/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme();

    return (
        <div className={cn("flex items-center gap-1 p-1 bg-secondary/50 rounded-full border border-white/10", className)}>
            <button
                onClick={() => setTheme("light")}
                className={cn(
                    "p-1.5 rounded-full transition-all duration-200",
                    theme === "light"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="Light Mode"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("system")}
                className={cn(
                    "p-1.5 rounded-full transition-all duration-200",
                    theme === "system"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="System Preference"
            >
                <Monitor className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={cn(
                    "p-1.5 rounded-full transition-all duration-200",
                    theme === "dark"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="Dark Mode"
            >
                <Moon className="w-4 h-4" />
            </button>
        </div>
    );
}
