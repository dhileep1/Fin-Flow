import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Upload, X, FileText, Check, Search, Car } from 'lucide-react';

const STEPS = [
    { key: 'customer', label: 'Customer' },
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'guarantor', label: 'Guarantor' },
    { key: 'documents', label: 'Documents' },
    { key: 'loan', label: 'Loan Details' },
];

function formatAadhaar(value) {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
        parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
}

function FileUploadZone({ label, accept, file, onFileChange, onRemove }) {
    const inputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) {
            onFileChange(e.dataTransfer.files[0]);
        }
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    if (file) {
        return (
            <div className="file-preview">
                <div className="file-preview-icon">
                    <FileText size={20} />
                </div>
                <div className="file-preview-info">
                    <div className="file-preview-name">{file.name}</div>
                    <div className="file-preview-size">{formatSize(file.size)}</div>
                </div>
                <button type="button" className="remove-btn" onClick={onRemove} title="Remove file">
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div
            className={`file-upload-zone ${dragActive ? 'drag-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
            <div className="upload-icon">
                <Upload size={22} />
            </div>
            <div className="upload-text">{label}</div>
            <div className="upload-hint">Drag & drop or click to browse · JPG, PNG, PDF</div>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={(e) => onFileChange(e.target.files[0])}
                style={{ display: 'none' }}
            />
        </div>
    );
}

export default function NewLoan() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);

    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [showNewCustomer, setShowNewCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        address: '',
        aadharNumber: '',
    });
    const [creatingCustomer, setCreatingCustomer] = useState(false);

    const [vehicles, setVehicles] = useState([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState('');

    const [showNewVehicle, setShowNewVehicle] = useState(false);
    const [newVehicle, setNewVehicle] = useState({
        vehicleNumber: '',
        model: '',
        engineNumber: '',
        chassisNumber: '',
    });
    const [creatingVehicle, setCreatingVehicle] = useState(false);

    const [loan, setLoan] = useState({
        principalAmount: '',
        tenureMonths: '',
        monthlyInterestRate: '2',
        startDate: new Date().toISOString().slice(0, 10),
    });
    const [creatingLoan, setCreatingLoan] = useState(false);
    const [error, setError] = useState('');

    const [guarantor, setGuarantor] = useState({
        name: '',
        phone: '',
        aadharNumber: '',
        address: '',
    });

    const [rcImageFile, setRcImageFile] = useState(null);
    const [customerPhotoFile, setCustomerPhotoFile] = useState(null);

    const formatCurrency = (amount) =>
        `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    const loadCustomers = async (q) => {
        if (!q || q.length < 2) {
            setCustomerResults([]);
            return;
        }
        setCustomersLoading(true);
        try {
            const data = await api.getCustomers(`q=${encodeURIComponent(q)}`);
            setCustomerResults(data.customers || []);
        } catch (e) {
            console.error('Failed to search customers', e);
        } finally {
            setCustomersLoading(false);
        }
    };

    const handleCustomerSearchChange = (value) => {
        setCustomerQuery(value);
        if (value.length >= 2 || value.length === 0) {
            loadCustomers(value);
        }
    };

    const handleSelectCustomer = async (customer) => {
        setSelectedCustomer(customer);
        setCustomerResults([]);
        setCustomerQuery(customer.name);
        setSelectedVehicleId('');
        setVehicles([]);
        setShowNewCustomer(false);
        setError('');

        setVehiclesLoading(true);
        try {
            const full = await api.getCustomer(customer.id);
            setVehicles(full.vehicles || []);
        } catch (e) {
            console.error('Failed to load customer vehicles', e);
        } finally {
            setVehiclesLoading(false);
        }
    };

    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        setCreatingCustomer(true);
        setError('');
        try {
            const created = await api.createCustomer({
                ...newCustomer,
                aadharNumber: newCustomer.aadharNumber.replace(/\s/g, ''),
            });
            await handleSelectCustomer(created);
            setNewCustomer({ name: '', phone: '', address: '', aadharNumber: '' });
            setShowNewCustomer(false);
        } catch (e) {
            setError(e.message || 'Failed to create customer');
        } finally {
            setCreatingCustomer(false);
        }
    };

    const handleCreateVehicle = async (e) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        setCreatingVehicle(true);
        setError('');
        try {
            const created = await api.createVehicle({
                customerId: selectedCustomer.id,
                vehicleNumber: newVehicle.vehicleNumber,
                model: newVehicle.model || undefined,
                engineNumber: newVehicle.engineNumber || undefined,
                chassisNumber: newVehicle.chassisNumber || undefined,
            });
            const updatedList = [created, ...vehicles];
            setVehicles(updatedList);
            setSelectedVehicleId(created.id);
            setNewVehicle({ vehicleNumber: '', model: '', engineNumber: '', chassisNumber: '' });
            setShowNewVehicle(false);
        } catch (e) {
            setError(e.message || 'Failed to create vehicle');
        } finally {
            setCreatingVehicle(false);
        }
    };

    const handleCreateLoan = async (e) => {
        e.preventDefault();
        if (!selectedCustomer || !selectedVehicleId) {
            setError('Please select customer and vehicle');
            return;
        }
        setCreatingLoan(true);
        setError('');
        try {
            const payload = {
                customerId: selectedCustomer.id,
                vehicleId: selectedVehicleId,
                principalAmount: Number(loan.principalAmount),
                tenureMonths: Number(loan.tenureMonths),
                monthlyInterestRate: Number(loan.monthlyInterestRate) / 100,
                startDate: loan.startDate,
                guarantors: guarantor.name ? [{
                    ...guarantor,
                    aadharNumber: guarantor.aadharNumber.replace(/\s/g, ''),
                }] : [],
            };
            const created = await api.createLoan(payload);
            navigate(`/loans/${created.id}`);
        } catch (e) {
            setError(e.message || 'Failed to create loan');
        } finally {
            setCreatingLoan(false);
        }
    };

    useEffect(() => {
        loadCustomers('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isStepCompleted = (idx) => {
        if (idx === 0) return !!selectedCustomer;
        if (idx === 1) return !!selectedVehicleId;
        if (idx === 2) return true; // optional
        if (idx === 3) return true; // optional
        if (idx === 4) return false;
        return false;
    };

    const canGoNext = () => {
        if (currentStep === 0) return !!selectedCustomer;
        if (currentStep === 1) return !!selectedVehicleId;
        return true;
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">New Loan</h1>
                    <p className="page-subtitle">Create a loan by selecting customer, vehicle, and terms</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="stepper">
                {STEPS.map((step, idx) => (
                    <React.Fragment key={step.key}>
                        <div
                            className={`stepper-step ${idx === currentStep ? 'active' : ''} ${isStepCompleted(idx) && idx < currentStep ? 'completed' : ''}`}
                            onClick={() => setCurrentStep(idx)}
                        >
                            <div className="stepper-step-number">
                                {isStepCompleted(idx) && idx < currentStep ? <Check size={16} /> : idx + 1}
                            </div>
                            <span className="stepper-step-label">{step.label}</span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`stepper-connector ${isStepCompleted(idx) && idx < currentStep ? 'completed' : ''}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {error && (
                <div className="login-error" style={{ marginBottom: 'var(--space-4)' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleCreateLoan}>
                {/* Step 0: Customer */}
                {currentStep === 0 && (
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 style={{ fontWeight: 600 }}>Customer</h3>
                                <p className="text-muted text-sm">Search existing customer or add a new one</p>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowNewCustomer((v) => !v)}
                            >
                                {showNewCustomer ? 'Close new customer' : '＋ New Customer'}
                            </button>
                        </div>

                        <div className="search-bar" style={{ maxWidth: 480, marginBottom: 'var(--space-4)' }}>
                            <span className="search-icon"><Search size={14} /></span>
                            <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={customerQuery}
                                onChange={(e) => handleCustomerSearchChange(e.target.value)}
                            />
                        </div>

                        {customersLoading && <div className="text-muted text-sm">Loading customers…</div>}

                        {!showNewCustomer && customerResults.length > 0 && (
                            <div className="table-container" style={{ marginTop: 'var(--space-3)' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Phone</th>
                                            <th>Loans</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerResults.slice(0, 5).map((c) => (
                                            <tr key={c.id}>
                                                <td style={{ fontWeight: 500 }}>{c.name}</td>
                                                <td className="font-mono">{c.phone}</td>
                                                <td>
                                                    <span className="badge badge-accent">
                                                        {c._count?.loans != null ? c._count.loans : '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-ghost"
                                                        onClick={() => handleSelectCustomer(c)}
                                                    >
                                                        Select
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {showNewCustomer && (
                            <div style={{ marginTop: 'var(--space-4)' }}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Name *</label>
                                        <input
                                            className="form-input"
                                            required
                                            value={newCustomer.name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone *</label>
                                        <input
                                            className="form-input"
                                            required
                                            value={newCustomer.phone}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Aadhaar</label>
                                        <input
                                            className="form-input"
                                            value={newCustomer.aadharNumber}
                                            onChange={(e) =>
                                                setNewCustomer({ ...newCustomer, aadharNumber: formatAadhaar(e.target.value) })
                                            }
                                            placeholder="XXXX XXXX XXXX"
                                            maxLength={14}
                                        />
                                    </div>
                                </div>
                                <div className="form-group mt-4">
                                    <label className="form-label">Address</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={2}
                                        value={newCustomer.address}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowNewCustomer(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={creatingCustomer}
                                        onClick={handleCreateCustomer}
                                    >
                                        {creatingCustomer ? <span className="loading-spinner" /> : 'Create & select'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {selectedCustomer && (
                            <div className="card-glass" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="avatar avatar-md avatar-neutral">
                                        {selectedCustomer.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
                                        <div className="text-sm text-muted">{selectedCustomer.phone}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 1: Vehicle */}
                {currentStep === 1 && (
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 style={{ fontWeight: 600 }}>Vehicle</h3>
                                <p className="text-muted text-sm">Choose an existing vehicle or add a new one</p>
                            </div>
                            <button
                                type="button"
                                className={`btn btn-secondary ${!selectedCustomer ? 'btn-disabled' : ''}`}
                                onClick={() => setShowNewVehicle((v) => !v)}
                                disabled={!selectedCustomer}
                                style={!selectedCustomer ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                            >
                                {showNewVehicle ? 'Close new vehicle' : '＋ New Vehicle'}
                            </button>
                        </div>

                        {!selectedCustomer ? (
                            <div className="empty-state-inline">
                                <div className="empty-icon"><Car size={24} /></div>
                                <div className="empty-title">Select a customer first</div>
                                <div className="empty-desc">
                                    Go back to Step 1 and select or create a customer before adding a vehicle.
                                </div>
                                <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={() => setCurrentStep(0)}>
                                    ← Go to Customer
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="form-group" style={{ maxWidth: 360 }}>
                                    <label className="form-label">Vehicle</label>
                                    <select
                                        className="form-select"
                                        value={selectedVehicleId}
                                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                                    >
                                        <option value="">Select vehicle…</option>
                                        {vehicles.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.vehicleNumber} {v.model ? `· ${v.model}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {vehiclesLoading && (
                                    <div className="text-muted text-sm mt-2">Loading vehicles…</div>
                                )}

                                {showNewVehicle && (
                                    <div style={{ marginTop: 'var(--space-4)' }}>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Vehicle number *</label>
                                                <input
                                                    className="form-input"
                                                    required
                                                    value={newVehicle.vehicleNumber}
                                                    onChange={(e) =>
                                                        setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Model</label>
                                                <input
                                                    className="form-input"
                                                    value={newVehicle.model}
                                                    onChange={(e) =>
                                                        setNewVehicle({ ...newVehicle, model: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Engine #</label>
                                                <input
                                                    className="form-input"
                                                    value={newVehicle.engineNumber}
                                                    onChange={(e) =>
                                                        setNewVehicle({ ...newVehicle, engineNumber: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Chassis #</label>
                                                <input
                                                    className="form-input"
                                                    value={newVehicle.chassisNumber}
                                                    onChange={(e) =>
                                                        setNewVehicle({ ...newVehicle, chassisNumber: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setShowNewVehicle(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                disabled={creatingVehicle}
                                                onClick={handleCreateVehicle}
                                            >
                                                {creatingVehicle ? (
                                                    <span className="loading-spinner" />
                                                ) : (
                                                    'Create & select'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Step 2: Guarantor */}
                {currentStep === 2 && (
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Guarantor Information (Jamin)</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Guarantor Name</label>
                                <input
                                    className="form-input"
                                    value={guarantor.name}
                                    onChange={(e) => setGuarantor({ ...guarantor, name: e.target.value })}
                                    placeholder="Full name of guarantor"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    className="form-input"
                                    value={guarantor.phone}
                                    onChange={(e) => setGuarantor({ ...guarantor, phone: e.target.value })}
                                    placeholder="Phone number"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Aadhaar Number</label>
                                <input
                                    className="form-input"
                                    value={guarantor.aadharNumber}
                                    onChange={(e) => setGuarantor({ ...guarantor, aadharNumber: formatAadhaar(e.target.value) })}
                                    placeholder="XXXX XXXX XXXX"
                                    maxLength={14}
                                />
                            </div>
                        </div>
                        <div className="form-group mt-4">
                            <label className="form-label">Address</label>
                            <textarea
                                className="form-textarea"
                                rows={2}
                                value={guarantor.address}
                                onChange={(e) => setGuarantor({ ...guarantor, address: e.target.value })}
                                placeholder="Current address"
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Documents */}
                {currentStep === 3 && (
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Documents (Optional)</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Vehicle RC Copy</label>
                                <FileUploadZone
                                    label="Upload RC Copy"
                                    accept="image/*,.pdf"
                                    file={rcImageFile}
                                    onFileChange={setRcImageFile}
                                    onRemove={() => setRcImageFile(null)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Customer Photo</label>
                                <FileUploadZone
                                    label="Upload Customer Photo"
                                    accept="image/*"
                                    file={customerPhotoFile}
                                    onFileChange={setCustomerPhotoFile}
                                    onRemove={() => setCustomerPhotoFile(null)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Loan Details */}
                {currentStep === 4 && (
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Loan details</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Principal amount *</label>
                                <div className="input-affix-wrapper has-prefix">
                                    <span className="input-prefix">₹</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        required
                                        value={loan.principalAmount}
                                        onChange={(e) => setLoan({ ...loan, principalAmount: e.target.value })}
                                        placeholder="e.g. 50000"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tenure (months) *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    required
                                    value={loan.tenureMonths}
                                    onChange={(e) => setLoan({ ...loan, tenureMonths: e.target.value })}
                                    placeholder="e.g. 12"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Monthly interest rate *</label>
                                <div className="input-affix-wrapper has-suffix">
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="form-input"
                                        required
                                        value={loan.monthlyInterestRate}
                                        onChange={(e) => setLoan({ ...loan, monthlyInterestRate: e.target.value })}
                                        placeholder="e.g. 2"
                                    />
                                    <span className="input-suffix">%</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Start date *</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    required
                                    value={loan.startDate}
                                    onChange={(e) => setLoan({ ...loan, startDate: e.target.value })}
                                />
                            </div>
                        </div>

                        {loan.principalAmount && loan.tenureMonths && (
                            <div className="card-glass" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)' }}>
                                <div className="text-sm text-muted">Summary (rough)</div>
                                <div className="text-sm">
                                    Principal: <strong>{formatCurrency(loan.principalAmount)}</strong> · Tenure:{' '}
                                    <strong>{loan.tenureMonths} months</strong> · Rate:{' '}
                                    <strong>{loan.monthlyInterestRate}% / month</strong>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation buttons */}
                <div className="flex gap-3" style={{ justifyContent: 'space-between' }}>
                    <div className="flex gap-3">
                        {currentStep > 0 && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setCurrentStep(currentStep - 1)}
                            >
                                ← Previous
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </button>
                    </div>
                    <div className="flex gap-3">
                        {currentStep < STEPS.length - 1 ? (
                            <button
                                type="button"
                                className="btn btn-primary btn-lg"
                                style={{ width: '140px' }}
                                onClick={() => setCurrentStep(currentStep + 1)}
                                disabled={!canGoNext()}
                            >
                                Next →
                            </button>
                        ) : (
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                disabled={creatingLoan}
                            >
                                {creatingLoan ? <span className="loading-spinner" /> : 'Create loan'}
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}
