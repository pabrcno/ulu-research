import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, MapPin } from "lucide-react";
import { COUNTRIES, getCountryByCode } from "@/lib/countries";

interface SearchBarProps {
  onSearch: (query: string, countryCode?: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [countryCode, setCountryCode] = useState("US");

  const displayCountry = getCountryByCode(countryCode) ?? {
    code: countryCode,
    name: countryCode,
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    onSearch(trimmed, countryCode);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Select
          value={countryCode}
          onValueChange={setCountryCode}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full sm:w-[220px] h-11">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a product to research... e.g. 'wireless earbuds', 'yoga mats'"
            className="pl-9 h-11"
            disabled={isLoading}
          />
        </div>
        <Button type="submit" disabled={!query.trim() || isLoading} className="h-11 px-6">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Research"
          )}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          Target country: {displayCountry.name}
        </span>
      </div>
    </form>
  );
}
