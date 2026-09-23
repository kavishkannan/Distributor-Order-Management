import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import { useAuth } from "../contexts/AuthContext";
import { homePathForRole } from "../utils/roleHome";

export default function AccessDenied() {
  const { user: User } = useAuth();
  const HomePath = User ? homePathForRole(User.role) : "/signin";

  return (
    <div className="page">
      <div className="state-panel state-panel--error">
        <span className="state-panel__icon" aria-hidden="true">
          {"\u{1F512}"}
        </span>
        <span className="state-panel__title">403 &middot; Access denied</span>
        <p>Your account doesn&apos;t have permission to view this page.</p>
        <Link to={HomePath}>
          <Button variant="secondary">Take me back</Button>
        </Link>
      </div>
    </div>
  );
}
