interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div
      className="table-wrap skeleton-table"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }).map((_, RowIndex) => (
        <div
          className="skeleton-row"
          key={RowIndex}
          style={{ display: "flex", gap: 16, padding: "0 16px" }}
        >
          {Array.from({ length: columns }).map((__, ColIndex) => (
            <span
              key={ColIndex}
              className="skeleton"
              style={{
                height: 14,
                flex: ColIndex === 0 ? 2 : 1,
                margin: "14px 0",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="card-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, Index) => (
        <span key={Index} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function LineSkeleton({ width = "100%" }: { width?: string }) {
  return (
    <span
      className="skeleton"
      style={{ height: 14, width, display: "block" }}
    />
  );
}
