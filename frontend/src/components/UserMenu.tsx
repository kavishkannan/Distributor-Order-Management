import { useEffect, useRef, useState } from "react";
import { UserDto } from "../api/auth";
import Avatar from "./ui/Avatar";

interface UserMenuProps {
  user: UserDto;
  onSignOut: () => void;
}

const RoleLabels: Record<UserDto["role"], string> = {
  DISTRIBUTOR: "Distributor",
  SALES_MANAGER: "Sales Manager",
};

export default function UserMenu({
  user: User,
  onSignOut: OnSignOut,
}: UserMenuProps) {
  const [Open, SetOpen] = useState(false);
  const Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(Evt: MouseEvent) {
      if (Ref.current && !Ref.current.contains(Evt.target as Node)) {
        SetOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="user-menu" ref={Ref}>
      <button
        type="button"
        className="user-menu__trigger"
        onClick={() => SetOpen((Value) => !Value)}
        aria-haspopup="menu"
        aria-expanded={Open}
        aria-label={`Account menu for ${User.name}`}
      >
        <Avatar name={User.name} />
        <span className="user-menu__label">
          <span className="user-menu__name">{User.name}</span>
          <span className="user-menu__email">{RoleLabels[User.role]}</span>
        </span>
        <span className="user-menu__caret" aria-hidden="true">
          {"▾"}
        </span>
      </button>

      {Open && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__dropdown-header">
            <div className="user-menu__name">{User.name}</div>
            <div className="user-menu__email">{User.email}</div>
            <div className="user-menu__email">{RoleLabels[User.role]}</div>
          </div>
          <button
            type="button"
            className="user-menu__item user-menu__item--danger"
            onClick={() => {
              SetOpen(false);
              OnSignOut();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
