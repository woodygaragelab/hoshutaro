import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Typography,
  useTheme,

  styled,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Avatar,
  Button,
  Fade,
  Grow,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  SmartToy as AIIcon,
  Dashboard as DashboardIcon,
  TableChart as TableIcon,
  ExpandMore as ExpandMoreIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { designTokens } from '../design-system/tokens';

// Types based on design specification
export interface HeaderAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  tooltip: string;
  priority: 'high' | 'medium' | 'low';
  badge?: number | string;
  disabled?: boolean;
  dropdown?: DropdownItem[];
}

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export interface ModernHeaderProps {
  user?: {
    name: string;
    avatar?: string;
    email?: string;
  };
  onAIAssistantToggle: () => void;
  onSettingsOpen: () => void;
  isAIAssistantOpen: boolean;
  title?: string;
  actions?: HeaderAction[];
  notifications?: number;
  onUserMenuClick?: (action: string) => void;
}

// Styled components for minimal design
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  boxShadow: designTokens.shadows.sm,
  borderBottom: `1px solid ${theme.palette.divider}`,
  backdropFilter: 'blur(8px)',
  
  // Minimal height based on design tokens
  '& .MuiToolbar-root': {
    minHeight: designTokens.sizes.header,
    padding: `0 ${designTokens.spacing[6]}`,
    
    [theme.breakpoints.down('md')]: {
      minHeight: designTokens.sizes.headerMobile,
      padding: `0 ${designTokens.spacing[4]}`,
    },
  },
}));

const LogoSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: designTokens.spacing[3],
  flex: '0 0 auto',
}));

const ActionsSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: designTokens.spacing[2],
  marginLeft: 'auto',
  
  [theme.breakpoints.down('md')]: {
    display: 'none', // Hidden on mobile, shown in drawer
  },
}));

