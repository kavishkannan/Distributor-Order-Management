import { DistributorEntity } from "../models/DistributorEntity";
import { SalesManagerEntity } from "../models/SalesManagerEntity";
import { UserEntity, UserRole } from "../models/UserEntity";
import { managerFor } from "./transaction";

export interface NewUser {
  Name: string;
  Email: string;
  Password: string;
  ContactNumber: string | null;
  Role: UserRole;
  Distributor: DistributorEntity | null;
  SalesManager: SalesManagerEntity | null;
}

const WithLinks = { Distributor: true, SalesManager: true } as const;

export class UserRepository {
  findByEmail(Email: string): Promise<UserEntity | null> {
    return managerFor().getRepository(UserEntity).findOneBy({ Email });
  }

  findByEmailWithLinks(Email: string): Promise<UserEntity | null> {
    return managerFor()
      .getRepository(UserEntity)
      .findOne({ where: { Email }, relations: WithLinks });
  }

  findByIdWithLinks(Id: string): Promise<UserEntity | null> {
    return managerFor()
      .getRepository(UserEntity)
      .findOne({ where: { Id }, relations: WithLinks });
  }

  create(Data: NewUser): Promise<UserEntity> {
    const Repo = managerFor().getRepository(UserEntity);
    return Repo.save(Repo.create(Data));
  }
}

export const userRepository = new UserRepository();
