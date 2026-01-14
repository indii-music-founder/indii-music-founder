"use client";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Globe, Paperclip, Send, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";

interface AI_Input_Search_Props {
    value?: string;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
    onFileSelect?: (file: File) => void;
    placeholder?: string;
    className?: string;
    showSearchToggle?: boolean;
    isLoading?: boolean;
}

export default function AI_Input_Search({
    value: externalValue,
    onChange,
    onSubmit,
    onFileSelect,
    placeholder = "Search the web...",
    className,
    showSearchToggle = true,
    isLoading = false
}: AI_Input_Search_Props) {
    const [internalValue, setInternalValue] = useState("");
    const value = externalValue !== undefined ? externalValue : internalValue;

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 52,
        maxHeight: 200,
    });
    const [showSearch, setShowSearch] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = () => {
        const finalValue = value.trim();
        if (!finalValue || isLoading) return;

        if (onSubmit) {
            onSubmit(finalValue);
        } else {
            console.log("Submit:", finalValue);
            setInternalValue("");
        }
        adjustHeight(true);
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    const handleContainerClick = () => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onFileSelect) {
            onFileSelect(file);
        }
    };

    const isSendDisabled = !value.trim() || isLoading;

    return (
        <div className={cn("w-full py-4", className)}>
            <div className="relative max-w-xl w-full mx-auto">
                <div
                    role="group"
                    aria-label="Search input group"
                    className={cn(
                        "relative flex flex-col rounded-xl transition-all duration-200 w-full text-left cursor-text",
                        "ring-1 ring-black/10 dark:ring-white/10",
                        isFocused && "ring-black/20 dark:ring-white/20"
                    )}
                    onClick={handleContainerClick}
                    onKeyDown={(e) => {
                        // Allow tabbing through without triggering click
                        if (e.key === "Tab") return;
                        if (e.key === "Enter" || e.key === " ") {
                            handleContainerClick();
                        }
                    }}
                >
                    <div className="overflow-y-auto max-h-[200px]">
                        <Textarea
                            id="ai-input-04"
                            value={value}
                            placeholder={placeholder}
                            className="w-full rounded-xl rounded-b-none px-4 py-3 bg-black/5 dark:bg-white/5 border-none dark:text-white placeholder:text-black/70 dark:placeholder:text-white/70 resize-none focus-visible:ring-0 leading-[1.2]"
                            ref={textareaRef}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            onChange={(e) => {
                                if (onChange) {
                                    onChange(e.target.value);
                                } else {
                                    setInternalValue(e.target.value);
                                }
                                adjustHeight();
                            }}
                        />
                    </div>

                    <div className="flex justify-between items-center p-2 min-h-[44px] bg-black/5 dark:bg-white/5 rounded-b-xl">
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                className="hidden"
                                aria-label="Upload file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <button
                                type="button"
                                aria-label="Attach file"
                                className="cursor-pointer rounded-lg h-11 w-11 flex items-center justify-center bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                            >
                                <Paperclip className="w-4 h-4 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors" />
                            </button>

                            {showSearchToggle && (
                                <button
                                    type="button"
                                    aria-label={showSearch ? "Hide search options" : "Show search options"}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSearch(!showSearch);
                                    }}
                                    className={cn(
                                        "rounded-full transition-all flex items-center gap-2 px-3 border h-11 cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none",
                                        showSearch
                                            ? "bg-sky-500/15 border-sky-400 text-sky-500"
                                            : "bg-black/5 dark:bg-white/5 border-transparent text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white "
                                    )}
                                >
                                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                        <motion.div
                                            animate={{
                                                rotate: showSearch ? 180 : 0,
                                                scale: showSearch ? 1.1 : 1,
                                            }}
                                            whileHover={{
                                                rotate: showSearch ? 180 : 15,
                                                scale: 1.1,
                                                transition: {
                                                    type: "spring",
                                                    stiffness: 300,
                                                    damping: 10,
                                                },
                                            }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 260,
                                                damping: 25,
                                            }}
                                        >
                                            <Globe
                                                className={cn(
                                                    "w-4 h-4",
                                                    showSearch
                                                        ? "text-sky-500"
                                                        : "text-inherit"
                                                )}
                                            />
                                        </motion.div>
                                    </div>
                                    <AnimatePresence mode="wait">
                                        {showSearch && (
                                            <motion.span
                                                initial={{ width: 0, opacity: 0 }}
                                                animate={{
                                                    width: "auto",
                                                    opacity: 1,
                                                }}
                                                exit={{ width: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="text-sm overflow-hidden whitespace-nowrap text-sky-500 shrink-0"
                                            >
                                                Search
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </button>
                            )}
                        </div>
                        <div>
                            <button
                                type="button"
                                disabled={isSendDisabled}
                                aria-label={isLoading ? "Sending prompt..." : "Send prompt"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSubmit();
                                }}
                                className={cn(
                                    "rounded-lg h-11 w-11 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none",
                                    isSendDisabled
                                        ? "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 cursor-not-allowed opacity-50"
                                        : "bg-sky-500/15 text-sky-500 hover:bg-sky-500/20 cursor-pointer"
                                )}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
