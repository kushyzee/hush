import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type KeyboardEvent,
} from "react";
import { Send } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

const MAX_ROWS = 6;
const LINE_HEIGHT = 24;

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * MAX_ROWS)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-end gap-2 px-4 py-3 bg-card border-t border-border">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Message…"
        rows={1}
        className={cn(
          "flex-1 resize-none bg-secondary rounded-xl px-4 py-2.5",
          "text-sm text-foreground placeholder:text-muted-foreground",
          "border border-border focus:outline-none focus:ring-1 focus:ring-ring",
          "transition-colors duration-150 leading-relaxed",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "[scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]",
        )}
        aria-label="Message input"
      />

      <Button
        size="icon"
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        aria-label="Send message"
        className={cn(
          "size-10 rounded-xl shrink-0 transition-all duration-150",
          "bg-primary text-primary-foreground",
          "hover:bg-brand-dim disabled:opacity-40",
        )}
      >
        <Send size={15} />
      </Button>
    </div>
  );
}
