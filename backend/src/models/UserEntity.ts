import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { DistributorEntity } from "./DistributorEntity";
import { SalesManagerEntity } from "./SalesManagerEntity";

export enum UserRole {
  Distributor = "DISTRIBUTOR",
  SalesManager = "SALES_MANAGER",
}

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @Column({ name: "name", type: "varchar" })
  Name: string;

  @Column({ name: "email", type: "varchar", unique: true })
  Email: string;

  @Column({ name: "password", type: "varchar" })
  Password: string;

  @Column({ name: "contactNumber", type: "varchar", nullable: true })
  ContactNumber: string | null;

  @Column({ name: "role", type: "enum", enum: UserRole })
  Role: UserRole;

  @ManyToOne(() => DistributorEntity, { nullable: true })
  @JoinColumn({ name: "distributor_id" })
  Distributor: DistributorEntity | null;

  @ManyToOne(() => SalesManagerEntity, { nullable: true })
  @JoinColumn({ name: "sales_manager_id" })
  SalesManager: SalesManagerEntity | null;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;
}
