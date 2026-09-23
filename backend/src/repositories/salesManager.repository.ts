import { SalesManagerEntity } from "../models/SalesManagerEntity";
import { managerFor } from "./transaction";

export class SalesManagerRepository {
  findById(Id: string): Promise<SalesManagerEntity | null> {
    return managerFor().getRepository(SalesManagerEntity).findOneBy({ Id });
  }

  findFirstActive(): Promise<SalesManagerEntity | null> {
    return managerFor()
      .getRepository(SalesManagerEntity)
      .findOneBy({ IsDeleted: false });
  }
}

export const salesManagerRepository = new SalesManagerRepository();
