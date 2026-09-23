interface AppLogoProps {
  withTagline?: boolean;
}

export default function AppLogo({ withTagline = true }: AppLogoProps) {
  return (
    <span className="app-logo">
      <span className="app-logo__mark" aria-hidden="true">
        MY
      </span>
      <span className="app-logo__text">
        <span className="app-logo__name">MetaYB</span>
        {withTagline && <span className="app-logo__tag">Order Management</span>}
      </span>
    </span>
  );
}
