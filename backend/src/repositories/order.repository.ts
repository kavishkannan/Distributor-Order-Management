import { Brackets } from "typeorm";
import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { managerFor, TransactionContext } from "./transaction";

export interface NewOrder {
  Distributor: DistributorEntity;
  Status: OrderStatus;
  DiscountPercent: number;
  Subtotal: number;
  Total: number;
  IdempotencyKey: string | null;
}

export interface OrderQuery {
  Page: number;
  Limit: number;
  DistributorId?: string;
  Status?: OrderStatus;
  Search?: string;
  SortField: string;
  SortDirection: "ASC" | "DESC";
  IncludeDistributor: boolean;
}

export class OrderRepository {
  create(Tx: TransactionContext, Data: NewOrder): Promise<OrderEntity> {
    const Repo = Tx.getRepository(OrderEntity);
    return Repo.save(Repo.create(Data));
  }

  save(Tx: TransactionContext, Order: OrderEntity): Promise<OrderEntity> {
    return Tx.getRepository(OrderEntity).save(Order);
  }

  lockByIdWithDistributor(
    Tx: TransactionContext,
    Id: string,
  ): Promise<OrderEntity | null> {
    return Tx.getRepository(OrderEntity)
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.Distributor", "distributor")
      .setLock("pessimistic_write")
      .where("o.Id = :orderId", { orderId: Id })
      .getOne();
  }

  findByIdempotencyKeyWithLineItems(
    IdempotencyKey: string,
  ): Promise<OrderEntity | null> {
    return managerFor()
      .getRepository(OrderEntity)
      .findOne({
        where: { IdempotencyKey },
        relations: { Distributor: true, LineItems: { Product: true } },
      });
  }

  findDetailById(Id: string): Promise<OrderEntity | null> {
    return managerFor()
      .getRepository(OrderEntity)
      .findOne({
        where: { Id },
        relations: {
          Distributor: true,
          LineItems: { Product: true },
          Events: true,
        },
      });
  }

  findPaginated(Query: OrderQuery): Promise<[OrderEntity[], number]> {
    const Qb = managerFor()
      .getRepository(OrderEntity)
      .createQueryBuilder("o")
      .leftJoin("o.Distributor", "distributor")
      .select([
        "o.Id",
        "o.Status",
        "o.Subtotal",
        "o.DiscountPercent",
        "o.Total",
        "o.CreatedAt",
      ]);

    if (Query.IncludeDistributor) {
      Qb.addSelect(["distributor.Id", "distributor.Name"]);
    }
    if (Query.DistributorId) {
      Qb.andWhere("distributor.Id = :distributorId", {
        distributorId: Query.DistributorId,
      });
    }
    if (Query.Status) {
      Qb.andWhere("o.Status = :status", { status: Query.Status });
    }
    if (Query.Search) {
      const Like = `%${Query.Search}%`;
      Qb.andWhere(
        new Brackets((SubQb) => {
          SubQb.where("o.Id LIKE :search", { search: Like });
          if (Query.IncludeDistributor) {
            SubQb.orWhere("distributor.Name LIKE :search", { search: Like });
          }
        }),
      );
    }

    Qb.orderBy(`o.${Query.SortField}`, Query.SortDirection);
    Qb.skip((Query.Page - 1) * Query.Limit).take(Query.Limit);

    return Qb.getManyAndCount();
  }

  async sumTotalsExcludingStatuses(
    DistributorId: string,
    ExcludedStatuses: OrderStatus[],
    Tx?: TransactionContext,
  ): Promise<number> {
    const Result = await managerFor(Tx)
      .getRepository(OrderEntity)
      .createQueryBuilder("o")
      .select("COALESCE(SUM(o.Total), 0)", "sum")
      .where("o.Distributor = :distributorId", { distributorId: DistributorId })
      .andWhere("o.Status NOT IN (:...excludedStatuses)", {
        excludedStatuses: ExcludedStatuses,
      })
      .getRawOne<{ sum: string }>();
    return Number(Result?.sum ?? 0);
  }
}

export const orderRepository = new OrderRepository();
