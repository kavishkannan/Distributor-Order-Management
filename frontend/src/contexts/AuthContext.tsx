import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getMe,
  logout as logoutApi,
  signIn as signInApi,
  signUp as signUpApi,
  SignInInput,
  SignUpInput,
  UserDto,
  UserRole,
} from "../api/auth";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  setUnauthorizedHandler,
  TokenStorageKey,
} from "../api/client";

interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (Input: SignInInput) => Promise<UserDto>;
  signup: (Input: SignUpInput) => Promise<UserDto>;
  logout: () => Promise<void>;
  hasRole: (Role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children: Children }: { children: ReactNode }) {
  const [User, SetUser] = useState<UserDto | null>(null);
  const [IsLoading, SetIsLoading] = useState(true);

  const endLocalSession = useCallback(() => {
    clearStoredToken();
    SetUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(endLocalSession);
    return () => setUnauthorizedHandler(null);
  }, [endLocalSession]);

  useEffect(() => {
    function handleStorage(Event: StorageEvent) {
      if (Event.key === TokenStorageKey && Event.newValue === null)
        SetUser(null);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const Token = getStoredToken();
    if (!Token) {
      SetIsLoading(false);
      return;
    }

    let Cancelled = false;
    getMe()
      .then((Data) => {
        if (!Cancelled) SetUser(Data);
      })
      .catch(() => {
        if (!Cancelled) {
          clearStoredToken();
          SetUser(null);
        }
      })
      .finally(() => {
        if (!Cancelled) SetIsLoading(false);
      });

    return () => {
      Cancelled = true;
    };
  }, []);

  async function login(Input: SignInInput): Promise<UserDto> {
    const Result = await signInApi(Input);
    setStoredToken(Result.token);
    SetUser(Result.user);
    return Result.user;
  }

  async function signup(Input: SignUpInput): Promise<UserDto> {
    const Result = await signUpApi(Input);
    setStoredToken(Result.token);
    SetUser(Result.user);
    return Result.user;
  }

  async function logout(): Promise<void> {
    const Token = getStoredToken();
    if (Token) {
      try {
        await logoutApi(Token);
      } catch {}
    }
    endLocalSession();
  }

  function hasRole(Role: UserRole | UserRole[]): boolean {
    if (!User) return false;
    const Roles = Array.isArray(Role) ? Role : [Role];
    return Roles.includes(User.role);
  }

  return (
    <AuthContext.Provider
      value={{
        user: User,
        isAuthenticated: User !== null,
        isLoading: IsLoading,
        login,
        signup,
        logout,
        hasRole,
      }}
    >
      {Children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const Context = useContext(AuthContext);
  if (!Context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return Context;
}
