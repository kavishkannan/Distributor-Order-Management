import { OrderEventDto } from "../api/orders";
import StatusBadge from "./StatusBadge";

interface OrderTimelineProps {
  events: OrderEventDto[];
}

export default function OrderTimeline({ events: Events }: OrderTimelineProps) {
  return (
    <ol className="timeline">
      {Events.map((Event) => (
        <li className="timeline__item" key={Event.Id}>
          <div className="timeline__row">
            {Event.FromStatus && (
              <>
                <StatusBadge status={Event.FromStatus} />
                <span aria-hidden="true">{"→"}</span>
              </>
            )}
            <StatusBadge status={Event.ToStatus} />
          </div>
          <div className="timeline__meta">
            {Event.ActorType}
            {Event.ActorId ? ` (${Event.ActorId})` : ""} &middot;{" "}
            {new Date(Event.CreatedAt).toLocaleString()}
          </div>
        </li>
      ))}
    </ol>
  );
}
