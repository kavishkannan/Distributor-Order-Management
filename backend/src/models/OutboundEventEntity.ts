import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderEntity } from "./OrderEntity";

export enum OutboundEventStatus {
  Pending = "Pending",
  Sent = "Sent",
  Failed = "Failed",
}

@Entity("outbound_events")
export class OutboundEventEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @ManyToOne(() => OrderEntity, (Order) => Order.OutboundEvents)
  @JoinColumn({ name: "order_id" })
  Order: OrderEntity;

  @Column({ name: "eventType", type: "varchar" })
  EventType: string;

  @Column({ name: "payload", type: "json" })
  Payload: Record<string, unknown>;

  @Column({ name: "status", type: "enum", enum: OutboundEventStatus })
  Status: OutboundEventStatus;

  @Column({ name: "attemptCount", type: "int", default: 0 })
  AttemptCount: number;

  @Column({ name: "lastAttemptedAt", type: "datetime", nullable: true })
  LastAttemptedAt: Date | null;

  @Column({ name: "nextRetryAt", type: "datetime", nullable: true })
  NextRetryAt: Date | null;

  @Column({
    name: "errorMessage",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  ErrorMessage: string | null;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;
}
