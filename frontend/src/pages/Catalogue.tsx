import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAllProducts, ProductDto } from "../api/products";
import { ListResponse } from "../api/types";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Input from "../components/ui/Input";
import { TableSkeleton } from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import Select from "../components/ui/Select";
import { useAuth } from "../contexts/AuthContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useListQueryState } from "../hooks/useListQueryState";
import { formatPrice } from "../utils/currency";

type StockFilter = "all" | "in-stock" | "out-of-stock";

export default function Catalogue() {
  const { getParam, getNumberParam, updateParams } = useListQueryState();
  const CanOrder = useAuth().hasRole("DISTRIBUTOR");

  const Page = getNumberParam("page", 1);
  const Limit = getNumberParam("limit", 10);
  const StockFilterValue = (getParam("inStock") || "all") as StockFilter;
  const SortValue = `${getParam("sortBy") || "sku"}:${getParam("sortOrder") || "ASC"}`;

  const [SearchInput, SetSearchInput] = useState(getParam("search"));
  const DebouncedSearch = useDebouncedValue(SearchInput, 400);

  useEffect(() => {
    if (DebouncedSearch !== getParam("search")) {
      updateParams({ search: DebouncedSearch || undefined }, true);
    }
  }, [DebouncedSearch]);

  const Search = getParam("search");

  const [Result, SetResult] = useState<ListResponse<ProductDto> | null>(null);
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [RefetchToken, SetRefetchToken] = useState(0);

  useEffect(() => {
    let Cancelled = false;
    SetLoading(true);
    SetErrorMessage(null);

    getAllProducts({
      page: Page,
      limit: Limit,
      search: Search || undefined,
      inStock:
        StockFilterValue === "all"
          ? undefined
          : StockFilterValue === "in-stock",
      sortBy: SortValue.split(":")[0],
      sortOrder: SortValue.split(":")[1] as "ASC" | "DESC",
    })
      .then((Data) => {
        if (!Cancelled) SetResult(Data);
      })
      .catch(() => {
        if (!Cancelled) SetErrorMessage("Failed to load catalogue.");
      })
      .finally(() => {
        if (!Cancelled) SetLoading(false);
      });

    return () => {
      Cancelled = true;
    };
  }, [Page, Limit, Search, StockFilterValue, SortValue, RefetchToken]);

  return (
    <div className="page">
      <PageHeader
        title="Catalogue"
        subtitle="Browse available products, pricing and live stock."
      />

      <div className="filter-bar">
        <Input
          id="catalogue-search"
          label="Search"
          placeholder="Search by name or SKU"
          value={SearchInput}
          maxLength={100}
          onChange={(Evt) => SetSearchInput(Evt.target.value)}
        />
        <Select
          id="catalogue-stock-filter"
          label="Availability"
          value={StockFilterValue}
          onChange={(Evt) =>
            updateParams(
              {
                inStock:
                  Evt.target.value === "all" ? undefined : Evt.target.value,
              },
              true,
            )
          }
        >
          <option value="all">All products</option>
          <option value="in-stock">In stock</option>
          <option value="out-of-stock">Out of stock</option>
        </Select>
        <Select
          id="catalogue-sort"
          label="Sort by"
          value={SortValue}
          onChange={(Evt) => {
            const [Field, Dir] = Evt.target.value.split(":");
            updateParams({ sortBy: Field, sortOrder: Dir }, true);
          }}
        >
          <option value="sku:ASC">SKU</option>
          <option value="name:ASC">Name (A-Z)</option>
          <option value="name:DESC">Name (Z-A)</option>
          <option value="unitprice:ASC">Price: low to high</option>
          <option value="unitprice:DESC">Price: high to low</option>
          <option value="stockquantity:DESC">Stock: high to low</option>
        </Select>
      </div>

      {Loading && (
        <TableSkeleton
          rows={Limit > 10 ? 10 : Limit}
          columns={CanOrder ? 5 : 4}
        />
      )}

      {!Loading && ErrorMessage && (
        <ErrorState
          message={ErrorMessage}
          onRetry={() => SetRefetchToken((Token) => Token + 1)}
        />
      )}

      {!Loading && !ErrorMessage && Result && Result.data.length === 0 && (
        <EmptyState
          title="No products found"
          message={
            Search || StockFilterValue !== "all"
              ? "Try a different search or filter."
              : "The catalogue is currently empty."
          }
        />
      )}

      {!Loading && !ErrorMessage && Result && Result.data.length > 0 && (
        <>
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data-table data-table--responsive">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Unit Price</th>
                    <th>Available Stock</th>
                    {CanOrder && <th />}
                  </tr>
                </thead>
                <tbody>
                  {Result.data.map((Product) => {
                    const OutOfStock = Number(Product.StockQuantity) === 0;
                    return (
                      <tr
                        key={Product.Id}
                        className={OutOfStock ? "row--muted" : undefined}
                      >
                        <td data-label="SKU">{Product.Sku}</td>
                        <td data-label="Name">{Product.Name}</td>
                        <td data-label="Unit Price">
                          {formatPrice(Product.UnitPrice)}
                        </td>
                        <td data-label="Stock">
                          {OutOfStock ? (
                            <Badge tone="danger">Out of stock</Badge>
                          ) : (
                            Product.StockQuantity
                          )}
                        </td>
                        {CanOrder && (
                          <td data-label="">
                            {!OutOfStock && (
                              <Link
                                className="btn btn--secondary btn--sm"
                                to={`/place-order?productId=${Product.Id}`}
                              >
                                Add to order
                              </Link>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            meta={Result.pagination}
            onPageChange={(NewPage) => updateParams({ page: NewPage })}
            onPageSizeChange={(NewLimit) =>
              updateParams({ limit: NewLimit }, true)
            }
          />
        </>
      )}
    </div>
  );
}
