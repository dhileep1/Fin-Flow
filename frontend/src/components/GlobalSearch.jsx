import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X, User, Car, Phone, ArrowRight, Loader2, IndianRupee } from 'lucide-react';
import api from '../api/client';

export default function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [filterType, setFilterType] = useState('name');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const debounceRef = useRef(null);
    const navigate = useNavigate();

    /* ── Keyboard shortcut: Ctrl+K / Cmd+K ── */
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape') {
                setOpen(false);
                setQuery('');
                setResults(null);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    /* ── Click outside to close ── */
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
                setResults(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    /* ── Debounced live search ── */
    const runSearch = useCallback(async (q, type) => {
        if (!q || q.trim().length < 2) {
            setResults(null);
            return;
        }
        setLoading(true);
        try {
            const data = await api.search(q.trim(), type);
            setResults(data);
        } catch {
            setResults(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const onQueryChange = (val) => {
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(val, filterType), 350);
    };

    const handleNavigate = (path) => {
        setOpen(false);
        setQuery('');
        setResults(null);
        navigate(path);
    };

    const handleSubmit = () => {
        if (!query.trim()) return;
        handleNavigate('/loans');
    };

    const hasResults = results && (
        results.loans && results.loans.length > 0
    );

    const filterButtons = [
        { key: 'name', label: 'Name', icon: <User size={12} /> },
        { key: 'phone', label: 'Phone', icon: <Phone size={12} /> },
        { key: 'vehicle', label: 'Vehicle', icon: <Car size={12} /> },
    ];

    return (
        <div className="gs-wrapper" ref={containerRef}>
            {/* ── Collapsed trigger ── */}
            {!open && (
                <button
                    className="gs-trigger w-[400px] bg-slate-800 border border-slate-700 text-slate-200 transition-colors hover:bg-slate-700 hover:border-slate-600"
                    onClick={() => {
                        setOpen(true);
                        setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    title="Search (Ctrl+K)"
                    aria-label="Open search"
                    id="global-search-trigger"
                >
                    <SearchIcon size={16} className="text-slate-400" />
                    <span className="gs-trigger-label text-slate-400">Search…</span>
                    <kbd className="gs-kbd">⌘K</kbd>
                </button>
            )}

            {/* ── Expanded search ── */}
            {open && (
                <div className="gs-panel" id="global-search-panel">
                    <div className="gs-input-row">
                        <SearchIcon size={16} className="gs-input-icon" />
                        <input
                            ref={inputRef}
                            className="gs-input"
                            type="text"
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSubmit();
                            }}
                            placeholder="Search loans..."
                            autoFocus
                        />
                        {loading && <Loader2 size={16} className="gs-spinner" />}
                        <button
                            className="gs-close"
                            onClick={() => { setOpen(false); setQuery(''); setResults(null); }}
                            aria-label="Close search"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Results dropdown */}
                    {query.trim().length >= 2 && (
                        <div className="gs-results">
                            {hasResults ? (
                                <>
                                    {results.loans && results.loans.length > 0 && (
                                        <div className="gs-group">
                                            <div className="gs-group-label">Loans</div>
                                            {results.loans.slice(0, 5).map((l) => (
                                                <button
                                                    key={l.id}
                                                    className="gs-result-row"
                                                    onClick={() => handleNavigate(`/loans/${l.id}`)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                                                        <div className="gs-result-avatar gs-result-avatar--loan">
                                                            <Car size={14} />
                                                        </div>
                                                        <div className="gs-result-info">
                                                            <span className="gs-result-name">
                                                                {l.customer?.name || 'Unknown'}
                                                            </span>
                                                            <span className="gs-result-sub">
                                                                {l.vehicle?.vehicleNumber || '—'} · ₹{Number(l.outstandingPrincipal || 0).toLocaleString('en-IN')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {l.needsPayment && (
                                                            <span 
                                                                title="Payment Due" 
                                                                style={{ 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '2px', 
                                                                    fontSize: '10px', 
                                                                    fontWeight: 700, 
                                                                    background: 'rgba(239, 68, 68, 0.1)', 
                                                                    color: '#ef4444', 
                                                                    padding: '2px 6px', 
                                                                    borderRadius: '4px',
                                                                    border: '1px solid rgba(239, 68, 68, 0.2)'
                                                                }}
                                                            >
                                                                <IndianRupee size={10} />
                                                                DUE
                                                            </span>
                                                        )}
                                                        <ArrowRight size={14} className="gs-result-arrow" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : !loading ? (
                                <div className="gs-empty">
                                    <span>No results for "<strong>{query}</strong>"</span>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
