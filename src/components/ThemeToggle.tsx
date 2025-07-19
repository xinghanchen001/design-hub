import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-between w-full px-2 py-2">
      <div className="flex items-center gap-3">
        <Sun
          className={`h-4 w-4 transition-all duration-200 ${
            !isDark ? 'text-brand-primary' : 'text-muted-foreground'
          }`}
        />
        <Switch
          checked={isDark}
          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          className="data-[state=checked]:bg-slate-800 data-[state=unchecked]:bg-brand-accent"
        />
        <Moon
          className={`h-4 w-4 transition-all duration-200 ${
            isDark ? 'text-brand-primary' : 'text-muted-foreground'
          }`}
        />
      </div>
    </div>
  );
}
