import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Drawer, theme } from 'antd';
import {
  TeamOutlined,
  PlayCircleOutlined,
  InboxOutlined,
  UserOutlined,
  TagsOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import SomiLogo from '../components/SomiLogo';
import useIsMobile from '../hooks/useIsMobile';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { token } = theme.useToken();
  const isMobile = useIsMobile();

  const isAdmin = user?.role === 'admin';

  const menuItems = [
    {
      key: '/patients',
      icon: <TeamOutlined />,
      label: 'Patients',
    },
    {
      key: '/exercises',
      icon: <PlayCircleOutlined />,
      label: 'Exercises',
    },
    {
      key: '/inbox',
      icon: <InboxOutlined />,
      label: 'Inbox',
    },
    ...(isAdmin
      ? [
          {
            key: 'admin',
            icon: <UserOutlined />,
            label: 'Admin',
            children: [
              {
                key: '/admin/users',
                icon: <UserOutlined />,
                label: 'Users',
              },
              {
                key: '/admin/taxonomy',
                icon: <TagsOutlined />,
                label: 'Exercise Labels',
              },
              {
                key: '/admin/audit',
                icon: <AuditOutlined />,
                label: 'Audit Log',
              },
            ],
          },
        ]
      : []),
  ];

  // Determine selected key — for nested admin routes, match the full path
  const selectedKey = location.pathname;

  function handleMenuClick({ key }: { key: string }) {
    navigate(key);
    if (isMobile) setDrawerOpen(false);
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  /* ------------------------------------------------------------------ */
  /* Sidebar content — shared between Sider (desktop) and Drawer (mobile) */
  /* ------------------------------------------------------------------ */
  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'flex-start' : 'center',
          padding: isMobile ? '0 16px' : collapsed ? '0 8px' : '0 16px',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(44, 122, 123, 0.3)',
        }}
      >
        {!isMobile && collapsed ? (
          <SomiLogo size={28} collapsed />
        ) : (
          <SomiLogo size={36} showText />
        )}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={isAdmin ? ['admin'] : []}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </>
  );

  /* Margin left offset for desktop sidebar */
  const siderWidth = collapsed ? 80 : 220;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop: fixed sidebar */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          theme="dark"
          width={220}
          style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}
        >
          {sidebarContent}
        </Sider>
      )}

      {/* Mobile: drawer sidebar */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={260}
          closable={false}
          styles={{
            body: { padding: 0, background: 'var(--somi-navy)' },
            header: { display: 'none' },
          }}
        >
          {/* Close button inside drawer */}
          <div style={{ position: 'absolute', top: 18, right: 12, zIndex: 10 }}>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setDrawerOpen(false)}
              style={{ color: 'rgba(255,255,255,0.65)' }}
            />
          </div>
          {sidebarContent}
        </Drawer>
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : siderWidth,
          transition: 'margin-left 0.2s',
        }}
      >
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: token.colorBgContainer,
            borderBottom: '1px solid #e8e8e8',
            padding: isMobile ? '0 12px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left: menu toggle */}
          {isMobile ? (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ fontSize: 16 }}
            />
          ) : (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
          )}

          {/* Right side: user email + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Text
              ellipsis
              style={{
                fontSize: 13,
                color: 'var(--somi-navy)',
                fontWeight: 500,
                maxWidth: isMobile ? 120 : 240,
              }}
            >
              {user?.email}
            </Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              title="Sign out"
              style={{ color: 'var(--somi-navy)', flexShrink: 0 }}
            />
          </div>
        </Header>

        <Content
          className="somi-content"
          style={{
            margin: isMobile ? 12 : 24,
            padding: isMobile ? 16 : 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 'calc(100vh - 64px - 48px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
