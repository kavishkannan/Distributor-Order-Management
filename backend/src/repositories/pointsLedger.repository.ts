import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity } from "../models/OrderEntity";
import { PointsLedgerEntity } from "../models/PointsLedgerEntity";
import { managerFor, TransactionContext } from "./transaction";

export interface NewPointsLedgerEntry {
  Distributor: DistributorEntity;
  Order: OrderEntity;
  Points: number;
}

export class PointsLedgerRepository {
  addEntry(
    Tx: TransactionContext,
    Data: NewPointsLedgerEntry,
  ): Promise<PointsLedgerEntity> {
    const Repo = Tx.getRepository(PointsLedgerEntity);
    return Repo.save(Repo.create(Data));
  }

  findByOrderIdWithDistributor(
    Tx: TransactionContext,
    OrderId: string,
  ): Promise<PointsLedgerEntity[]> {
    return Tx.getRepository(PointsLedgerEntity).find({
      where: { Order: { Id: OrderId } },
      relations: { Distributor: true },
    });
  }

  async sumPointsSince(
    DistributorId: string,
    Since: Date,
    Tx?: TransactionContext,
  ): Promise<number> {
    const Result = await managerFor(Tx)
      .getRepository(PointsLedgerEntity)
      .createQueryBuilder("entry")
      .select("COALESCE(SUM(entry.Points), 0)", "sum")
      .where("entry.Distributor = :distributorId", {
        distributorId: DistributorId,
      })
      .andWhere("entry.CreatedAt >= :since", { since: Since })
      .getRawOne<{ sum: string }>();
    return Number(Result?.sum ?? 0);
  }
}

export const pointsLedgerRepository = new PointsLedgerRepository();
