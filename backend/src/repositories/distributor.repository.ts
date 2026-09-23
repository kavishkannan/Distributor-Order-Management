import { DistributorEntity } from "../models/DistributorEntity";
import { managerFor, TransactionContext } from "./transaction";

export class DistributorRepository {
  findById(Id: string): Promise<DistributorEntity | null> {
    return managerFor().getRepository(DistributorEntity).findOneBy({ Id });
  }

  lockById(
    Tx: TransactionContext,
    Id: string,
  ): Promise<DistributorEntity | null> {
    return Tx.getRepository(DistributorEntity)
      .createQueryBuilder("distributor")
      .setLock("pessimistic_write")
      .where("distributor.Id = :distributorId", { distributorId: Id })
      .getOne();
  }

  findActiveNames(): Promise<DistributorEntity[]> {
    return managerFor()
      .getRepository(DistributorEntity)
      .find({
        where: { IsDeleted: false },
        select: { Id: true, Name: true },
        order: { Name: "ASC" },
      });
  }
}

export const distributorRepository = new DistributorRepository();
