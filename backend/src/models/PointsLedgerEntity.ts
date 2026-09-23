import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { DistributorEntity } from "./DistributorEntity";
import { OrderEntity } from "./OrderEntity";

@Entity("points_ledger")
@Index(["Distributor"])
export class PointsLedgerEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @ManyToOne(() => DistributorEntity, (Distributor) => Distributor.PointsLedger)
  @JoinColumn({ name: "distributor_id" })
  Distributor: DistributorEntity;

  @ManyToOne(() => OrderEntity, (Order) => Order.PointsLedgerEntries)
  @JoinColumn({ name: "order_id" })
  Order: OrderEntity;

  @Column({ name: "points", type: "int" })
  Points: number;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;
}
