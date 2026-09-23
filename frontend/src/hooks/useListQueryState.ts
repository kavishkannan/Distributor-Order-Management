import { useSearchParams } from "react-router-dom";

export function useListQueryState() {
  const [SearchParams, SetSearchParams] = useSearchParams();

  function getParam(Key: string): string {
    return SearchParams.get(Key) ?? "";
  }

  function getNumberParam(Key: string, DefaultValue: number): number {
    const Raw = SearchParams.get(Key);
    if (Raw === null) return DefaultValue;
    const Value = Number(Raw);
    return Number.isInteger(Value) && Value > 0 ? Value : DefaultValue;
  }

  function updateParams(
    Updates: Record<string, string | number | undefined>,
    ResetPage = false,
  ): void {
    const Next = new URLSearchParams(SearchParams);
    for (const [Key, Value] of Object.entries(Updates)) {
      if (Value === undefined || Value === "") {
        Next.delete(Key);
      } else {
        Next.set(Key, String(Value));
      }
    }
    if (ResetPage) {
      Next.set("page", "1");
    }
    SetSearchParams(Next, { replace: true });
  }

  return { getParam, getNumberParam, updateParams };
}
