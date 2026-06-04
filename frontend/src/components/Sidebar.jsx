import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    Home,
    FileText,
    PhoneCall, 
    Users, 
    BarChart3, 
    Settings,
    LogOut,
    MessageCircle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import '../styles/sidebar.css';

/* ── Navigation Groups ── */
const primaryNav = [
    { path: '/', label: 'Dashboard', icon: Home, shortcut: 'Alt+D' },
    { path: '/loans', label: 'Loans', icon: FileText, shortcut: 'Alt+L' },
    { path: '/calls', label: 'Call Queue', icon: PhoneCall, shortcut: 'Alt+K' },
    { path: '/whatsapp', label: 'Chat', icon: MessageCircle, shortcut: 'Alt+W' },
    { path: '/customers', label: 'Customers', icon: Users, shortcut: 'Alt+C' },
    { path: '/reports', label: 'Reports', icon: BarChart3, shortcut: 'Alt+R' },
];

const bottomNav = [
    { path: '/admin', label: 'Settings', icon: Settings, shortcut: 'Alt+S' },
];

function NavItem({ item, collapsed, badge }) {
    const Icon = item.icon;
    return (
        <NavLink
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
            aria-label={item.label}
            aria-current={undefined} /* set via className callback below */
            title={collapsed ? undefined : undefined}
        >
            {({ isActive }) => (
                <>
                    <span className="nav-icon" aria-hidden="true">
                        <Icon size={22} />
                    </span>
                    <span className={`nav-label ${collapsed ? 'nav-label-hidden' : ''}`}>
                        {item.label}
                    </span>
                    {collapsed && (
                        <span className="nav-tooltip" role="tooltip">
                            <span className="nav-tooltip-label">{item.label}</span>
                            {item.shortcut && (
                                <span className="nav-tooltip-shortcut">{item.shortcut}</span>
                            )}
                        </span>
                    )}
                    {isActive && <span className="sr-only">(current page)</span>}
                    {badge > 0 && collapsed && (
                        <span className="sidebar-badge" title={`${badge} calls in queue`}>{badge > 99 ? '99+' : badge}</span>
                    )}
                    {badge > 0 && !collapsed && (
                        <span className="sidebar-badge-inline" title={`${badge} calls in queue`}>{badge > 99 ? '99+' : badge}</span>
                    )}
                </>
            )}
        </NavLink>
    );
}

function SidebarSection({ label, items, collapsed, badges }) {
    return (
        <div className="sidebar-section" role="group" aria-label={label}>
            {!collapsed && label && (
                <span className="sidebar-section-label">{label}</span>
            )}
            {collapsed && label && (
                <div className="sidebar-section-divider" />
            )}
            {items.map((item) => (
                <NavItem key={item.path} item={item} collapsed={collapsed} badge={badges?.[item.path]} />
            ))}
        </div>
    );
}

export default function Sidebar({ collapsed, onToggle }) {
    const { logout } = useAuth();
    const navigate = useNavigate();

    // Fetch critical count for notification badges
    const [criticalCount, setCriticalCount] = useState(0);
    useEffect(() => {
        // Sync badge count with actual items in Call Queue
        import('../api/client').then(mod => {
            const api = mod.default;
            api.getCallTasks?.('limit=1').then(data => {
                setCriticalCount(data?.total || 0);
            }).catch(() => {});
        });
    }, []);

    const commBadges = {
        '/calls': criticalCount,
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleKeyDown = (e) => {
        const focusable = e.currentTarget.querySelectorAll(
            'a[href], button:not([disabled])'
        );
        const arr = Array.from(focusable);
        const idx = arr.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            arr[(idx + 1) % arr.length]?.focus();
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            arr[(idx - 1 + arr.length) % arr.length]?.focus();
        }
    };

    return (
        <aside
            className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
            aria-label="Main navigation"
            onKeyDown={handleKeyDown}
        >

            <nav className="sidebar-nav" role="navigation">
                <SidebarSection items={primaryNav} collapsed={collapsed} badges={commBadges} />
            </nav>

            <div className="sidebar-bottom">
                <SidebarSection items={bottomNav} collapsed={collapsed} />

                <div className="sidebar-footer-actions">
                    <button
                        className="nav-item sidebar-logout-btn"
                        onClick={handleLogout}
                        aria-label="Logout"
                        title={collapsed ? undefined : 'Logout'}
                    >
                        <span className="nav-icon" aria-hidden="true">
                            <LogOut size={20} />
                        </span>
                        <span className={`nav-label ${collapsed ? 'nav-label-hidden' : ''}`}>
                            Logout
                        </span>
                        {collapsed && (
                            <span className="nav-tooltip" role="tooltip">
                                <span className="nav-tooltip-label">Logout</span>
                            </span>
                        )}
                    </button>
                </div>

                <button
                    className="sidebar-toggle-btn"
                    onClick={onToggle}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>
        </aside>
    );
}
