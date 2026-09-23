import { LessThan } from "typeorm";
import { RevokedTokenEntity } from "../models/RevokedTokenEntity";
import { managerFor } from "./transaction";

export class RevokedTokenRepository {
  async exists(TokenHash: string): Promise<boolean> {
    return managerFor()
      .getRepository(RevokedTokenEntity)
      .existsBy({ TokenHash });
  }

  async add(TokenHash: string, UserId: string, ExpiresAt: Date): Promise<void> {
    await managerFor()
      .createQueryBuilder()
      .insert()
      .into(RevokedTokenEntity)
      .values({ TokenHash, UserId, ExpiresAt })
      .orIgnore()
      .execute();
  }

  async deleteExpiredBefore(Now: Date): Promise<void> {
    await managerFor()
      .getRepository(RevokedTokenEntity)
      .delete({ ExpiresAt: LessThan(Now) });
  }
}

export const revokedTokenRepository = new RevokedTokenRepository();
