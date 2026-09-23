import axios from "axios";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getSignUpDistributors,
  SignUpDistributorDto,
  UserRole,
} from "../../api/auth";
import { isValidationErrorResponse } from "../../api/types";
import AppLogo from "../../components/ui/AppLogo";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useAuth } from "../../contexts/AuthContext";
import { homePathForRole } from "../../utils/roleHome";

const EmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PasswordHasLetterAndDigit = /(?=.*[A-Za-z])(?=.*\d)/;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  distributorId?: string;
}

function validate(
  Name: string,
  Email: string,
  Password: string,
  ConfirmPassword: string,
  Role: UserRole,
  DistributorId: string,
): FieldErrors {
  const Errors: FieldErrors = {};

  const TrimmedName = Name.trim();
  if (TrimmedName.length < 2 || TrimmedName.length > 100) {
    Errors.name = "Name must be 2-100 characters.";
  }

  if (!EmailPattern.test(Email.trim())) {
    Errors.email = "Enter a valid email address.";
  }

  if (Password.length < 8 || Password.length > 100) {
    Errors.password = "Password must be 8-100 characters.";
  } else if (!PasswordHasLetterAndDigit.test(Password)) {
    Errors.password =
      "Password must contain at least one letter and one digit.";
  }

  if (ConfirmPassword !== Password) {
    Errors.confirmPassword = "Passwords do not match.";
  }

  if (Role === "DISTRIBUTOR" && !DistributorId) {
    Errors.distributorId = "Select which distributor this account belongs to.";
  }

  return Errors;
}

export default function SignUp() {
  const { signup } = useAuth();
  const Navigate = useNavigate();

  const [Name, SetName] = useState("");
  const [Email, SetEmail] = useState("");
  const [Password, SetPassword] = useState("");
  const [ConfirmPassword, SetConfirmPassword] = useState("");
  const [ContactNumber, SetContactNumber] = useState("");
  const [Role, SetRole] = useState<UserRole>("DISTRIBUTOR");
  const [Distributors, SetDistributors] = useState<SignUpDistributorDto[]>([]);
  const [DistributorsError, SetDistributorsError] = useState<string | null>(
    null,
  );
  const [DistributorId, SetDistributorId] = useState("");
  const [ShowPassword, SetShowPassword] = useState(false);
  const [Submitting, SetSubmitting] = useState(false);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [FieldErrors, SetFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let Cancelled = false;
    getSignUpDistributors()
      .then((Data) => {
        if (Cancelled) return;
        SetDistributors(Data);
        SetDistributorId((Current) => Current || (Data[0]?.id ?? ""));
      })
      .catch(() => {
        if (!Cancelled)
          SetDistributorsError(
            "Could not load distributors. Refresh to try again.",
          );
      });
    return () => {
      Cancelled = true;
    };
  }, []);

  function clearFieldError(Field: keyof FieldErrors) {
    if (FieldErrors[Field])
      SetFieldErrors((Errors) => ({ ...Errors, [Field]: undefined }));
  }

  async function handleSubmit(Evt: FormEvent) {
    Evt.preventDefault();
    SetErrorMessage(null);

    const Errors = validate(
      Name,
      Email,
      Password,
      ConfirmPassword,
      Role,
      DistributorId,
    );
    SetFieldErrors(Errors);
    if (Object.keys(Errors).length > 0) return;

    SetSubmitting(true);
    try {
      const User = await signup({
        name: Name.trim(),
        email: Email.trim(),
        password: Password,
        role: Role,
        distributorId: Role === "DISTRIBUTOR" ? DistributorId : undefined,
        contactNumber: ContactNumber.trim() ? ContactNumber.trim() : undefined,
      });
      Navigate(homePathForRole(User.role), { replace: true });
    } catch (Err) {
      const Data = axios.isAxiosError(Err) ? Err.response?.data : undefined;
      if (isValidationErrorResponse(Data)) {
        const NextFieldErrors: FieldErrors = {};
        for (const Issue of Data.errors) {
          if (
            Issue.field === "name" ||
            Issue.field === "email" ||
            Issue.field === "password" ||
            Issue.field === "distributorId"
          ) {
            NextFieldErrors[Issue.field] = Issue.message;
          }
        }
        SetFieldErrors(NextFieldErrors);
      } else {
        SetErrorMessage(Data?.message ?? "Failed to sign up.");
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
        <h1 className="auth-card__title">Create account</h1>
        <p className="auth-card__subtitle">
          Set up access to the order management portal.
        </p>

        {ErrorMessage && (
          <div className="alert alert--danger" role="alert">
            {ErrorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Input
            id="signup-name"
            label="Name"
            type="text"
            value={Name}
            onChange={(Evt) => {
              SetName(Evt.target.value);
              clearFieldError("name");
            }}
            autoComplete="name"
            error={FieldErrors.name}
            required
          />

          <Input
            id="signup-email"
            label="Email"
            type="email"
            value={Email}
            onChange={(Evt) => {
              SetEmail(Evt.target.value);
              clearFieldError("email");
            }}
            autoComplete="email"
            error={FieldErrors.email}
            required
          />

          <Select
            id="signup-role"
            label="Role"
            value={Role}
            onChange={(Evt) => SetRole(Evt.target.value as UserRole)}
          >
            <option value="DISTRIBUTOR">Distributor</option>
            <option value="SALES_MANAGER">Sales Manager</option>
          </Select>

          {Role === "DISTRIBUTOR" && (
            <Select
              id="signup-distributor"
              label="Distributor"
              value={DistributorId}
              onChange={(Evt) => {
                SetDistributorId(Evt.target.value);
                clearFieldError("distributorId");
              }}
              error={
                FieldErrors.distributorId ?? DistributorsError ?? undefined
              }
              disabled={Distributors.length === 0}
            >
              {Distributors.length === 0 && (
                <option value="">
                  {DistributorsError ? "Unavailable" : "Loading..."}
                </option>
              )}
              {Distributors.map((Distributor) => (
                <option key={Distributor.id} value={Distributor.id}>
                  {Distributor.name}
                </option>
              ))}
            </Select>
          )}

          <Input
            id="signup-password"
            label="Password"
            type={ShowPassword ? "text" : "password"}
            value={Password}
            onChange={(Evt) => {
              SetPassword(Evt.target.value);
              clearFieldError("password");
            }}
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters, with a letter and a digit."
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

          <Input
            id="signup-confirm-password"
            label="Confirm password"
            type={ShowPassword ? "text" : "password"}
            value={ConfirmPassword}
            onChange={(Evt) => {
              SetConfirmPassword(Evt.target.value);
              clearFieldError("confirmPassword");
            }}
            autoComplete="new-password"
            minLength={8}
            error={FieldErrors.confirmPassword}
            required
          />

          <Input
            id="signup-contact"
            label="Contact number (optional)"
            type="tel"
            value={ContactNumber}
            onChange={(Evt) => SetContactNumber(Evt.target.value)}
            autoComplete="tel"
          />

          <label
            className="checkbox-row"
            style={{ marginBottom: "var(--space-5)" }}
          >
            <input type="checkbox" required />I agree to the terms of use.
          </label>

          <Button type="submit" variant="primary" block loading={Submitting}>
            {Submitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="auth-card__footer">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
