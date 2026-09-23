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
import { OrderEntity } from "./OrderEntity";

export enum ActorTypeEnum {
  Distributor = "Distributor",
  SalesManager = "SalesManager",
  System = "System",
}

@Entity("order_events")
@Index(["Order"])
export class OrderEventEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @ManyToOne(() => OrderEntity, (Order) => Order.Events)
  @JoinColumn({ name: "order_id" })
  Order: OrderEntity;

  @Column({ name: "fromStatus", type: "varchar", nullable: true })
  FromStatus: string | null;

  @Column({ name: "toStatus", type: "varchar" })
  ToStatus: string;

  @Column({ name: "actorType", type: "enum", enum: ActorTypeEnum })
  ActorType: ActorTypeEnum;

  @Column({ name: "actorId", type: "varchar", length: 36, nullable: true })
  ActorId: string | null;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At", precision: 3 })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At", precision: 3 })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;

  @Column({
    name: "sequence",
    type: "bigint",
    unsigned: true,
    insert: false,
    update: false,
  })
  Sequence: string;

  @Column({
    name: "idempotencyKey",
    type: "varchar",
    length: 100,
    unique: true,
    nullable: true,
  })
  IdempotencyKey: string | null;
}
