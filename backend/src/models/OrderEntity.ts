import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { DistributorEntity } from "./DistributorEntity";
import { OrderEventEntity } from "./OrderEventEntity";
import { OrderLineItemEntity } from "./OrderLineItemEntity";
import { OutboundEventEntity } from "./OutboundEventEntity";
import { PointsLedgerEntity } from "./PointsLedgerEntity";

export enum OrderStatus {
  Placed = "Placed",
  Confirmed = "Confirmed",
  PendingApproval = "PendingApproval",
  Rejected = "Rejected",
  Dispatched = "Dispatched",
  Delivered = "Delivered",
  Cancelled = "Cancelled",
}

@Entity("orders")
@Index(["Distributor"])
@Index(["Status"])
@Index(["CreatedAt"])
export class OrderEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @ManyToOne(() => DistributorEntity, (Distributor) => Distributor.Orders)
  @JoinColumn({ name: "distributor_id" })
  Distributor: DistributorEntity;

  @Column({ name: "status", type: "enum", enum: OrderStatus })
  Status: OrderStatus;

  @Column({ name: "discountPercent", type: "decimal", precision: 5, scale: 2 })
  DiscountPercent: number;

  @Column({ name: "subtotal", type: "decimal", precision: 10, scale: 2 })
  Subtotal: number;

  @Column({ name: "total", type: "decimal", precision: 10, scale: 2 })
  Total: number;

  @Column({
    name: "idempotencyKey",
    type: "varchar",
    unique: true,
    nullable: true,
  })
  IdempotencyKey: string | null;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;

  @OneToMany(() => OrderLineItemEntity, (LineItem) => LineItem.Order)
  LineItems: OrderLineItemEntity[];

  @OneToMany(() => OrderEventEntity, (Event) => Event.Order)
  Events: OrderEventEntity[];

  @OneToMany(() => PointsLedgerEntity, (Entry) => Entry.Order)
  PointsLedgerEntries: PointsLedgerEntity[];

  @OneToMany(() => OutboundEventEntity, (Event) => Event.Order)
  OutboundEvents: OutboundEventEntity[];
}
