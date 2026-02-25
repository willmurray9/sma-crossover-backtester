import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface TickerInputProps {
  onSubmit: (ticker: string) => void;
  currentTicker: string;
}

export function TickerInput({ onSubmit, currentTicker }: TickerInputProps) {
  const [value, setValue] = useState(currentTicker);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim().toUpperCase());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="Enter ticker..."
          className="pl-9 w-48 bg-secondary border-border font-mono text-sm uppercase tracking-wider"
          maxLength={6}
        />
      </div>
      <Button type="submit" size="sm" className="font-medium text-sm">
        Analyze
      </Button>
    </form>
  );
}
