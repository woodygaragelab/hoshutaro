# Modern Design System

A comprehensive design system built for the HOSHUTARO application, featuring modern components, consistent theming, and excellent developer experience.

## Features

- 🎨 **Modern Design**: Clean, minimal aesthetic with smooth animations
- 🌓 **Dark/Light Mode**: Automatic theme switching with system preference detection
- 📱 **Responsive**: Mobile-first design with flexible layouts
- ♿ **Accessible**: WCAG compliant with proper focus management
- 🚀 **Performance**: Optimized with React.memo and efficient animations
- 🎯 **TypeScript**: Full type safety and excellent IntelliSense

## Quick Start

```tsx
import React from 'react';
import { ThemeProvider, Button, Card, Typography } from './components/design-system';

function App() {
  return (
    <ThemeProvider>
      <Card padding="medium">
        <Typography variant="h4" gradient>
          Welcome to HOSHUTARO
        </Typography>
        <Button variant="contained" size="medium">
          Get Started
        </Button>
      </Card>
    </ThemeProvider>
  );
}
```

## Components

### Core Components

#### Button
Enhanced button component with loading states, icons, and animations.

```tsx
<Button 
  variant="contained" 
  size="large"
  loading={isLoading}
  icon={<Download />}
  iconPosition="left"
>
  Download Data
</Button>
```

#### Card
Flexible card component with hover effects and interactive states.

```tsx
<Card hover interactive padding="large">
  <Typography variant="h6">Equipment Status</Typography>
  <Typography variant="body2">Current maintenance schedule</Typography>
</Card>
```

#### Typography
Enhanced typography with gradient effects and animations.

```tsx
<Typography variant="h1" gradient animate>
  Modern Design System
</Typography>
```

#### Input
Advanced input component with clear functionality and password toggle.

```tsx
<Input
  label="Search Equipment"
  placeholder="Enter equipment name..."
  clearable
  showPasswordToggle={type === 'password'}
/>
```

### Layout Components

#### Stack
Flexible layout component for arranging elements.

```tsx
<Stack direction="row" spacing={2} align="center" justify="space-between">
  <Typography variant="h6">Title</Typography>
  <Button variant="outlined">Action</Button>
</Stack>
```

#### Grid
Responsive grid system with breakpoint support.

```tsx
<Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={3}>
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</Grid>
```

#### Container
Responsive container with max-width constraints.

```tsx
<Container maxWidth="lg" center padding>
  <Typography variant="h1">Centered Content</Typography>
</Container>
```

### UI Components

#### Badge & Chip
Status indicators and tags.

```tsx
<Badge badgeContent={4} color="primary" variant="pulse">
  <IconButton><Settings /></IconButton>
</Badge>

<Chip label="Active" gradient interactive />
```

#### Avatar
User avatars with status indicators.

```tsx
<Avatar 
  size="large" 
  status="online" 
  interactive
  gradient
>
  JD
</Avatar>
```

## Theme System

### Color Palette
The design system uses a comprehensive color palette with semantic naming:

- **Primary**: Blue tones for main actions and branding
- **Secondary**: Gray tones for secondary elements
- **Success**: Green tones for positive states
- **Warning**: Orange tones for caution states
- **Error**: Red tones for error states
- **Neutral**: Grayscale for text and backgrounds

### Typography Scale
Consistent typography with proper hierarchy:

```tsx
// Font sizes
xs: 12px, sm: 14px, base: 16px, lg: 18px, xl: 20px
2xl: 24px, 3xl: 30px, 4xl: 36px, 5xl: 48px, 6xl: 60px

// Font weights
thin: 100, light: 300, normal: 400, medium: 500
semibold: 600, bold: 700, extrabold: 800, black: 900
```

### Spacing System
8px base unit spacing system:

```tsx
// Spacing values (in rem)
0.5: 2px, 1: 4px, 2: 8px, 3: 12px, 4: 16px
5: 20px, 6: 24px, 8: 32px, 10: 40px, 12: 48px
```

### Design Tokens
Access design tokens programmatically:

```tsx
import { designTokens, getSpacing, getColor } from './components/design-system';

const spacing = getSpacing(4); // 1rem (16px)
const primaryColor = getColor('primary', 600); // #0284c7
```

## Theme Provider

Wrap your app with the ThemeProvider for theme management:

```tsx
import { ThemeProvider } from './components/design-system';

function App() {
  return (
    <ThemeProvider defaultMode="light">
      {/* Your app content */}
    </ThemeProvider>
  );
}
```

### Theme Hook
Use the theme hook for theme control:

```tsx
import { useTheme } from './components/design-system';

function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  
  return (
    <Button onClick={toggleTheme}>
      Switch to {mode === 'light' ? 'dark' : 'light'} mode
    </Button>
  );
}
```

## Animation System

Built-in animations using Framer Motion:

```tsx
// Component animations
<Card animate> // Fade in animation
<Typography animate> // Slide up animation
<Button whileHover={{ scale: 1.02 }}> // Hover animation
```

## Responsive Design

Mobile-first responsive design with breakpoints:

```tsx
// Breakpoints
xs: 0px (mobile)
sm: 600px (tablet)
md: 900px (desktop)
lg: 1200px (large desktop)
xl: 1536px (extra large)
```

## Best Practices

1. **Use semantic components**: Choose components based on their semantic meaning
2. **Consistent spacing**: Use the spacing system for consistent layouts
3. **Proper hierarchy**: Use typography variants to establish clear hierarchy
4. **Accessible colors**: Ensure sufficient contrast ratios
5. **Performance**: Use React.memo for expensive components
6. **Theme consistency**: Use design tokens instead of hardcoded values

## Development

### Adding New Components

1. Create component in `src/components/design-system/`
2. Export from `index.ts`
3. Add to showcase for testing
4. Update documentation

### Testing

Use the DesignSystemShowcase component to test all components:

```tsx
import { DesignSystemShowcase } from './components/design-system';

// View all components in action
<DesignSystemShowcase />
```

## Requirements Compliance

This design system fulfills the following requirements:

- **5.1**: Unified color palette and typography system ✅
- **5.2**: Consistent hover effects and feedback ✅
- **5.3**: Elegant loading animations ✅
- **5.4**: Clear error messages and icons ✅
- **5.5**: Dark mode support ✅

## Migration Guide

To migrate from the old system:

1. Wrap your app with `ThemeProvider`
2. Replace Material-UI components with design system components
3. Update spacing using the new spacing system
4. Use design tokens instead of hardcoded values
5. Test responsive behavior with new breakpoints

## Support

For questions or issues with the design system, refer to the component showcase or check the TypeScript definitions for detailed prop information.