const MobileMenuButton = styled(IconButton)(({ theme }) => ({
  display: 'none',
  marginLeft: 'auto',
  
  [theme.breakpoints.down('md')]: {
    display: 'flex',
  },
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: 280,
    backgroundColor: theme.palette.background.paper,
    borderLeft: `1px solid ${theme.palette.divider}`,
  },
}));

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: designTokens.spacing[4],
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const UserSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: designTokens.spacing[2],
  marginLeft: designTokens.spacing[3],
  
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    marginTop: designTokens.spacing[2],
    minWidth: 200,
    borderRadius: designTokens.borderRadius.lg,
    boxShadow: designTokens.shadows.lg,
    border: `1px solid ${theme.palette.divider}`,
  },
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
  position: 'relative',
  transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.inOut}`,
  
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    transform: 'translateY(-1px)',
  },
  
  '&:active': {
    transform: 'translateY(0)',
  },
}));

const ModernHeader: React.FC<ModernHeaderProps> = ({
  user,
  onAIAssistantToggle,
  onSettingsOpen,
  isAIAssistantOpen,
  title = 'HOSHUTARO',
  actions = [],
  notifications = 0,
  onUserMenuClick,
}) => {
  const theme = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownMenus, setDropdownMenus] = useState<{ [key: string]: HTMLElement | null }>({});
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(null);

  // Default actions based on requirements
  const defaultActions: HeaderAction[] = [
    {
      id: 'dashboard',
      icon: <DashboardIcon />,
      label: 'ダッシュボード',
      onClick: () => console.log('Dashboard clicked'),
      tooltip: 'ダッシュボードを表示',
      priority: 'medium',
    },
    {
      id: 'table',
      icon: <TableIcon />,
      label: '星取表',
      onClick: () => console.log('Table clicked'),
      tooltip: '星取表を表示',
      priority: 'high',
    },
    {
      id: 'notifications',
      icon: <NotificationsIcon />,
      label: '通知',
      tooltip: '通知を表示',
      priority: 'medium',
      badge: notifications > 0 ? notifications : undefined,
      dropdown: [
        {
          id: 'view-all',
          label: 'すべての通知を表示',
          onClick: () => console.log('View all notifications'),
        },
        {
          id: 'mark-read',
          label: '既読にする',
          onClick: () => console.log('Mark as read'),
        },
        {
          id: 'settings',
          label: '通知設定',
          onClick: () => console.log('Notification settings'),
          divider: true,
        },
      ],
    },
    {
      id: 'ai-assistant',
      icon: <AIIcon />,
      label: 'AIアシスタント',
      onClick: onAIAssistantToggle,
      tooltip: isAIAssistantOpen ? 'AIアシスタントを閉じる' : 'AIアシスタントを開く',
      priority: 'high',
      badge: isAIAssistantOpen ? '●' : undefined,
    },
    {
      id: 'help',
      icon: <HelpIcon />,
      label: 'ヘルプ',
      tooltip: 'ヘルプとサポート',
      priority: 'low',
      dropdown: [
        {
          id: 'user-guide',
          label: 'ユーザーガイド',
          onClick: () => console.log('User guide'),
        },
        {
          id: 'keyboard-shortcuts',
          label: 'キーボードショートカット',
          onClick: () => console.log('Keyboard shortcuts'),
        },
        {
          id: 'contact-support',
          label: 'サポートに連絡',
          onClick: () => console.log('Contact support'),
          divider: true,
        },
        {
          id: 'about',
          label: 'アプリについて',
          onClick: () => console.log('About'),
        },
      ],
    },
    {
      id: 'settings',
      icon: <SettingsIcon />,
      label: '設定',
      onClick: onSettingsOpen,
      tooltip: '設定を開く',
      priority: 'low',
    },
  ];

  const allActions = [...defaultActions, ...actions];
  
  // Sort actions by priority for mobile display
  const sortedActions = allActions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleDropdownOpen = (actionId: string, event: React.MouseEvent<HTMLElement>) => {
    setDropdownMenus(prev => ({ ...prev, [actionId]: event.currentTarget }));
  };

  const handleDropdownClose = (actionId: string) => {
    setDropdownMenus(prev => ({ ...prev, [actionId]: null }));
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleUserMenuAction = (action: string) => {
    onUserMenuClick?.(action);
    handleUserMenuClose();
  };

  const renderActionButton = (action: HeaderAction, inDrawer = false) => {
    const hasDropdown = action.dropdown && action.dropdown.length > 0;
    const isDropdownOpen = Boolean(dropdownMenus[action.id]);

    if (inDrawer) {
      return (
        <ListItem key={action.id} disablePadding>
          <ListItemButton
            onClick={() => {
              if (action.onClick) {
                action.onClick();
              }
              handleMobileMenuClose();
            }}
            disabled={action.disabled}
          >
            <ListItemIcon>
              {action.badge ? (
                <Badge badgeContent={action.badge} color="error">
                  {action.icon}
                </Badge>
              ) : (
                action.icon
              )}
            </ListItemIcon>
            <ListItemText primary={action.label} />
          </ListItemButton>
        </ListItem>
      );
    }

    const buttonContent = (
      <ActionButton
        onClick={hasDropdown ? (e) => handleDropdownOpen(action.id, e) : action.onClick}
        disabled={action.disabled}
        sx={{
          color: theme.palette.text.primary,
        }}
      >
        {action.badge ? (
          <Badge badgeContent={action.badge} color="error">
            {action.icon}
          </Badge>
        ) : (
          action.icon
        )}
      </ActionButton>
    );

    return (
      <motion.div
        key={action.id}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Tooltip 
          title={action.tooltip} 
          arrow 
          placement="bottom"
          TransitionComponent={Fade}
          TransitionProps={{ timeout: 200 }}
        >
          {buttonContent}
        </Tooltip>
        
        {hasDropdown && (
          <StyledMenu
            anchorEl={dropdownMenus[action.id]}
            open={isDropdownOpen}
            onClose={() => handleDropdownClose(action.id)}
            TransitionComponent={Grow}
            transformOrigin={{ horizontal: 'center', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
          >
            {action.dropdown!.map((item, index) => (
              <React.Fragment key={item.id}>
                {item.divider && index > 0 && <Divider />}
                <MenuItem
                  onClick={() => {
                    item.onClick();
                    handleDropdownClose(action.id);
                  }}
                  disabled={item.disabled}
                  sx={{
                    gap: 1,
                    minHeight: 40,
                  }}
                >
                  {item.icon && <ListItemIcon sx={{ minWidth: 'auto' }}>{item.icon}</ListItemIcon>}
                  <ListItemText primary={item.label} />
                </MenuItem>
              </React.Fragment>
            ))}
          </StyledMenu>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <StyledAppBar position="sticky" elevation={0}>
        <Toolbar>
          <LogoSection>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography
                variant="h6"
                component="h1"
                sx={{
                  fontWeight: designTokens.typography.fontWeight.semibold,
                  fontSize: designTokens.typography.fontSize.xl,
                  color: theme.palette.primary.main,
                }}
              >
                {title}
              </Typography>
            </motion.div>
          </LogoSection>

          {/* Desktop Actions */}
          <ActionsSection>
            <AnimatePresence>
              {sortedActions.map((action) => renderActionButton(action))}
            </AnimatePresence>
          </ActionsSection>

          {/* User Section */}
          {user && (
            <UserSection>
              <Tooltip title="ユーザーメニュー" arrow>
                <Button
                  onClick={handleUserMenuOpen}
                  sx={{
                    textTransform: 'none',
                    color: theme.palette.text.primary,
                    gap: 1,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                  endIcon={<ExpandMoreIcon />}
                >
                  <Avatar
                    src={user.avatar}
                    sx={{ 
                      width: 32, 
                      height: 32,
                      fontSize: '0.875rem',
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {user.name}
                  </Typography>
                </Button>
              </Tooltip>
              
              <StyledMenu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                TransitionComponent={Grow}
              >
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="subtitle2">{user.name}</Typography>
                  {user.email && (
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  )}
                </Box>
                <MenuItem onClick={() => handleUserMenuAction('profile')}>
                  <ListItemIcon><AccountIcon /></ListItemIcon>
                  <ListItemText primary="プロフィール" />
                </MenuItem>
                <MenuItem onClick={() => handleUserMenuAction('settings')}>
                  <ListItemIcon><SettingsIcon /></ListItemIcon>
                  <ListItemText primary="アカウント設定" />
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleUserMenuAction('logout')}>
                  <ListItemText primary="ログアウト" />
                </MenuItem>
              </StyledMenu>
            </UserSection>
          )}

          {/* Mobile Menu Button */}
          <MobileMenuButton
            onClick={handleMobileMenuToggle}
            aria-label="メニューを開く"
          >
            <MenuIcon />
          </MobileMenuButton>
        </Toolbar>
      </StyledAppBar>

      {/* Mobile Drawer Menu */}
      <StyledDrawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={handleMobileMenuClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
      >
        <DrawerHeader>
          <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
            メニュー
          </Typography>
          <IconButton onClick={handleMobileMenuClose} aria-label="メニューを閉じる">
            <CloseIcon />
          </IconButton>
        </DrawerHeader>
        
        <Divider />
        
        <List>
          {sortedActions.map((action) => renderActionButton(action, true))}
        </List>

        {user && (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                ログイン中: {user.name}
              </Typography>
            </Box>
          </>
        )}
      </StyledDrawer>
    </>
  );
};

export default ModernHeader;