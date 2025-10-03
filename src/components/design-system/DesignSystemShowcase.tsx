import React from 'react';
import { 
  Box, 
  Divider,
  IconButton,
  Paper
} from '@mui/material';
import { 
  Favorite, 
  Share, 
  Settings, 
  Brightness4, 
  Brightness7,
  Download
} from '@mui/icons-material';
import {
  Button,
  Card,
  Typography,
  Input,
  Badge,
  Chip,
  Avatar,
  Stack,
  Container,
  Grid,
  Spacer,
  Center,
  LoadingSpinner,
  Tooltip,
  useTheme
} from './index';

const DesignSystemShowcase: React.FC = () => {
  const { mode, toggleTheme } = useTheme();
  const [inputValue, setInputValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <Container maxWidth="lg" padding>
      <Stack spacing={4}>
        {/* Header */}
        <Stack direction="row" justify="space-between" align="center">
          <Typography variant="h3" gradient animate>
            Design System Showcase
          </Typography>
          <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton onClick={toggleTheme}>
              {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Typography variant="body1" color="text.secondary">
          A comprehensive showcase of the modern design system components built for the HOSHUTARO application.
        </Typography>

        <Divider />

        {/* Buttons Section */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Buttons
          </Typography>
          <Stack direction="row" spacing={2} wrap>
            <Button variant="contained" size="small">
              Small Button
            </Button>
            <Button variant="contained" size="medium">
              Medium Button
            </Button>
            <Button variant="contained" size="large">
              Large Button
            </Button>
            <Button 
              variant="outlined" 
              icon={<Download />}
              iconPosition="left"
            >
              With Icon
            </Button>
            <Button 
              variant="contained" 
              loading={loading}
              onClick={handleLoadingDemo}
            >
              {loading ? 'Loading...' : 'Click to Load'}
            </Button>
          </Stack>
        </Box>

        {/* Cards Section */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Cards
          </Typography>
          <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={3}>
            <Card hover padding="medium">
              <Stack spacing={2}>
                <Typography variant="h6">Basic Card</Typography>
                <Typography variant="body2" color="text.secondary">
                  This is a basic card with hover effects and smooth animations.
                </Typography>
              </Stack>
            </Card>
            
            <Card interactive padding="medium">
              <Stack spacing={2}>
                <Typography variant="h6">Interactive Card</Typography>
                <Typography variant="body2" color="text.secondary">
                  This card responds to clicks and has interactive states.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Feature" size="small" />
                  <Chip label="Interactive" variant="outlined" size="small" />
                </Stack>
              </Stack>
            </Card>
            
            <Card padding="medium">
              <Stack spacing={2}>
                <Stack direction="row" justify="space-between" align="center">
                  <Typography variant="h6">Card with Actions</Typography>
                  <Badge badgeContent={4} color="primary" size="small">
                    <IconButton size="small">
                      <Settings />
                    </IconButton>
                  </Badge>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Cards can include various actions and badges.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <IconButton size="small">
                    <Favorite />
                  </IconButton>
                  <IconButton size="small">
                    <Share />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          </Grid>
        </Box>

        {/* Typography Section */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Typography
          </Typography>
          <Stack spacing={2}>
            <Typography variant="h1">Heading 1</Typography>
            <Typography variant="h2">Heading 2</Typography>
            <Typography variant="h3">Heading 3</Typography>
            <Typography variant="h4">Heading 4</Typography>
            <Typography variant="h5">Heading 5</Typography>
            <Typography variant="h6">Heading 6</Typography>
            <Typography variant="body1">
              Body 1: This is the primary body text style used throughout the application.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Body 2: This is the secondary body text style, often used for descriptions.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Caption: Small text used for labels and captions.
            </Typography>
          </Stack>
        </Box>

        {/* Inputs Section */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Inputs
          </Typography>
          <Grid columns={{ xs: 1, sm: 2 }} gap={3}>
            <Input
              label="Basic Input"
              placeholder="Enter some text..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input
              label="Clearable Input"
              placeholder="This input can be cleared"
              clearable
            />
            <Input
              label="Password Input"
              type="password"
              placeholder="Enter password"
              showPasswordToggle
            />
            <Input
              label="Error State"
              error
              helperText="This field has an error"
              placeholder="Error example"
            />
          </Grid>
        </Box>

        {/* Chips and Badges Section */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Chips & Badges
          </Typography>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1} wrap>
              <Chip label="Default Chip" />
              <Chip label="Outlined" variant="outlined" />
              <Chip label="Gradient" gradient />
              <Chip label="Interactive" interactive />
              <Chip 
                label="Deletable" 
                onDelete={() => console.log('Delete clicked')} 
              />
            </Stack>
            
            <Stack direction="row" spacing={2} align="center">
              <Badge badgeContent={4} color="primary">
                <Paper sx={{ p: 1 }}>
                  <Typography variant="body2">Primary Badge</Typography>
                </Paper>
              </Badge>
              <Badge badgeContent={99} color="error" size="small">
                <Paper sx={{ p: 1 }}>
                  <Typography variant="body2">Error Badge</Typography>
                </Paper>
              </Badge>
              <Badge variant="dot" color="success">
                <Paper sx={{ p: 1 }}>
                  <Typography variant="body2">Dot Badge</Typography>
                </Paper>
              </Badge>
            </Stack>
          </Stack>
        </Box>

        {/* Avatars Section */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Avatars
          </Typography>
          <Stack direction="row" spacing={2} align="center" wrap>
            <Avatar size="small">S</Avatar>
            <Avatar size="medium">M</Avatar>
            <Avatar size="large">L</Avatar>
            <Avatar size="xlarge" gradient>XL</Avatar>
            <Avatar status="online" interactive>
              <Settings />
            </Avatar>
            <Avatar status="busy" src="/api/placeholder/40/40" />
          </Stack>
        </Box>

        {/* Loading States */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Loading States
          </Typography>
          <Stack spacing={3}>
            <Stack direction="row" spacing={3} align="center">
              <LoadingSpinner size="small" />
              <LoadingSpinner size="medium" />
              <LoadingSpinner size="large" />
            </Stack>
            <LoadingSpinner 
              size="medium" 
              message="Loading your data..." 
            />
          </Stack>
        </Box>

        {/* Layout Examples */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Layout Components
          </Typography>
          
          <Stack spacing={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Stack Layout (Vertical)
              </Typography>
              <Stack spacing={2}>
                <Paper sx={{ p: 1, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  Item 1
                </Paper>
                <Paper sx={{ p: 1, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
                  Item 2
                </Paper>
                <Paper sx={{ p: 1, bgcolor: 'success.light', color: 'success.contrastText' }}>
                  Item 3
                </Paper>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Stack Layout (Horizontal)
              </Typography>
              <Stack direction="row" spacing={2}>
                <Paper sx={{ p: 1, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  Item 1
                </Paper>
                <Paper sx={{ p: 1, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
                  Item 2
                </Paper>
                <Paper sx={{ p: 1, bgcolor: 'success.light', color: 'success.contrastText' }}>
                  Item 3
                </Paper>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Grid Layout
              </Typography>
              <Grid columns={3} gap={2}>
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <Paper 
                    key={item}
                    sx={{ 
                      p: 2, 
                      bgcolor: 'info.light', 
                      color: 'info.contrastText',
                      textAlign: 'center'
                    }}
                  >
                    Grid Item {item}
                  </Paper>
                ))}
              </Grid>
            </Paper>
          </Stack>
        </Box>

        <Spacer size={4} />
        
        <Center>
          <Typography variant="body2" color="text.secondary">
            Design System v1.0 - Built with Material-UI, Framer Motion, and modern design principles
          </Typography>
        </Center>
      </Stack>
    </Container>
  );
};

export default DesignSystemShowcase;