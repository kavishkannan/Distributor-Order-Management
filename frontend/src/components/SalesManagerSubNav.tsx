import { NavLink } from "react-router-dom";

const Tabs = [
  { to: "/sales-manager-dashboard", label: "Dashboard" },
  { to: "/sales-manager-queue", label: "Approval Queue" },
  { to: "/sales-manager-orders", label: "All Orders" },
];

export default function SalesManagerSubNav() {
  return (
    <nav className="sub-nav" aria-label="Sales manager sections">
      {Tabs.map((Tab) => (
        <NavLink
          key={Tab.to}
          to={Tab.to}
          className={({ isActive }) => (isActive ? "active" : undefined)}
        >
          {Tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
