import { useWebTheme } from '@/components/WebThemeProvider';

export default function ThemeModeSwitch() {
  const { themeMode, setThemeMode, theme, isDark } = useWebTheme();
  const options = ['auto', 'light', 'dark'];

  return (
    <div
      style={{
        display: 'inline-flex',
        border: `1px solid ${theme.border}`,
        borderRadius: '999px',
        overflow: 'hidden',
        background: theme.surface,
      }}
    >
      {options.map((option) => {
        const active = themeMode === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setThemeMode(option)}
            style={{
              border: 'none',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'capitalize',
              cursor: 'pointer',
              background: active ? theme.primary : 'transparent',
              color: active ? '#ffffff' : isDark ? theme.textSecondary : theme.textTertiary,
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
