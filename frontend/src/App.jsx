import React, { useState, useEffect, useRef } from 'react';
import { db, formatRupee, validateIndianPhone } from './api';

export default function App() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [session, setSession] = useState({ currentUser: null, currentRole: null });
  const [currentView, setCurrentView] = useState('auth-view');
  
  // Tabs
  const [customerTab, setCustomerTab] = useState('kyc');
  const [adminTab, setAdminTab] = useState('verifications');
  
  // Theme
  const [theme, setTheme] = useState('dark');

  // Loaders
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing request...');

  // Database States
  const [stats, setStats] = useState({ totalCustomers: 0, pendingKYC: 0, approvedAgreements: 0, activeBookings: 0, overdueReturns: 0 });
  const [customers, setCustomers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);
  const [customerBookings, setCustomerBookings] = useState([]);
  
  // Filters and Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilterOnly, setRiskFilterOnly] = useState(false);
  const [adminSort, setAdminSort] = useState({ column: 'timestamp', direction: 'desc' });
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');

  // Control flags
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejectionNotesOpen, setRejectionNotesOpen] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  // Auto-sync intervals
  const autoRefreshTimer = useRef(null);

  // ==========================================
  // AUTH PORTAL FORM STATES
  // ==========================================
  const [isRegisterForm, setIsRegisterForm] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authRole, setAuthRole] = useState('customer');
  const [authError, setAuthError] = useState('');

  // Input Field validation states (Errors displayed below fields)
  const [authEmailErr, setAuthEmailErr] = useState(false);
  const [authPasswordErr, setAuthPasswordErr] = useState(false);
  const [authNameErr, setAuthNameErr] = useState(false);
  const [authPhoneErr, setAuthPhoneErr] = useState(false);

  // ==========================================
  // CUSTOMER KYC FORM STATES
  // ==========================================
  const [kycName, setKycName] = useState('');
  const [kycPhone, setKycPhone] = useState('');
  const [kycEmail, setKycEmail] = useState('');
  const [kycAddress, setKycAddress] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [kycFileError, setKycFileError] = useState(false);

  // KYC validation indicators
  const [kycNameErr, setKycNameErr] = useState(false);
  const [kycPhoneErr, setKycPhoneErr] = useState(false);
  const [kycEmailErr, setKycEmailErr] = useState(false);

  // ==========================================
  // CUSTOMER AGREEMENT STATES
  // ==========================================
  const [checkDeposit, setCheckDeposit] = useState(false);
  const [checkDamage, setCheckDamage] = useState(false);
  const [checkTerms, setCheckTerms] = useState(false);
  const [sigText, setSigText] = useState('');
  const [sigTextErr, setSigTextErr] = useState(false);

  // ==========================================
  // ADMIN INVENTORY FORM STATES
  // ==========================================
  const [newDevName, setNewDevName] = useState('');
  const [newDevSerial, setNewDevSerial] = useState('');
  const [newDevRent, setNewDevRent] = useState('');
  const [newDevDeposit, setNewDevDeposit] = useState('');
  const [newDevRentDays, setNewDevRentDays] = useState('7');
  const [newDevCondition, setNewDevCondition] = useState('excellent');
  const [newDevStatus, setNewDevStatus] = useState('available');
  const [inventoryFormErr, setInventoryFormErr] = useState('');

  // Editing states
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editDevName, setEditDevName] = useState('');
  const [editDevSerial, setEditDevSerial] = useState('');
  const [editDevRent, setEditDevRent] = useState('');
  const [editDevDeposit, setEditDevDeposit] = useState('');
  const [editDevRentDays, setEditDevRentDays] = useState('7');
  const [editDevCondition, setEditDevCondition] = useState('excellent');
  const [editDevStatus, setEditDevStatus] = useState('available');
  const [editDevRepairCost, setEditDevRepairCost] = useState('');

  // ==========================================
  // BOOT INITIALIZATION
  // ==========================================
  useEffect(() => {
    // 1. Theme setup
    const savedTheme = localStorage.getItem('ops_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);




  }, []);

  // Update theme helper
  const handleThemeToggle = () => {
    const target = theme === 'dark' ? 'light' : 'dark';
    setTheme(target);
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('ops_theme', target);
  };

  // View routing management and session checks
  const navigateToView = (viewId) => {
    if (viewId === 'admin-view' && session.currentRole !== 'admin') {
      setCurrentView('access-denied-view');
      return;
    }
    setCurrentView(viewId);
  };

  // Synchronise views with state loadings
  useEffect(() => {
    if (currentView === 'customer-view') {
      loadCustomerPortalData();
    } else if (currentView === 'admin-view') {
      loadAdminDashboardData();
    }
  }, [currentView, session.currentUser]);

  // Polling loop logic
  useEffect(() => {
    if (currentView === 'admin-view' && autoRefreshEnabled) {
      autoRefreshTimer.current = setInterval(() => {
        loadAdminDashboardData(true);
      }, 5000);
    } else {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current);
      }
    }
    return () => {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current);
      }
    };
  }, [currentView, autoRefreshEnabled, searchQuery, statusFilter, riskFilterOnly, adminSort]);

  // ==========================================
  // FETCHERS (MOCK SERVICE CODES)
  // ==========================================
  const loadCustomerPortalData = async () => {
    if (!session.currentUser) return;
    setLoading(true);
    setLoadingText('Loading localized customer files...');

    const res = await db.getCustomerDetails(session.currentUser.id);
    setLoading(false);
    if (res.status === 200) {
      const p = res.data.profile;
      setKycName(p.name || '');
      setKycPhone(p.phone || '');
      setKycEmail(p.email || '');
      setKycAddress(p.address || '');
      setUploadedFileName(p.idProofName || '');
      setCustomerBookings(res.data.bookings || []);

      // Load products inventory list as well
      const devRes = await db.getDevices();
      if (devRes.status === 200) {
        setDevices(devRes.data);
      }
    }
  };

  const loadAdminDashboardData = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setLoadingText('Compiling administrative statistics...');
    }

    try {
      const statsRes = await db.getStats();
      if (statsRes.status === 200) {
        setStats(statsRes.data);
      }

      const custRes = await db.getCustomers({
        search: searchQuery,
        status: statusFilter,
        risk: riskFilterOnly
      }, adminSort);

      if (custRes.status === 200) {
        setCustomers(custRes.data);
      }

      const devRes = await db.getDevices(deviceSearchQuery);
      if (devRes.status === 200) {
        setDevices(devRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Toggle Auto-sync alert logger
  const triggerAutoSyncLog = () => {
    db.logConsole('GET', '/api/debug/sync', 200, { status: 'nominal', timestamp: new Date().toISOString() }, 20);
  };

  // Run admin data loaders on filter/search triggers
  useEffect(() => {
    if (currentView === 'admin-view') {
      loadAdminDashboardData(true);
    }
  }, [searchQuery, statusFilter, riskFilterOnly, adminSort, deviceSearchQuery]);

  // ==========================================
  // AUTHENTICATION HANDLERS
  // ==========================================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    // Validations
    let valid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authEmail.trim())) {
      setAuthEmailErr(true);
      valid = false;
    } else {
      setAuthEmailErr(false);
    }

    if (authPassword.length < 6) {
      setAuthPasswordErr(true);
      valid = false;
    } else {
      setAuthPasswordErr(false);
    }

    if (isRegisterForm) {
      if (authName.trim().length < 3) {
        setAuthNameErr(true);
        valid = false;
      } else {
        setAuthNameErr(false);
      }

      if (!validateIndianPhone(authPhone)) {
        setAuthPhoneErr(true);
        valid = false;
      } else {
        setAuthPhoneErr(false);
      }
    }

    if (!valid) return;

    setLoading(true);
    setLoadingText(isRegisterForm ? 'Creating your account...' : 'Authenticating secure credentials...');

    try {
      if (isRegisterForm) {
        // Register Customer or Admin
        if (authRole === 'admin') {
          if (authEmail.trim() !== 'admin@onepoint.com') {
            setAuthError('New administrators must register using the email admin@onepoint.com for this prototype.');
            setLoading(false);
            return;
          }
        }

        const customerId = `cust_${Date.now().toString().slice(-4)}`;
        const payload = {
          name: authName.trim(),
          email: authEmail.trim().toLowerCase(),
          phone: authPhone.trim(),
          address: '',
          idProofName: '',
          password: authPassword.trim()
        };

        const res = await db.updateKYC(customerId, payload);
        setLoading(false);
        if (res.status === 200) {
          const sessionObj = { currentUser: { id: customerId, name: payload.name, email: payload.email }, currentRole: authRole };
          setSession(sessionObj);
          localStorage.setItem('ops_session', JSON.stringify(sessionObj));
          
          if (authRole === 'admin') {
            setCurrentView('admin-view');
          } else {
            setCurrentView('customer-view');
            setCustomerTab('kyc');
          }
        } else {
          setAuthError(res.error || 'Registration failed.');
        }
      } else {
        // Sign In Flow
        if (authEmail.trim() === 'admin@onepoint.com') {
          if (authPassword === 'admin123') {
            setLoading(false);
            const sessionObj = { currentUser: { id: 'admin_001', name: 'Inventory Manager', email: 'admin@onepoint.com' }, currentRole: 'admin' };
            setSession(sessionObj);
            localStorage.setItem('ops_session', JSON.stringify(sessionObj));
            setCurrentView('admin-view');
          } else {
            setLoading(false);
            setAuthError('Invalid administrator credentials.');
          }
        } else {
          // Look up customer
          const res = await db.getCustomers({ search: authEmail.trim() });
          setLoading(false);
          if (res.status !== 200 || !res.data) {
            setAuthError(res.error || 'Failed to fetch customer accounts.');
            return;
          }
          const matched = res.data.find(c => c.email.toLowerCase() === authEmail.trim().toLowerCase());
          
          if (matched) {
            if (matched.password === authPassword.trim()) {
              const sessionObj = { currentUser: matched, currentRole: 'customer' };
              setSession(sessionObj);
              localStorage.setItem('ops_session', JSON.stringify(sessionObj));
              setCurrentView('customer-view');
              setCustomerTab('kyc');
            } else {
              setAuthError('Invalid customer password.');
            }
          } else {
            setAuthError('Email account not found. Click Register above to create a customer profile.');
          }
        }
      }
    } catch (e) {
      setLoading(false);
      setAuthError('Database execution reset. Connection error.');
    }
  };

  const handleLogout = () => {
    setSession({ currentUser: null, currentRole: null });
    localStorage.removeItem('ops_session');
    setCurrentView('auth-view');
    // Clear forms
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthPhone('');
  };

  // Quick grading profiles shortcuts
  const loginQuickAdmin = () => {
    const password = prompt('Enter Administrator Password:');
    if (password === 'admin123') {
      setLoading(true);
      setLoadingText('Entering admin terminal...');
      const sessionObj = { currentUser: { id: 'admin_001', name: 'Inventory Manager', email: 'admin@onepoint.com' }, currentRole: 'admin' };
      setSession(sessionObj);
      localStorage.setItem('ops_session', JSON.stringify(sessionObj));
      setLoading(false);
      setCurrentView('admin-view');
      setAdminTab('verifications');
    } else if (password !== null) {
      alert('Invalid administrator password. Access denied.');
    }
  };

  const handleSelectDevice = async (device) => {
    setLoading(true);
    setLoadingText(`Selecting ${device.name} for rental...`);
    try {
      const res = await db.createMockBooking(session.currentUser.id, device.id);
      setLoading(false);
      if (res.status === 200) {
        alert(`"${device.name}" has been added to your rental selection! Please review the terms and sign the agreement under the "Rental Contract Sign-Off" tab.`);
        loadCustomerPortalData();
      } else {
        alert(`Error selecting device: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      setLoading(false);
      alert(`Failed to select device: ${err.message}`);
    }
  };

  const handleRemoveSelectDevice = async (device) => {
    setLoading(true);
    setLoadingText(`Removing ${device.name} selection...`);
    try {
      const res = await db.removeMockBooking(session.currentUser.id, device.id);
      setLoading(false);
      if (res.status === 200) {
        alert(`"${device.name}" has been removed from your rental selection.`);
        loadCustomerPortalData();
      } else {
        alert(`Error removing device selection: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      setLoading(false);
      alert(`Failed to remove device selection: ${err.message}`);
    }
  };

  // ==========================================
  // CUSTOMER FLOW ACTIONS
  // ==========================================
  const handleKycSubmit = async (e) => {
    e.preventDefault();
    let valid = true;

    if (kycName.trim().length < 3) {
      setKycNameErr(true);
      valid = false;
    } else {
      setKycNameErr(false);
    }

    if (!validateIndianPhone(kycPhone)) {
      setKycPhoneErr(true);
      valid = false;
    } else {
      setKycPhoneErr(false);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(kycEmail.trim())) {
      setKycEmailErr(true);
      valid = false;
    } else {
      setKycEmailErr(false);
    }

    if (!uploadedFileName) {
      setKycFileError(true);
      valid = false;
    } else {
      setKycFileError(false);
    }

    if (!valid) return;

    setLoading(true);
    setLoadingText('Saving Aadhaar/ID profiles securely...');

    const payload = {
      name: kycName.trim(),
      phone: kycPhone.trim(),
      email: kycEmail.trim().toLowerCase(),
      address: kycAddress.trim(),
      idProofName: uploadedFileName
    };

    const res = await db.updateKYC(session.currentUser.id, payload);
    setLoading(false);
    if (res.status === 200) {
      // Sync active session details
      setSession(prev => ({
        ...prev,
        currentUser: { ...prev.currentUser, name: payload.name, email: payload.email }
      }));
      alert('KYC Profile successfully updated!');
      loadCustomerPortalData();
    } else {
      alert(`API Error: ${res.error}`);
    }
  };

  const simulateKycUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFileName(file.name);
      setKycFileError(false);
    }
  };

  const handleAgreementSubmit = async (e) => {
    e.preventDefault();
    if (!checkDeposit || !checkDamage || !checkTerms) {
      alert('You must accept all terms in the electronics rental checklist to proceed.');
      return;
    }

    if (sigText.trim().toLowerCase() !== session.currentUser.name.toLowerCase()) {
      setSigTextErr(true);
      return;
    } else {
      setSigTextErr(false);
    }

    setLoading(true);
    setLoadingText('Logging signed Rupee agreements...');

    const res = await db.submitAgreement(session.currentUser.id, {
      signatureText: sigText.trim(),
      checklistApproved: true
    });
    setLoading(false);

    if (res.status === 200) {
      alert('Rental Contract signed and verified! Handovers approved.');
      loadCustomerPortalData();
      setCustomerTab('bookings');
    } else {
      alert(`Rejection error: ${res.error}`);
    }
  };

  // ==========================================
  // ADMIN OPERATIONS ACTIONS
  // ==========================================
  
  // Sorting Header helper
  const handleSortClick = (columnName) => {
    setAdminSort(prev => {
      const nextDir = prev.column === columnName && prev.direction === 'asc' ? 'desc' : 'asc';
      return { column: columnName, direction: nextDir };
    });
  };

  const openCustomerReviewDrawer = async (cId) => {
    setLoading(true);
    setLoadingText('Retrieving verification audit trail...');

    setRejectionNotesOpen(false);
    setRejectionReasonText('');

    const res = await db.getCustomerDetails(cId);
    setLoading(false);
    if (res.status === 200) {
      setSelectedCustomerDetails(res.data);
      setDrawerOpen(true);
    } else {
      alert('Could not open audit drawer.');
    }
  };

  const handleVerifyKYC = async (action) => {
    if (!selectedCustomerDetails) return;

    if (action === 'reject') {
      if (!rejectionNotesOpen) {
        setRejectionNotesOpen(true);
        return;
      }

      if (rejectionReasonText.trim().length < 5) {
        alert('Please provide a mandatory rejection reason (at least 5 characters).');
        return;
      }
    }

    setLoading(true);
    setLoadingText(action === 'approve' ? 'Verifying profile and unlocking contract...' : 'Registering verification rejection...');

    const res = await db.verifyCustomer(selectedCustomerDetails.profile.id, {
      action,
      reason: rejectionReasonText,
      operator: session.currentUser.name
    });

    setLoading(false);
    if (res.status === 200) {
      alert(`Customer KYC successfully ${action === 'approve' ? 'Approved' : 'Rejected'}.`);
      setDrawerOpen(false);
      loadAdminDashboardData();
    } else {
      alert(`Verification Error: ${res.error}`);
    }
  };

  // Export report
  const handleExportCSV = () => {
    setLoading(true);
    setLoadingText('Exporting checkouts database report...');
    // api.js exportCSV() fetches from MySQL backend and triggers download internally
    db.exportCSV();
    setTimeout(() => setLoading(false), 800);
  };

  const handleManualReminders = () => {
    setWhatsappModalOpen(true);
  };

  const sendWhatsAppReminder = (customer) => {
    const digits = customer.phone.replace(/\D/g, '');
    const phone = digits.length === 10 ? `91${digits}` : digits;
    
    let reasonText = '';
    if (customer.status === 'rejected' && customer.rejectionReason) {
      reasonText = ` Rejection Reason: ${customer.rejectionReason}.`;
    } else if (customer.riskFlags && customer.riskFlags.length > 0) {
      const parsedFlags = Array.isArray(customer.riskFlags) ? customer.riskFlags : JSON.parse(customer.riskFlags);
      if (parsedFlags.length > 0) {
        reasonText = ` Pending checks: ${parsedFlags.map(f => f.replace('SYSTEM: ', '')).join(', ')}.`;
      }
    }
    
    const message = `Hello ${customer.name}, this is a reminder from One Point Solutions to complete your electronics rental KYC registration.${reasonText} Please log in and submit your details at http://127.0.0.1:8080/`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    db.logConsole('POST', `/api/notifications/whatsapp-remind`, 200, {
      message: `WhatsApp click-to-chat reminder triggered for ${customer.name}`,
      phone: customer.phone,
      recipient: customer.name,
      timestamp: new Date().toISOString()
    }, 150);
  };

  // ==========================================
  // ADMIN INVENTORY CRUD METHODS
  // ==========================================
  const handleAddDevice = async (e) => {
    e.preventDefault();
    setInventoryFormErr('');

    if (!newDevName || !newDevSerial || !newDevRent || !newDevDeposit || !newDevRentDays) {
      setInventoryFormErr('All inventory fields are required.');
      return;
    }

    const payload = {
      name: newDevName,
      serialNumber: newDevSerial,
      rentPerDay: newDevRent,
      deposit: newDevDeposit,
      condition: newDevCondition,
      status: newDevStatus,
      rentDays: newDevRentDays
    };

    setLoading(true);
    setLoadingText('Registering new electronic item into inventory...');
    const res = await db.addDevice(payload);
    setLoading(false);

    if (res.status === 200) {
      alert(`Successfully added device "${payload.name}" to inventory.`);
      // Clear form
      setNewDevName('');
      setNewDevSerial('');
      setNewDevRent('');
      setNewDevDeposit('');
      setNewDevRentDays('7');
      setNewDevCondition('excellent');
      setNewDevStatus('available');
      loadAdminDashboardData();
    } else {
      setInventoryFormErr(res.error || 'Inventory write error.');
    }
  };

  const startEditDevice = (d) => {
    setEditingDeviceId(d.id);
    setEditDevName(d.name);
    setEditDevSerial(d.serialNumber);
    setEditDevRent(d.rentPerDay);
    setEditDevDeposit(d.deposit);
    setEditDevCondition(d.condition);
    setEditDevStatus(d.status);
    setEditDevRepairCost(d.repairCost);
    setEditDevRentDays(d.rentDays || '7');
  };

  const handleUpdateDevice = async (e) => {
    e.preventDefault();
    
    const payload = {
      name: editDevName,
      serialNumber: editDevSerial,
      rentPerDay: editDevRent,
      deposit: editDevDeposit,
      condition: editDevCondition,
      status: editDevStatus,
      repairCost: editDevRepairCost,
      rentDays: editDevRentDays
    };

    setLoading(true);
    setLoadingText('Saving product modifications...');
    const res = await db.updateDevice(editingDeviceId, payload);
    setLoading(false);

    if (res.status === 200) {
      alert('Product inventory details updated successfully.');
      setEditingDeviceId(null);
      loadAdminDashboardData();
    } else {
      alert(`Update failed: ${res.error}`);
    }
  };

  const handleDeleteDevice = async (dId) => {
    if (!confirm('Are you sure you want to delete this device from the inventory catalog?')) return;

    setLoading(true);
    setLoadingText('Deleting product from catalog...');
    const res = await db.deleteDevice(dId);
    setLoading(false);

    if (res.status === 200) {
      alert('Product deleted successfully.');
      loadAdminDashboardData();
    } else {
      alert(`Deletion blocked: ${res.error}`);
    }
  };



  // Relational mapping helpers
  const getEnrichedBookingsList = () => {
    if (!selectedCustomerDetails) return [];
    return selectedCustomerDetails.bookings;
  };

  // Render Risk Pills helpers
  const getStatusClass = (status) => {
    switch (status) {
      case 'pending_upload': return 'pending';
      case 'verification_in_progress': return 'verifying';
      case 'approved': return 'approved';
      case 'rejected': return 'rejected';
      default: return 'pending';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending_upload': return 'Pending Upload';
      case 'verification_in_progress': return 'Verification in Progress';
      case 'approved': return 'Approved / Active';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  // Automated notification items compute
  const getWhatsAppReminders = () => {
    const list = [];
    customers.forEach(c => {
      if (c.status === 'pending_upload' && !c.idProofName) {
        list.push({
          id: `w_${c.id}`,
          type: 'warning',
          time: new Date().toLocaleTimeString(),
          body: `Automatic reminder queued for ${c.name}. KYC documents missing.`
        });
      }
      if (c.riskFlags.length > 0) {
        c.riskFlags.forEach((rf, i) => {
          list.push({
            id: `r_${c.id}_${i}`,
            type: rf.includes('Phone') ? 'danger' : 'warning',
            time: new Date().toLocaleTimeString(),
            body: `${c.name}: Flagged for ${rf.replace('SYSTEM: ', '')}`
          });
        });
      }
    });
    return list;
  };

  const remindersList = getWhatsAppReminders();

  return (
    <div className="app-container">
      
      {/* Loading Overlay spinner */}
      <div className={`async-spinner-overlay ${loading ? 'visible' : ''}`}>
        <div className="spinner-circle"></div>
        <div>{loadingText}</div>
      </div>

      {/* Header bar */}
      <header>
        <div className="logo-section">
          <div className="logo-icon">OPS</div>
          <div>
            <h1>One Point Solutions</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-2px' }}>Localized Electronics Rental Portal</p>
          </div>
        </div>
        <div className="nav-actions">
          {session.currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 600 }}>Welcome, {session.currentUser.name || session.currentUser.email}</span>
              <span className={`role-badge ${session.currentRole === 'admin' ? 'admin-badge' : 'customer-badge'}`}>
                {session.currentRole === 'admin' ? 'Inventory Admin' : 'Customer'}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Log Out</button>
            </div>
          )}
          <button onClick={handleThemeToggle} className="theme-toggle-btn" title="Toggle Theme">🌓</button>
        </div>
      </header>

      {/* Main router viewports */}
      <main className="main-view-viewport">
        
        {/* ========================================================
            VIEW 1: SIGN IN / REGISTER
            ======================================================== */}
        {currentView === 'auth-view' && (
          <section className="view-panel active">
            <div className="auth-wrapper">
              <div className="auth-tabs">
                <div 
                  className={`auth-tab ${!isRegisterForm ? 'active' : ''}`}
                  onClick={() => { setIsRegisterForm(false); setAuthError(''); }}
                >
                  Sign In
                </div>
                <div 
                  className={`auth-tab ${isRegisterForm ? 'active' : ''}`}
                  onClick={() => { setIsRegisterForm(true); setAuthError(''); }}
                >
                  Register
                </div>
              </div>

              <div className="auth-header">
                <h2>{isRegisterForm ? 'Create Your Profile' : 'Welcome Back'}</h2>
                <p>{isRegisterForm ? 'Register your details to access our rental services' : 'Access your electronics rental account'}</p>
              </div>

              <form onSubmit={handleAuthSubmit}>
                {isRegisterForm && (
                  <>
                    <div className="form-group">
                      <label htmlFor="auth-name">Full Legal Name *</label>
                      <input 
                        type="text" 
                        id="auth-name" 
                        className={`form-input ${authNameErr ? 'input-error' : ''}`}
                        placeholder="e.g. Rahul Sharma"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                      />
                      <span className={`input-feedback ${authNameErr ? 'visible' : ''}`}>Full legal name is required.</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="auth-phone">Mobile Number *</label>
                      <input 
                        type="text" 
                        id="auth-phone" 
                        className={`form-input ${authPhoneErr ? 'input-error' : ''}`}
                        placeholder="e.g. 9876543210"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                      />
                      <span className={`input-feedback ${authPhoneErr ? 'visible' : ''}`}>Please enter a valid 10-digit mobile number.</span>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label htmlFor="auth-email">Email Address *</label>
                  <input 
                    type="email" 
                    id="auth-email" 
                    className={`form-input ${authEmailErr ? 'input-error' : ''}`}
                    placeholder="name@company.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                  <span className={`input-feedback ${authEmailErr ? 'visible' : ''}`}>Please enter a valid email address.</span>
                </div>

                <div className="form-group">
                  <label htmlFor="auth-password">Password *</label>
                  <input 
                    type="password" 
                    id="auth-password" 
                    className={`form-input ${authPasswordErr ? 'input-error' : ''}`}
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                  <span className={`input-feedback ${authPasswordErr ? 'visible' : ''}`}>Password must be at least 6 characters.</span>
                </div>

                {isRegisterForm && (
                  <div className="form-group">
                    <label htmlFor="auth-role">Register As</label>
                    <select 
                      id="auth-role" 
                      className="form-input"
                      value={authRole}
                      onChange={(e) => setAuthRole(e.target.value)}
                    >
                      <option value="customer">Rental Customer</option>
                      <option value="admin">Rental Admin / Inventory Manager</option>
                    </select>
                  </div>
                )}

                {authError && (
                  <div className="alert-box alert-error" style={{ marginBottom: '20px' }}>
                    <div className="alert-message-content">
                      <h4>Authentication Failed</h4>
                      <p>{authError}</p>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  {isRegisterForm ? 'Register Account' : 'Sign In'}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* ========================================================
            VIEW 2: ACCESS DENIED ROUTE GUARD
            ======================================================== */}
        {currentView === 'access-denied-view' && (
          <section className="view-panel active">
            <div className="auth-wrapper" style={{ textAlign: 'center', maxWidth: '500px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🚫</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '12px', color: 'var(--error)' }}>Access Denied</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                You do not have administrative authorization to view the assets desk. Authenticate with secure credentials.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setIsRegisterForm(false);
                    setAuthEmail('admin@onepoint.com');
                    setAuthPassword('');
                    setCurrentView('auth-view');
                  }}
                >
                  Sign In as Admin
                </button>
                <button className="btn btn-secondary" onClick={() => setCurrentView('auth-view')}>
                  Back to Login
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================
            VIEW 3: CLIENT PORTAL
            ======================================================== */}
        {currentView === 'customer-view' && (
          <section className="view-panel active">
            <div className="portal-layout">
              {/* Customer navigation sidebar */}
              <div className="portal-sidebar">
                <div className="profile-card">
                  <div className="avatar-circle">
                    {session.currentUser?.name ? session.currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AJ'}
                  </div>
                  <div className="profile-info">
                    <h3>{session.currentUser?.name || 'Customer'}</h3>
                    <p>{session.currentUser?.email || 'N/A'}</p>
                  </div>
                  {customers.find(c => c.id === session.currentUser?.id) && (
                    <span className={`status-pill status-${getStatusClass(customers.find(c => c.id === session.currentUser.id).status)}`}>
                      {getStatusLabel(customers.find(c => c.id === session.currentUser.id).status)}
                    </span>
                  )}
                </div>

                <div className="sidebar-nav">
                  <div 
                    className={`nav-link ${customerTab === 'kyc' ? 'active' : ''}`}
                    onClick={() => setCustomerTab('kyc')}
                  >
                    👤 Profile & KYC Submission
                  </div>
                  {(() => {
                    const custRecord = customers.find(c => c.id === session.currentUser?.id);
                    if (custRecord && custRecord.status === 'approved') {
                      return (
                        <>
                          <div 
                            className={`nav-link ${customerTab === 'catalog' ? 'active' : ''}`}
                            onClick={() => setCustomerTab('catalog')}
                          >
                            💻 Browse Inventory Catalog
                          </div>
                          <div 
                            className={`nav-link ${customerTab === 'agreement' ? 'active' : ''}`}
                            onClick={() => setCustomerTab('agreement')}
                          >
                            ✍️ Rental Contract Sign-Off
                          </div>
                          <div 
                            className={`nav-link ${customerTab === 'bookings' ? 'active' : ''}`}
                            onClick={() => setCustomerTab('bookings')}
                          >
                            📦 My Active Bookings
                          </div>
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Customer portal content panels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Timeline Progress */}
                <div className="timeline-card">
                  <h3>Verification Status Timeline</h3>
                  {(() => {
                    const custRecord = customers.find(c => c.id === session.currentUser?.id) || { status: 'pending_upload', signature: '' };
                    const status = custRecord.status;
                    const isSigned = !!custRecord.signature;

                    let step1Cls = 'timeline-step';
                    let step2Cls = 'timeline-step';
                    let step3Cls = 'timeline-step';
                    let step4Cls = 'timeline-step';
                    let step2Label = 'Verification Auditing';

                    if (status === 'pending_upload') {
                      step1Cls += ' active';
                    } else if (status === 'verification_in_progress') {
                      step1Cls += ' completed';
                      step2Cls += ' active';
                    } else if (status === 'rejected') {
                      step1Cls += ' completed';
                      step2Cls += ' rejected';
                      step2Label = 'Verification Rejected';
                    } else if (status === 'approved' && !isSigned) {
                      step1Cls += ' completed';
                      step2Cls += ' completed';
                      step3Cls += ' active';
                    } else if (status === 'approved' && isSigned) {
                      step1Cls += ' completed';
                      step2Cls += ' completed';
                      step3Cls += ' completed';
                      step4Cls += ' active';
                    }

                    return (
                      <div className="timeline-tracker">
                        <div className={step1Cls}>
                          <div className="step-node">1</div>
                          <div className="step-label">KYC Profile Saved</div>
                        </div>
                        <div className={step2Cls}>
                          <div className="step-node">2</div>
                          <div className="step-label">{step2Label}</div>
                        </div>
                        <div className={step3Cls}>
                          <div className="step-node">3</div>
                          <div className="step-label">Agreement Unlocked</div>
                        </div>
                        <div className={step4Cls}>
                          <div className="step-node">4</div>
                          <div className="step-label">Rentals Active</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Localised warning conditional display boxes */}
                {(() => {
                  const cr = customers.find(c => c.id === session.currentUser?.id);
                  if (!cr) return null;

                  if (cr.status === 'rejected') {
                    return (
                      <div className="alert-box alert-error">
                        <div className="alert-message-content">
                          <h4>❌ Application Verification Failed</h4>
                          <p><strong>Reason:</strong> {cr.rejectionReason || 'No reason provided.'}</p>
                          <p style={{ marginTop: '8px', fontSize: '0.8rem', textDecoration: 'underline' }}>Please update your details or upload a clearer Government ID proof scan and re-submit.</p>
                        </div>
                      </div>
                    );
                  } else if (cr.status === 'verification_in_progress') {
                    return (
                      <div className="alert-box alert-warning">
                        <div className="alert-message-content">
                          <h4>⏳ Documents Under Verification</h4>
                          <p>Our verification officers are reviewing your documents. The contract terms will unlock immediately upon verification approval.</p>
                        </div>
                      </div>
                    );
                  } else if (cr.status === 'approved' && !cr.signature) {
                    return (
                      <div className="alert-box alert-success">
                        <div className="alert-message-content">
                          <h4>✍️ KYC Verification Approved!</h4>
                          <p>Please navigate to the <strong>Rental Contract Sign-Off</strong> tab to accept security checklist terms and digitally sign the contract.</p>
                        </div>
                      </div>
                    );
                  } else if (cr.status === 'approved' && cr.signature) {
                    return (
                      <div className="alert-box alert-success">
                        <div className="alert-message-content">
                          <h4>✅ Agreement Active</h4>
                          <p>Your legal contract is executed. Renting devices is active. View items under the <strong>My Active Bookings</strong> tab.</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Sub Tab 3.1: Profile & KYC Submission */}
                {customerTab === 'kyc' && (
                  <div className="data-panel-card" style={{ padding: '28px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '8px' }}>KYC Registration File</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Fill in your details to complete security registration.</p>

                    <form onSubmit={handleKycSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                          <label htmlFor="kyc-name">Full Legal Name *</label>
                          <input 
                            type="text" 
                            id="kyc-name" 
                            className={`form-input ${kycNameErr ? 'input-error' : ''}`}
                            value={kycName}
                            onChange={(e) => setKycName(e.target.value)}
                            required
                          />
                          <span className={`input-feedback ${kycNameErr ? 'visible' : ''}`}>Legal name must be entered.</span>
                        </div>
                        
                        <div className="form-group">
                          <label htmlFor="kyc-phone">Phone Number (+91 / Mobile) *</label>
                          <input 
                            type="text" 
                            id="kyc-phone" 
                            className={`form-input ${kycPhoneErr ? 'input-error' : ''}`}
                            placeholder="e.g. 9876543210"
                            value={kycPhone}
                            onChange={(e) => setKycPhone(e.target.value)}
                            required
                          />
                          <span className={`input-feedback ${kycPhoneErr ? 'visible' : ''}`}>Please enter a valid 10-digit phone number.</span>
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="kyc-email">Email Address *</label>
                        <input 
                          type="email" 
                          id="kyc-email" 
                          className={`form-input ${kycEmailErr ? 'input-error' : ''}`}
                          value={kycEmail}
                          onChange={(e) => setKycEmail(e.target.value)}
                          required
                        />
                        <span className={`input-feedback ${kycEmailErr ? 'visible' : ''}`}>Please enter a valid email address.</span>
                      </div>

                      <div className="form-group">
                        <label htmlFor="kyc-address">Physical Delivery Address</label>
                        <input 
                          type="text" 
                          id="kyc-address" 
                          className="form-input" 
                          placeholder="House No, Suite, Street, City, State, Pin Code"
                          value={kycAddress}
                          onChange={(e) => setKycAddress(e.target.value)}
                        />
                        <span className="cell-secondary">Leaving address empty triggers a system risk flag.</span>
                      </div>

                      <div className="form-group">
                        <label>Government-issued ID Scan (Aadhaar / Passport / Voter ID) *</label>
                        <div className="upload-container" onClick={() => document.getElementById('kyc-file-picker').click()}>
                          <div className="upload-icon">📂</div>
                          <p style={{ fontWeight: 600 }}>Click to select files to simulate upload</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>PDF, PNG, JPG accepted (Max 5MB)</p>
                          {uploadedFileName && (
                            <div className="upload-feedback">
                              Uploaded File: <strong>{uploadedFileName}</strong> (Secure Government Vault)
                            </div>
                          )}
                          <input 
                            type="file" 
                            id="kyc-file-picker" 
                            style={{ display: 'none' }}
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={simulateKycUpload}
                          />
                        </div>
                        <span className={`input-feedback ${kycFileError ? 'visible' : ''}`}>A government ID document proof is required.</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button type="submit" className="btn btn-primary">Submit KYC File</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Sub Tab 3.2: Browse Products Catalog */}
                {customerTab === 'catalog' && customers.find(c => c.id === session.currentUser?.id)?.status === 'approved' && (
                  <div className="data-panel-card" style={{ padding: '28px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '8px' }}>One Point Solutions - Electronics Catalog</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Explore available professional electronics. Handovers are active upon KYC contract execution.</p>

                    <div className="products-catalog-grid">
                      {devices.map(d => {
                        let statusCls = 'status-approved';
                        let statusLbl = 'Available';
                        if (d.status === 'rented') {
                          statusCls = 'status-rejected';
                          statusLbl = 'Rented Out';
                        } else if (d.status === 'repair') {
                          statusCls = 'status-pending';
                          statusLbl = 'In Maintenance';
                        }

                        // Determine emoji
                        let emoji = '💻';
                        if (d.name.includes('Camera')) emoji = '📷';
                        else if (d.name.includes('Projector')) emoji = '📽️';
                        else if (d.name.includes('Console')) emoji = '🔊';
                        else if (d.name.includes('iPad') || d.name.includes('Tablet')) emoji = '📱';

                        return (
                          <div className="product-card" key={d.id}>
                            <div className="product-card-header">
                              <div className="product-emoji">{emoji}</div>
                              <span className={`status-pill ${statusCls}`} style={{ fontSize: '0.7rem' }}>{statusLbl}</span>
                            </div>
                            <div style={{ marginTop: '8px' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{d.name}</h4>
                              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>Serial: {d.serialNumber}</p>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>Condition: <strong style={{ textTransform: 'capitalize' }}>{d.condition}</strong></p>
                            </div>
                            
                            <div className="product-pricing">
                              <div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Daily Rent</span>
                                <span className="product-price-value">{formatRupee(d.rentPerDay)}</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Security Deposit</span>
                                <strong>{formatRupee(d.deposit)}</strong>
                              </div>
                            </div>
                            
                            {customerBookings.some(b => b.deviceId === d.id && b.returnStatus !== 'returned') ? (
                              <button 
                                className="btn btn-danger btn-sm" 
                                style={{ marginTop: '14px', width: '100%', display: 'block' }}
                                onClick={() => handleRemoveSelectDevice(d)}
                              >
                                🗑️ Remove for Rent
                              </button>
                            ) : d.status === 'available' ? (
                              <button 
                                className="btn btn-primary btn-sm" 
                                style={{ marginTop: '14px', width: '100%', display: 'block' }}
                                onClick={() => handleSelectDevice(d)}
                              >
                                ➕ Select for Rent
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub Tab 3.3: Agreement Checklist & Sign */}
                {customerTab === 'agreement' && customers.find(c => c.id === session.currentUser?.id)?.status === 'approved' && (
                  <div className="data-panel-card" style={{ padding: '28px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Rupee Rental Terms & Contract Execution</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Review high-value risks and sign details below to authorize rentals.</p>

                    {/* Display Selected Products in Agreement */}
                    <div style={{ marginBottom: '24px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <h4 style={{ fontFamily: 'var(--font-display)', marginBottom: '12px', color: 'var(--primary)', fontSize: '1.05rem' }}>Selected Products in this Agreement:</h4>
                      {(() => {
                        const pendingSelected = customerBookings.filter(b => {
                          const dev = devices.find(d => d.id === b.deviceId);
                          return dev && dev.status === 'available';
                        });

                        if (pendingSelected.length === 0) {
                          return (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              No products selected yet. Go to the <strong>Browse Inventory Catalog</strong> tab to select devices.
                            </p>
                          );
                        }

                        const totalRent = pendingSelected.reduce((sum, b) => {
                          const dev = devices.find(d => d.id === b.deviceId);
                          return sum + (dev ? dev.rentPerDay : 0);
                        }, 0);

                        const totalDeposit = pendingSelected.reduce((sum, b) => {
                          const dev = devices.find(d => d.id === b.deviceId);
                          return sum + (dev ? dev.deposit : 0);
                        }, 0);

                        return (
                          <div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                              {pendingSelected.map(b => {
                                const dev = devices.find(d => d.id === b.deviceId) || { name: 'Device', rentPerDay: 0, deposit: 0 };
                                return (
                                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', padding: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                                    <div>
                                      <strong>{dev.name}</strong>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Serial: {dev.serialNumber}</span>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                                      <div>Rent: {formatRupee(dev.rentPerDay)}/day</div>
                                      <div style={{ color: 'var(--text-muted)' }}>Deposit: {formatRupee(dev.deposit)}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.95rem', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                              <span>Total Estimates:</span>
                              <span>Rent: {formatRupee(totalRent)}/day | Deposit: {formatRupee(totalDeposit)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="agreement-notices-container">
                      <div className="alert-box alert-warning">
                        <div className="alert-message-content">
                          <h4>⚠️ HIGH-VALUE SECURITY CHECKS</h4>
                          <p>Equipment checkout values exceed standard limits. A fully refundable security deposit hold is placed in Rupees (INR) for each device checked out.</p>
                        </div>
                      </div>
                      <div className="alert-box alert-warning">
                        <div className="alert-message-content">
                          <h4>🔨 FAULT DIAGNOSTICS CLAUSE</h4>
                          <p>The client agrees to log physical faults on the device within 12 hours of delivery. Negligence charges are billed to the cards on file.</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleAgreementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <label className="checkbox-group">
                        <input type="checkbox" checked={checkDeposit} onChange={(e) => setCheckDeposit(e.target.checked)} required />
                        <div>
                          <strong>I agree to security deposit reserves</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>I authorize holds according to the inventory deposit schedule listed in Rupees.</p>
                        </div>
                      </label>

                      <label className="checkbox-group">
                        <input type="checkbox" checked={checkDamage} onChange={(e) => setCheckDamage(e.target.checked)} required />
                        <div>
                          <strong>I accept full responsibility for diagnostics checkouts</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>I agree to capture damage pictures and logs before returning equipment.</p>
                        </div>
                      </label>

                      <label className="checkbox-group">
                        <input type="checkbox" checked={checkTerms} onChange={(e) => setCheckTerms(e.target.checked)} required />
                        <div>
                          <strong>I accept terms of use & late penalty rules</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Late returns trigger reminders and 10% daily base rental surcharges.</p>
                        </div>
                      </label>

                      <div className="signature-box-container">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label htmlFor="sig-text">Digital Signature (Type Full Legal Name) *</label>
                          <input 
                            type="text" 
                            id="sig-text" 
                            className={`form-input ${sigTextErr ? 'input-error' : ''}`}
                            placeholder="e.g. Rahul Sharma"
                            style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem' }}
                            value={sigText}
                            onChange={(e) => setSigText(e.target.value)}
                            required
                          />
                          <span className={`input-feedback ${sigTextErr ? 'visible' : ''}`}>Signature name must exactly match your KYC legal name (Case Insensitive).</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button type="submit" className="btn btn-primary">Sign Agreement & Unlock Inventory</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Sub Tab 3.4: Active Bookings */}
                {customerTab === 'bookings' && customers.find(c => c.id === session.currentUser?.id)?.status === 'approved' && (
                  <div className="data-panel-card" style={{ padding: '28px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '8px' }}>My Active Rentals & Returns Tracker</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Active electronics and scheduled delivery/return logs.</p>

                    {(() => {
                      const activeBookings = customerBookings.filter(b => b.returnStatus !== 'returned');

                      if (activeBookings.length === 0) {
                        return (
                          <div className="empty-placeholder">
                            <div className="empty-placeholder-icon">📦</div>
                            <h4>No Rental Shipments Allocated</h4>
                            <p>Once KYC checks are Approved and signed, administrators can assign device serials.</p>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {activeBookings.map(b => {
                            const dev = devices.find(d => d.id === b.deviceId) || { name: 'Device', serialNumber: 'N/A' };
                            const isOverdue = b.returnStatus === 'overdue';
                            return (
                              <div className="alert-box" style={{ borderColor: isOverdue ? 'var(--error)' : 'var(--border-color)', flexDirection: 'column', width: '100%', gap: '10px' }} key={b.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                                  <div>
                                    <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{dev.name}</strong>
                                    <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Serial: {dev.serialNumber}</p>
                                  </div>
                                  <span className={`status-pill ${isOverdue ? 'status-rejected' : 'status-approved'}`}>
                                    {isOverdue ? 'Overdue Return Penalty' : 'Rented & Active'}
                                  </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%', fontSize: '0.8rem' }}>
                                  <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Date Rent Start</span>
                                    <strong>{b.startDate}</strong>
                                  </div>
                                  <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Due Return Date</span>
                                    <strong style={{ color: isOverdue ? 'var(--error)' : 'inherit' }}>{b.endDate}</strong>
                                  </div>
                                  <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Ref Deposit Held</span>
                                    <strong>{formatRupee(b.deposit)}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

              </div>
            </div>
          </section>
        )}

        {/* ========================================================
            VIEW 4: ADMIN DASHBOARD
            ======================================================== */}
        {currentView === 'admin-view' && (
          <section className="view-panel active">
            {/* Stats grid */}
            <div className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--primary)' }}>👤</div>
                <div className="stat-info">
                  <h4>Total Customers</h4>
                  <div className="stat-number">{stats.totalCustomers}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--accent)' }}>⏳</div>
                <div className="stat-info">
                  <h4>Pending KYC</h4>
                  <div className="stat-number">{stats.pendingKYC}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--success)' }}>📄</div>
                <div className="stat-info">
                  <h4>Approved Agreements</h4>
                  <div className="stat-number">{stats.approvedAgreements}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon" style={{ color: '#60a5fa' }}>📦</div>
                <div className="stat-info">
                  <h4>Active Bookings</h4>
                  <div className="stat-number">{stats.activeBookings}</div>
                </div>
              </div>

              <div className="stat-card" style={{ borderBottom: '3px solid var(--error)' }}>
                <div className="stat-icon" style={{ color: 'var(--error)' }}>🚨</div>
                <div className="stat-info">
                  <h4>Overdue Returns</h4>
                  <div className="stat-number">{stats.overdueReturns}</div>
                </div>
              </div>
            </div>

            {/* Admin Tabs */}
            <div className="admin-tab-bar">
              <div 
                className={`admin-tab ${adminTab === 'verifications' ? 'active' : ''}`}
                onClick={() => setAdminTab('verifications')}
              >
                👤 KYC & Verifications
              </div>
              <div 
                className={`admin-tab ${adminTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setAdminTab('inventory')}
              >
                💻 Inventory Management
              </div>
            </div>

            {/* Split layout */}
            <div className="admin-split-layout">
              
              {/* TAB 4.1: CUSTOMER VERIFICATIONS */}
              {adminTab === 'verifications' && (
                <div className="data-panel-card">
                  <div className="card-header">
                    <div className="card-title">
                      <h3>Aadhaar KYC & Rental Operations</h3>
                      <p>Click any row to open the verification audit details drawer</p>
                    </div>

                    <div className="table-filters">
                      <div className="search-input-wrapper">
                        <span className="search-icon-inside">🔍</span>
                        <input 
                          type="text" 
                          className="search-input" 
                          placeholder="Search customer name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      <select 
                        className="form-input" 
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="">All Statuses</option>
                        <option value="pending_upload">Pending Upload</option>
                        <option value="verification_in_progress">Verification in Progress</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                        <input 
                          type="checkbox" 
                          checked={riskFilterOnly}
                          onChange={(e) => setRiskFilterOnly(e.target.checked)}
                        /> 
                        Risk Flags Only
                      </label>

                      <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>📥 Export Handover CSV</button>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table className="ops-data-table">
                      <thead>
                        <tr>
                          <th onClick={() => handleSortClick('name')}>
                            Customer Name {adminSort.column === 'name' && (adminSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th>Target Device / Serial</th>
                          <th onClick={() => handleSortClick('timestamp')}>
                            Time Submitted {adminSort.column === 'timestamp' && (adminSort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                          <th>Status</th>
                          <th>Risk Assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map(c => {
                          const formattedTime = new Date(c.timestamp).toLocaleString();
                          const hasRisks = c.riskFlags.length > 0;
                          return (
                            <tr key={c.id} onClick={() => openCustomerReviewDrawer(c.id)}>
                              <td className="cell-primary">{c.name || 'Anonymous User'}</td>
                              <td>
                                <span className="cell-primary" style={{ display: 'block' }}>{c.targetDevice}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.serialNumber}</span>
                              </td>
                              <td className="cell-secondary">{formattedTime}</td>
                              <td>
                                <span className={`status-pill status-${getStatusClass(c.status)}`}>
                                  {getStatusLabel(c.status)}
                                </span>
                              </td>
                              <td>
                                {hasRisks ? (
                                  c.riskFlags.map((rf, idx) => (
                                    <span className="risk-tag" key={idx}>⚠️ {rf.replace('SYSTEM: ', '')}</span>
                                  ))
                                ) : (
                                  <span className="risk-tag clean">🛡️ Low Risk</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {customers.length === 0 && (
                      <div className="empty-placeholder">
                        <div className="empty-placeholder-icon">📭</div>
                        <h4>No Customer Records Match</h4>
                        <p>Adjust your search query or status filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4.2: INVENTORY MANAGEMENT */}
              {adminTab === 'inventory' && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '20px' }}>
                  
                  {/* Add Device Form */}
                  <div className="inventory-form-card">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>Add New Product to Inventory</h3>
                    
                    <form onSubmit={handleAddDevice} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Device Name *</label>
                        <input type="text" className="form-input" placeholder="e.g. Red Komodo 6K" value={newDevName} onChange={(e) => setNewDevName(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Serial Number *</label>
                        <input type="text" className="form-input" placeholder="e.g. OPS-RED-112" value={newDevSerial} onChange={(e) => setNewDevSerial(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Daily Rent Price (₹) *</label>
                        <input type="number" className="form-input" placeholder="e.g. 1500" value={newDevRent} onChange={(e) => setNewDevRent(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Refundable Deposit (₹) *</label>
                        <input type="number" className="form-input" placeholder="e.g. 10000" value={newDevDeposit} onChange={(e) => setNewDevDeposit(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Rent Period (Days) *</label>
                        <input type="number" className="form-input" placeholder="e.g. 7" value={newDevRentDays} onChange={(e) => setNewDevRentDays(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Initial Condition</label>
                        <select className="form-input" value={newDevCondition} onChange={(e) => setNewDevCondition(e.target.value)}>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="damaged">Damaged</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Status</label>
                        <select className="form-input" value={newDevStatus} onChange={(e) => setNewDevStatus(e.target.value)}>
                          <option value="available">Available</option>
                          <option value="rented">Rented</option>
                          <option value="repair">In Maintenance</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {inventoryFormErr && <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: '8px' }}>{inventoryFormErr}</span>}
                        <button type="submit" className="btn btn-primary" style={{ height: '44px' }}>Add Product</button>
                      </div>
                    </form>
                  </div>

                  {/* Active Inventory Products Table */}
                  <div className="data-panel-card">
                    <div className="card-header">
                      <div className="card-title">
                        <h3>OPS Active Electronics Catalog ({devices.length} items)</h3>
                        <p>Search and inline edit active parameters in Rupee values.</p>
                      </div>
                      <div className="search-input-wrapper">
                        <span className="search-icon-inside">🔍</span>
                        <input 
                          type="text" 
                          className="search-input" 
                          placeholder="Search products..."
                          value={deviceSearchQuery}
                          onChange={(e) => setDeviceSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="table-wrapper">
                      <table className="ops-data-table">
                        <thead>
                          <tr>
                            <th>Device Name</th>
                            <th>Serial Key</th>
                            <th>Rent / Day</th>
                            <th>Refundable Deposit</th>
                            <th>Rent Days</th>
                            <th>Condition</th>
                            <th>Status</th>
                            <th>Repair Costs</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {devices.map(d => {
                            const isEditing = editingDeviceId === d.id;
                            if (isEditing) {
                              return (
                                <tr key={d.id} style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                                  <td><input type="text" className="form-input" style={{ padding: '6px' }} value={editDevName} onChange={(e) => setEditDevName(e.target.value)} /></td>
                                  <td><input type="text" className="form-input" style={{ padding: '6px' }} value={editDevSerial} onChange={(e) => setEditDevSerial(e.target.value)} /></td>
                                  <td><input type="number" className="form-input" style={{ padding: '6px', width: '90px' }} value={editDevRent} onChange={(e) => setEditDevRent(e.target.value)} /></td>
                                  <td><input type="number" className="form-input" style={{ padding: '6px', width: '90px' }} value={editDevDeposit} onChange={(e) => setEditDevDeposit(e.target.value)} /></td>
                                  <td><input type="number" className="form-input" style={{ padding: '6px', width: '70px' }} value={editDevRentDays} onChange={(e) => setEditDevRentDays(e.target.value)} /></td>
                                  <td>
                                    <select className="form-input" style={{ padding: '6px' }} value={editDevCondition} onChange={(e) => setEditDevCondition(e.target.value)}>
                                      <option value="excellent">Excellent</option>
                                      <option value="good">Good</option>
                                      <option value="fair">Fair</option>
                                      <option value="damaged">Damaged</option>
                                    </select>
                                  </td>
                                  <td>
                                    <select className="form-input" style={{ padding: '6px' }} value={editDevStatus} onChange={(e) => setEditDevStatus(e.target.value)}>
                                      <option value="available">Available</option>
                                      <option value="rented">Rented</option>
                                      <option value="repair">In Maintenance</option>
                                    </select>
                                  </td>
                                  <td><input type="number" className="form-input" style={{ padding: '6px', width: '90px' }} value={editDevRepairCost} onChange={(e) => setEditDevRepairCost(e.target.value)} /></td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button className="btn btn-primary btn-sm" onClick={handleUpdateDevice}>Save</button>
                                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingDeviceId(null)}>Cancel</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={d.id}>
                                <td className="cell-primary">{d.name}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{d.serialNumber}</td>
                                <td>{formatRupee(d.rentPerDay)}</td>
                                <td>{formatRupee(d.deposit)}</td>
                                <td>{d.rentDays || 7} Days</td>
                                <td style={{ textTransform: 'capitalize' }}>{d.condition}</td>
                                <td>
                                  <span className={`status-pill status-${d.status === 'available' ? 'approved' : (d.status === 'rented' ? 'rejected' : 'pending')}`}>
                                    {d.status === 'available' ? 'Available' : (d.status === 'rented' ? 'Rented' : 'Maintenance')}
                                  </span>
                                </td>
                                <td style={{ color: d.repairCost > 0 ? 'var(--error)' : 'inherit' }}>{d.repairCost > 0 ? formatRupee(d.repairCost) : '₹0'}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => startEditDevice(d)}>✍️ Edit</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDevice(d.id)}>🗑️ Delete</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sidebar Automation Section */}
              <div className="sidebar-panel-card">
                <div className="panel-section-title">🤖 Localised Automation Desk</div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>Auto-Sync Loop</strong>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={autoRefreshEnabled}
                        onChange={(e) => {
                          setAutoRefreshEnabled(e.target.checked);
                          if (e.target.checked) triggerAutoSyncLog();
                        }}
                      /> 
                      Auto-refresh (5s)
                    </label>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>Simulating database webhooks sync from Delhi-NCR field logistics.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>System Logs & API Alerts</div>
                  <div className="sim-alert-list">
                    {remindersList.map(item => (
                      <div className={`sim-alert-item alert-${item.type}`} key={item.id}>
                        <span className="sim-alert-time">{item.time}</span>
                        <div className="sim-alert-body">{item.body}</div>
                      </div>
                    ))}
                    {remindersList.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                        ✅ System nominal. No active routing flags.
                      </div>
                    )}
                  </div>
                </div>

                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={handleManualReminders}>
                  ✉️ WhatsApp Manual Reminders
                </button>
              </div>

            </div>
          </section>
        )}

      </main>

      {/* ========================================================
          KYC AUDITING PANEL (ADMIN DRAWER)
          ======================================================== */}
      {drawerOpen && selectedCustomerDetails && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}></div>
          <div className="drawer-panel active">
            <div className="drawer-header">
              <div>
                <h3>Customer Verification Audit</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  ID: {selectedCustomerDetails.profile.id}
                </p>
              </div>
              <button className="drawer-close-btn" onClick={() => setDrawerOpen(false)}>×</button>
            </div>

            <div className="drawer-body">
              
              {/* Profile Details */}
              <div>
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>KYC Profile Details</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Full Name</span>
                    <span className="detail-value">{selectedCustomerDetails.profile.name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Mobile Number</span>
                    <span className="detail-value">{selectedCustomerDetails.profile.phone || 'N/A'}</span>
                  </div>
                  <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="detail-label">Email Address</span>
                    <span className="detail-value">{selectedCustomerDetails.profile.email || 'N/A'}</span>
                  </div>
                  <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="detail-label">Physical Address</span>
                    <span className="detail-value">{selectedCustomerDetails.profile.address || 'N/A (RISK FLAG TRIGGERED)'}</span>
                  </div>
                </div>
              </div>

              {/* ID Proof Preview */}
              <div>
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Government ID Verification Scan</h4>
                <div className="id-preview-panel">
                  <div className="id-preview-img-placeholder">
                    <span style={{ fontSize: '2rem' }}>🪪</span>
                    <span>{selectedCustomerDetails.profile.idProofName || 'No ID Scan Uploaded'}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>AADHAAR / PASSPORT SECURE VAULT PREVIEW</span>
                  </div>
                </div>
              </div>

              {/* Risk list */}
              {selectedCustomerDetails.profile.riskFlags.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Risk Flags Raised</h4>
                  <div className="alert-box alert-error" style={{ padding: '12px 16px' }}>
                    <div className="alert-message-content" style={{ width: '100%' }}>
                      <ul style={{ marginLeft: '18px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {selectedCustomerDetails.profile.riskFlags.map((rf, idx) => <li key={idx}>{rf}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Assigned Rentals */}
              <div>
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Assigned Rentals</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getEnrichedBookingsList().map(b => (
                    <div style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }} key={b.id}>
                      <div>
                        <strong>{b.device?.name || 'Device'}</strong>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>Serial: {b.device?.serialNumber}</span>
                      </div>
                      <span className={`status-pill ${b.returnStatus === 'overdue' ? 'status-rejected' : 'status-approved'}`} style={{ fontSize: '0.7rem' }}>
                        {b.returnStatus === 'overdue' ? 'Overdue' : 'Active'}
                      </span>
                    </div>
                  ))}
                  {getEnrichedBookingsList().length === 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No rental allocations on file.</span>
                  )}
                </div>
              </div>

              {/* Audit history logs */}
              <div>
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Verification Trail / Log History</h4>
                <div className="audit-list-box">
                  {selectedCustomerDetails.auditLogs.map(log => {
                    const formatted = new Date(log.timestamp).toLocaleString();
                    return (
                      <div className={`audit-item action-${log.action.toLowerCase()}`} key={log.id}>
                        <div className="audit-meta">
                          <strong>{log.action.replace('_', ' ')}</strong>
                          <span>{formatted}</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>{log.notes}</p>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Operator: {log.operator}</span>
                      </div>
                    );
                  })}
                  {selectedCustomerDetails.auditLogs.length === 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No audit history logs.</span>
                  )}
                </div>
              </div>

              {/* Rejection comment card */}
              {rejectionNotesOpen && (
                <div className="rejection-notes-wrapper visible">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="rejection-reason" style={{ color: 'var(--error)', fontWeight: 700 }}>Mandatory Rejection Comment *</label>
                    <textarea 
                      id="rejection-reason" 
                      className="form-input" 
                      rows="3" 
                      placeholder="Provide clear reasons for rejection... (e.g. invalid Aadhaar number format)"
                      value={rejectionReasonText}
                      onChange={(e) => setRejectionReasonText(e.target.value)}
                    ></textarea>
                  </div>
                </div>
              )}

            </div>

            <div className="drawer-footer">
              <button className="btn btn-secondary" onClick={() => setDrawerOpen(false)}>Cancel</button>
              
              {selectedCustomerDetails.profile.status !== 'rejected' && !rejectionNotesOpen && (
                <button className="btn btn-danger" onClick={() => handleVerifyKYC('reject')}>Reject Application</button>
              )}
              
              {rejectionNotesOpen && (
                <button className="btn btn-danger" onClick={() => handleVerifyKYC('reject')}>Submit Rejection</button>
              )}

              {selectedCustomerDetails.profile.status !== 'approved' && !rejectionNotesOpen && (
                <button className="btn btn-primary" onClick={() => handleVerifyKYC('approve')}>Approve KYC & Generate Contract</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* WhatsApp Reminders Modal */}
      {whatsappModalOpen && (
        <div className="drawer-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={() => setWhatsappModalOpen(false)}>
          <div className="auth-wrapper" style={{ maxWidth: '600px', width: '90%', margin: 0, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>💬 WhatsApp Manual Reminders Desk</h3>
              <button className="drawer-close-btn" style={{ width: '28px', height: '28px', fontSize: '1.2rem' }} onClick={() => setWhatsappModalOpen(false)}>×</button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Select a customer below to trigger a pre-filled WhatsApp KYC reminder message via Click-to-Chat.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
              {customers.filter(c => c.status !== 'approved').map(c => {
                const pendingChecks = c.riskFlags && c.riskFlags.length > 0
                  ? (Array.isArray(c.riskFlags) ? c.riskFlags : JSON.parse(c.riskFlags))
                  : [];
                return (
                  <div key={c.id} style={{ background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'left', flexGrow: 1 }}>
                      <strong style={{ fontSize: '0.95rem' }}>{c.name}</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Phone: {c.phone} | Status: <span style={{ textTransform: 'capitalize' }}>{c.status.replace('_', ' ')}</span></span>
                      {c.status === 'rejected' && c.rejectionReason && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '4px' }}>⚠️ {c.rejectionReason}</p>
                      )}
                      {c.status !== 'rejected' && pendingChecks.length > 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px' }}>
                          ⚠️ Flags: {pendingChecks.map(f => f.replace('SYSTEM: ', '')).join(', ')}
                        </p>
                      )}
                    </div>
                    <button 
                      className="btn btn-primary btn-sm" 
                      onClick={() => sendWhatsAppReminder(c)}
                      style={{ whiteSpace: 'nowrap', backgroundColor: '#25D366', borderColor: '#25D366' }}
                    >
                      💬 Send WhatsApp
                    </button>
                  </div>
                );
              })}
              {customers.filter(c => c.status !== 'approved').length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  🎉 All customer accounts are fully approved!
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setWhatsappModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
