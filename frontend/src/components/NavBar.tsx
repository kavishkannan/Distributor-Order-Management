import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { UserRole } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";
import AppLogo from "./ui/AppLogo";
import UserMenu from "./UserMenu";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const DistributorLinks: NavItem[] = [
  { to: "/", label: "Catalogue", end: true },
  { to: "/orders", label: "Orders" },
  { to: "/place-order", label: "Place Order" },
  { to: "/distributor-dashboard", label: "Distributor Dashboard" },
];

const SalesManagerLinks: NavItem[] = [
  { to: "/", label: "Catalogue", end: true },
  { to: "/sales-manager-queue", label: "Sales Manager Queue" },
  { to: "/sales-manager-orders", label: "Sales Manager Orders" },
];

function linksForRole(Role: UserRole | undefined): NavItem[] {
  if (Role === "SALES_MANAGER") return SalesManagerLinks;
  if (Role === "DISTRIBUTOR") return DistributorLinks;
  return [];
}

export default function NavBar() {
  const { user: User, isAuthenticated: IsAuthenticated, logout } = useAuth();
  const Navigate = useNavigate();
  const [MobileOpen, SetMobileOpen] = useState(false);

  async function handleSignOut() {
    SetMobileOpen(false);
    await logout();
    Navigate("/signin", { replace: true });
  }

  if (!IsAuthenticated || !User) {
    return (
      <nav className="navbar">
        <div className="navbar__inner">
          <Link to="/signin" className="navbar__brand">
            <AppLogo />
          </Link>
          <div className="navbar__right">
            <div className="navbar__auth-links">
              <Link to="/signin" className="navbar__link">
                Sign In
              </Link>
              <Link to="/signup" className="btn btn--primary btn--sm">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const Links = linksForRole(User.role);

  return (
    <nav className={`navbar${MobileOpen ? " is-open" : ""}`}>
      <div className="navbar__inner">
        <Link
          to="/"
          className="navbar__brand"
          onClick={() => SetMobileOpen(false)}
        >
          <AppLogo />
        </Link>

        <div className="navbar__links">
          {Links.map((Item) => (
            <NavLink
              key={Item.to}
              to={Item.to}
              end={Item.end}
              className={({ isActive }) =>
                `navbar__link${isActive ? " active" : ""}`
              }
            >
              {Item.label}
            </NavLink>
          ))}
        </div>

        <div className="navbar__right">
          <div className="navbar__auth-links">
            <UserMenu user={User} onSignOut={handleSignOut} />
          </div>

          <button
            type="button"
            className="navbar__hamburger"
            aria-label="Toggle navigation menu"
            aria-expanded={MobileOpen}
            onClick={() => SetMobileOpen((Value) => !Value)}
          >
            {MobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      <div className="navbar__mobile-panel">
        {Links.map((Item) => (
          <NavLink
            key={Item.to}
            to={Item.to}
            end={Item.end}
            className={({ isActive }) =>
              `navbar__link${isActive ? " active" : ""}`
            }
            onClick={() => SetMobileOpen(false)}
          >
            {Item.label}
          </NavLink>
        ))}

        <div className="navbar__mobile-user">
          <UserMenu user={User} onSignOut={handleSignOut} />
        </div>
      </div>
    </nav>
  );
}
