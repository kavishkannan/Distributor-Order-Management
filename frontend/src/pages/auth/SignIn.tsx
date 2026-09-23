import axios from "axios";
import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isValidationErrorResponse } from "../../api/types";
import AppLogo from "../../components/ui/AppLogo";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useAuth } from "../../contexts/AuthContext";
import { homePathForRole } from "../../utils/roleHome";

const EmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(Email: string, Password: string): FieldErrors {
  const Errors: FieldErrors = {};
  if (!EmailPattern.test(Email.trim())) {
    Errors.email = "Enter a valid email address.";
  }
  if (Password.length === 0) {
    Errors.password = "Password is required.";
  }
  return Errors;
}

interface LocationState {
  from?: { pathname: string };
}

export default function SignIn() {
  const { login } = useAuth();
  const Navigate = useNavigate();
  const Location = useLocation();

  const [Email, SetEmail] = useState("");
  const [Password, SetPassword] = useState("");
  const [ShowPassword, SetShowPassword] = useState(false);
  const [RememberMe, SetRememberMe] = useState(true);
  const [Submitting, SetSubmitting] = useState(false);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [FieldErrors, SetFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(Evt: FormEvent) {
    Evt.preventDefault();
    SetErrorMessage(null);

    const Errors = validate(Email, Password);
    SetFieldErrors(Errors);
    if (Object.keys(Errors).length > 0) return;

    SetSubmitting(true);
    try {
      const User = await login({ email: Email.trim(), password: Password });
      const AttemptedFrom = (Location.state as LocationState | null)?.from
        ?.pathname;
      Navigate(AttemptedFrom ?? homePathForRole(User.role), { replace: true });
    } catch (Err) {
      const Data = axios.isAxiosError(Err) ? Err.response?.data : undefined;
      if (isValidationErrorResponse(Data)) {
        const NextFieldErrors: FieldErrors = {};
        for (const Issue of Data.errors) {
          if (Issue.field === "email" || Issue.field === "password")
            NextFieldErrors[Issue.field] = Issue.message;
        }
        SetFieldErrors(NextFieldErrors);
      } else {
        SetErrorMessage(Data?.message ?? "Invalid email or password.");
      }
    } finally {
      SetSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__brand">
          <AppLogo />
        </div>
        <h1 className="auth-card__title">Sign in</h1>
        <p className="auth-card__subtitle">
          Welcome back. Enter your details to continue.
        </p>

        {ErrorMessage && (
          <div className="alert alert--danger" role="alert">
            {ErrorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Input
            id="signin-email"
            label="Email"
            type="email"
            value={Email}
            onChange={(Evt) => {
              SetEmail(Evt.target.value);
              if (FieldErrors.email)
                SetFieldErrors((Errors) => ({ ...Errors, email: undefined }));
            }}
            autoComplete="email"
            error={FieldErrors.email}
            required
          />

          <Input
            id="signin-password"
            label="Password"
            type={ShowPassword ? "text" : "password"}
            value={Password}
            onChange={(Evt) => {
              SetPassword(Evt.target.value);
              if (FieldErrors.password)
                SetFieldErrors((Errors) => ({
                  ...Errors,
                  password: undefined,
                }));
            }}
            autoComplete="current-password"
            error={FieldErrors.password}
            required
            trailing={
              <button
                type="button"
                className="input-group__action"
                onClick={() => SetShowPassword((Value) => !Value)}
              >
                {ShowPassword ? "Hide" : "Show"}
              </button>
            }
          />

          <div className="auth-card__row">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={RememberMe}
                onChange={(Evt) => SetRememberMe(Evt.target.checked)}
              />
              Remember me
            </label>
            <span className="auth-forgot">Forgot password?</span>
          </div>

          <Button type="submit" variant="primary" block loading={Submitting}>
            {Submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="auth-card__footer">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
