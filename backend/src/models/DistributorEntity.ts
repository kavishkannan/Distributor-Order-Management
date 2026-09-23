import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderEntity } from "./OrderEntity";
import { PointsLedgerEntity } from "./PointsLedgerEntity";

@Entity("distributors")
export class DistributorEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @Column({ name: "name", type: "varchar" })
  Name: string;

  @Column({ name: "creditLimit", type: "decimal", precision: 10, scale: 2 })
  CreditLimit: number;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;

  @OneToMany(() => OrderEntity, (Order) => Order.Distributor)
  Orders: OrderEntity[];

  @OneToMany(() => PointsLedgerEntity, (Entry) => Entry.Distributor)
  PointsLedger: PointsLedgerEntity[];
}
