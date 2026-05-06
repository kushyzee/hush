import { useState, useEffect } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

export function EncryptionBadge() {
  const [open, setOpen] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="End-to-end encrypted — click to learn more"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
          "border border-success/20 bg-success/5",
          "hover:bg-success/10 hover:border-success/30",
          "transition-all duration-200 cursor-pointer group",
        )}
      >
        <Lock
          size={11}
          className={cn(
            "text-success transition-all duration-500",
            animated ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        />
        <span className="text-[11px] font-medium text-success leading-none">
          End-to-end encrypted
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-popover border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="size-8 rounded-lg bg-success/10 flex items-center justify-center">
                <ShieldCheck size={16} className="text-success" />
              </div>
              <DialogTitle className="text-foreground text-base">
                End-to-end encrypted
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3 text-sm text-secondary-foreground leading-relaxed">
            <p>
              Messages in Hush are encrypted on your device before they leave
              it. Only you and the person you&apos;re talking to can read them.
            </p>
            <p>
              Not even the server can see your messages, it only stores
              encrypted data it has no key to unlock.
            </p>
          </div>

          <Button
            onClick={() => setOpen(false)}
            className="w-full mt-2 bg-secondary text-secondary-foreground hover:bg-accent border border-border"
            variant="ghost"
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
