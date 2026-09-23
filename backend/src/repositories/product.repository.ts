import { Brackets } from "typeorm";
import { ProductEntity } from "../models/ProductEntity";
import { managerFor, TransactionContext } from "./transaction";

export interface ProductQuery {
  Page: number;
  Limit: number;
  Search?: string;
  InStockOnly?: boolean;
  SortField: string;
  SortDirection: "ASC" | "DESC";
}

export class ProductRepository {
  findActivePaginated(Query: ProductQuery): Promise<[ProductEntity[], number]> {
    const Qb = managerFor()
      .getRepository(ProductEntity)
      .createQueryBuilder("p")
      .where("p.IsDeleted = false");

    if (Query.Search) {
      const Like = `%${Query.Search}%`;
      Qb.andWhere(
        new Brackets((SubQb) => {
          SubQb.where("p.Name LIKE :search", { search: Like }).orWhere(
            "p.Sku LIKE :search",
            { search: Like },
          );
        }),
      );
    }

    if (Query.InStockOnly === true) {
      Qb.andWhere("p.StockQuantity > 0");
    } else if (Query.InStockOnly === false) {
      Qb.andWhere("p.StockQuantity = 0");
    }

    Qb.orderBy(`p.${Query.SortField}`, Query.SortDirection);
    Qb.skip((Query.Page - 1) * Query.Limit).take(Query.Limit);

    return Qb.getManyAndCount();
  }

  lockByIds(Tx: TransactionContext, Ids: string[]): Promise<ProductEntity[]> {
    return Tx.getRepository(ProductEntity)
      .createQueryBuilder("product")
      .setLock("pessimistic_write")
      .whereInIds(Ids)
      .orderBy("product.Id", "ASC")
      .getMany();
  }

  saveMany(
    Tx: TransactionContext,
    Products: ProductEntity[],
  ): Promise<ProductEntity[]> {
    return Tx.getRepository(ProductEntity).save(Products);
  }

  async incrementStock(
    Tx: TransactionContext,
    ProductId: string,
    Quantity: number,
  ): Promise<void> {
    await Tx.createQueryBuilder()
      .update(ProductEntity)
      .set({ StockQuantity: () => "stockQuantity + :qty" })
      .where("id = :productId", { productId: ProductId })
      .setParameter("qty", Quantity)
      .execute();
  }
}

export const productRepository = new ProductRepository();
