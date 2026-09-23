import { useEffect, useState } from "react";

export function useDebouncedValue<T>(Value: T, DelayMs = 400): T {
  const [Debounced, SetDebounced] = useState(Value);

  useEffect(() => {
    const Timer = setTimeout(() => SetDebounced(Value), DelayMs);
    return () => clearTimeout(Timer);
  }, [Value, DelayMs]);

  return Debounced;
}
