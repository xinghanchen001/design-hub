import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Heart, Star, Settings, Check } from 'lucide-react';

export function ColorShowcase() {
  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">
          🌟 New Lime Green Design System
        </h2>
        <p className="text-muted-foreground">
          Vibrant, energetic, and modern color palette
        </p>
      </div>

      {/* Primary Colors Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand-primary" />
            Primary Colors
          </CardTitle>
          <CardDescription>Main brand colors in action</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center space-y-2">
              <div className="w-full h-12 bg-brand-primary rounded-lg shadow-lime"></div>
              <p className="text-xs text-muted-foreground">Primary</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-full h-12 bg-brand-bright rounded-lg"></div>
              <p className="text-xs text-muted-foreground">Bright</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-full h-12 bg-brand-secondary rounded-lg"></div>
              <p className="text-xs text-muted-foreground">Secondary</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-full h-12 bg-brand-accent rounded-lg"></div>
              <p className="text-xs text-muted-foreground">Accent</p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-full h-12 bg-brand-soft rounded-lg"></div>
              <p className="text-xs text-muted-foreground">Soft</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buttons Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-primary" />
            Button Variants
          </CardTitle>
          <CardDescription>
            All button styles with the new color system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button className="hover-lime">
              <Check className="h-4 w-4 mr-2" />
              Primary Button
            </Button>
            <Button variant="secondary">
              <Heart className="h-4 w-4 mr-2" />
              Secondary Button
            </Button>
            <Button
              variant="outline"
              className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-brand-contrast"
            >
              <Star className="h-4 w-4 mr-2" />
              Outline Lime
            </Button>
            <Button
              variant="ghost"
              className="text-brand-primary hover:bg-brand-accent"
            >
              Ghost Lime
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gradients Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gradient-primary rounded"></div>
            Gradient Backgrounds
          </CardTitle>
          <CardDescription>Beautiful gradient combinations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-primary p-6 rounded-lg text-center text-brand-contrast font-semibold">
              Primary Gradient
            </div>
            <div className="bg-gradient-vibrant p-6 rounded-lg text-center text-brand-contrast font-semibold">
              Vibrant Gradient
            </div>
            <div className="bg-gradient-subtle p-6 rounded-lg text-center text-foreground font-semibold">
              Subtle Gradient
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Elements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-brand-primary">
            Interactive Elements
          </CardTitle>
          <CardDescription>
            Badges, tags, and other UI components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-brand-primary text-brand-contrast">
              Active
            </Badge>
            <Badge className="bg-brand-secondary text-white">Processing</Badge>
            <Badge className="bg-brand-accent text-brand-secondary">
              Completed
            </Badge>
            <Badge className="bg-brand-soft text-brand-secondary">Draft</Badge>
          </div>

          <div className="p-4 bg-brand-accent rounded-lg border-l-4 border-brand-primary">
            <p className="text-brand-secondary font-medium">
              🎉 Success Message
            </p>
            <p className="text-brand-secondary/80 text-sm mt-1">
              Your action was completed successfully with the new lime-green
              design!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Animation Demo */}
      <Card className="animate-lime-glow">
        <CardHeader>
          <CardTitle className="text-brand-primary">
            ✨ Animated Glow Effect
          </CardTitle>
          <CardDescription>
            This card demonstrates the new lime-glow animation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This card uses the new{' '}
            <code className="bg-brand-accent text-brand-secondary px-2 py-1 rounded">
              animate-lime-glow
            </code>{' '}
            animation to create a beautiful pulsing effect with the lime-green
            colors.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
