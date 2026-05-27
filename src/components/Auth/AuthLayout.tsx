import { Box, Card, CardContent, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
        py: 4,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 460 }} elevation={3}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 700, mb: 1, letterSpacing: '0.05em' }}
          >
            HOSHUTARO
          </Typography>
          <Typography variant="h6" component="h2" sx={{ mb: subtitle ? 0.5 : 3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {subtitle}
            </Typography>
          )}
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}

export default AuthLayout;
